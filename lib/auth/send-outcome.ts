/**
 * What Supabase just told us, read from the error's shape.
 *
 * Pure, like `callback.ts` next door, so every branch can be tested without a
 * network or a Supabase project. The server actions do the talking; deciding
 * *which* failure happened, and therefore what the researcher sees, is here.
 *
 * Why this file exists: the actions used to test the error's *message* with
 * `/rate|limit|too many/i` and send everything else to the "check your email"
 * screen. An unreachable project produces the message `fetch failed`, which
 * matches nothing, so the app told researchers an email was on its way while the
 * database was down. That is the screen the client saw on 26 August 2026 and
 * again on the weekend of 19 September 2026.
 *
 * Every shape below was read off the live project with the same
 * `@supabase/supabase-js` the app uses. See `docs/sign-in-spec-2.md`.
 */

/** The parts of a Supabase auth error these decisions actually use. */
export type AuthErrorLike = {
  name?: string
  status?: number
  code?: string
  message?: string
}

/**
 * Supabase did not answer at all. `AuthRetryableFetchError` with status 0 is
 * what a paused project, a DNS failure and a dropped connection all produce.
 *
 * Checked before anything else everywhere it is used, because an error with no
 * status must not fall through to a branch that assumes one.
 */
export function isServiceUnavailable(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  return error.name === 'AuthRetryableFetchError' || error.status === 0
}

/** Too many requests. The one failure where trying again at once is wrong. */
function isRateLimited(error: AuthErrorLike): boolean {
  // On status, not on the message. Supabase has more than one 429 here and at
  // least one of them reads "For security purposes, you can only request this
  // after N seconds", which contains none of rate, limit or too many. Matching
  // the message is how the old code missed cases.
  return error.status === 429
}

export type SignInOutcome =
  | 'signed_in'
  /**
   * Wrong password, **or no account at all**. Supabase deliberately returns the
   * same `invalid_credentials` for both, so that an anonymous visitor cannot
   * use the sign-in box to discover who has an account. It cannot be told apart
   * from here, and the interface must not pretend otherwise.
   */
  | 'invalid_credentials'
  /** Registered but never clicked the confirmation link. */
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'service_unavailable'
  /** Something else Supabase answered with. */
  | 'failed'

export function readSignInOutcome(error: AuthErrorLike | null | undefined): SignInOutcome {
  if (!error) return 'signed_in'
  if (isServiceUnavailable(error)) return 'service_unavailable'
  if (isRateLimited(error)) return 'rate_limited'
  if (error.code === 'email_not_confirmed') return 'email_not_confirmed'
  if (error.code === 'invalid_credentials') return 'invalid_credentials'
  return 'failed'
}

export type RegisterOutcome =
  /** Created. A confirmation link is on its way and nothing works until it is used. */
  | 'confirm_email'
  /**
   * The address already has an account. Worth saying plainly here, unlike on the
   * sign-in screen: someone typing an address into a sign-up form is telling us
   * they believe they have no account, and the most useful answer is that they
   * do. It is also the only place left to catch a researcher about to open a
   * second account for themselves.
   */
  | 'already_registered'
  | 'weak_password'
  | 'rate_limited'
  | 'service_unavailable'
  | 'failed'

/**
 * Supabase obfuscates a repeat sign-up rather than erroring on it: with email
 * confirmation on, registering an address that already has a confirmed account
 * returns a user object with an **empty `identities` array** and no error. So
 * this reads the success shape as well as the failure one.
 */
export function readRegisterOutcome(
  error: AuthErrorLike | null | undefined,
  user?: { identities?: unknown[] | null } | null,
): RegisterOutcome {
  if (error) {
    if (isServiceUnavailable(error)) return 'service_unavailable'
    if (isRateLimited(error)) return 'rate_limited'
    if (error.code === 'weak_password') return 'weak_password'
    if (error.code === 'user_already_exists') return 'already_registered'
    return 'failed'
  }

  if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    return 'already_registered'
  }

  return 'confirm_email'
}
