import type { DataStore } from './types'

/**
 * Riding out clock skew on a freshly minted session.
 *
 * Symptom, observed in production on 6 August 2026: the first click of a magic
 * link returned a 500, and a refresh worked. The log said
 * `Could not load your details: JWT issued at future`.
 *
 * Cause: Supabase mints the session token at the instant the link is clicked,
 * stamped with its own clock. The very next request is validated against a
 * different machine's clock. If that one is even fractionally behind, the
 * token's "issued at" is in the future and it is rejected. A second later the
 * timestamp has fallen into the past and everything works, which is exactly why
 * refreshing fixed it.
 *
 * Neither clock is ours to correct, so this waits rather than pretending the
 * request failed. The window is short and closes on its own.
 *
 * Applied to the whole store rather than to the method that happened to fail
 * first. Every authenticated query runs under the same token, so any of them can
 * be the unlucky one; `getProfile` was only first because both layouts call it
 * before anything else renders. Wrapping the object means a method added later
 * is covered without anyone remembering to cover it.
 *
 * Deliberately narrow: only this specific error is retried. Retrying a
 * permission failure would turn a clear "you cannot see this" into a slow
 * "you cannot see this", and retrying a write that already succeeded would be
 * worse than the bug.
 */

/**
 * Postgres and the auth layer word this differently depending on which rejects
 * the token, so both forms are matched.
 */
const CLOCK_SKEW = /JWT issued at future|token used before issued|not yet valid/i

/**
 * Three attempts over roughly 1.8 seconds. Long enough for the sub-second skew
 * that causes this in practice, short enough that a genuinely broken token fails
 * while the researcher is still looking at the screen.
 */
const BACKOFF_MS = [300, 600, 900]

export function isClockSkewError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return CLOCK_SKEW.test(message)
}

async function retrying<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= BACKOFF_MS.length || !isClockSkewError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]))
    }
  }
}

/** Wraps every method of a store so a not-yet-valid token is waited out. */
export function withClockSkewRetry(store: DataStore): DataStore {
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (typeof value !== 'function') return value

      return (...args: unknown[]) =>
        retrying(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args))
    },
  })
}
