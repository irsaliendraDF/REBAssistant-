import { describe, expect, it } from 'vitest'

import {
  AFTER_CONFIRMATION,
  AFTER_RECOVERY,
  exchangeFailureReason,
  readCallbackParams,
  safeNext,
  signInUrl,
} from './callback'

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

/**
 * Since 21 September 2026, sign-in is email and password and does not come
 * through here. Two links still do: confirming a new account, and resetting a
 * password.
 */
describe('reading an emailed link', () => {
  it('takes the code from the default flow', () => {
    const outcome = readCallbackParams(params('code=abc123'))

    expect(outcome).toEqual({ kind: 'code', code: 'abc123', next: AFTER_CONFIRMATION })
  })

  it('takes a token hash, which works on a device that never asked for the link', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=signup'))

    expect(outcome).toEqual({
      kind: 'token_hash',
      tokenHash: 'xyz',
      type: 'signup',
      next: AFTER_CONFIRMATION,
    })
  })

  it('recognises a password reset link', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=recovery'))

    expect(outcome).toMatchObject({ kind: 'token_hash', type: 'recovery' })
  })

  it('treats a type it does not know as a confirmation', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=nonsense'))

    expect(outcome).toMatchObject({ type: 'signup' })
  })

  it('no longer knows about magic links', () => {
    // The old default. If this ever comes back as its own type, the sign-in
    // mechanism has been changed without this file being read.
    const outcome = readCallbackParams(params('token_hash=xyz&type=magiclink'))

    expect(outcome).toMatchObject({ type: 'signup' })
  })

  it('prefers the token hash where a link somehow carries both', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&code=abc'))

    expect(outcome.kind).toBe('token_hash')
  })
})

describe('where each kind of link lands', () => {
  /**
   * The one that would be quietly wrong. A reset link that landed on the
   * dashboard would leave the person signed in, holding the password they came
   * to change, with nothing on screen saying the job was not finished.
   */
  it('sends a recovery link to the password form even with no next parameter', () => {
    expect(readCallbackParams(params('token_hash=xyz&type=recovery'))).toMatchObject({
      next: AFTER_RECOVERY,
    })
  })

  it('sends a confirmation to the dashboard, because it signs them in', () => {
    expect(readCallbackParams(params('token_hash=xyz&type=signup'))).toMatchObject({
      next: AFTER_CONFIRMATION,
    })
  })

  it('honours an explicit next, which is how the code flow carries recovery', () => {
    // The `?code=` form has no type on it, so the destination has to travel in
    // `next`. That is what `resetPasswordForEmail` sets.
    expect(readCallbackParams(params('code=abc&next=%2Freset-password'))).toMatchObject({
      next: AFTER_RECOVERY,
    })
  })
})

/**
 * The case this file exists for. Supabase says why a link failed, in parameters
 * the callback used to ignore.
 */
describe('a link that was dead on arrival', () => {
  it('reads an expired link as expired, not as incomplete', () => {
    const outcome = readCallbackParams(
      params('error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'),
    )

    expect(outcome).toEqual({ kind: 'failed', reason: 'link_expired' })
  })

  it('reports any other refusal as a failed exchange', () => {
    const outcome = readCallbackParams(params('error=server_error&error_code=unexpected_failure'))

    expect(outcome).toEqual({ kind: 'failed', reason: 'exchange_failed' })
  })

  it('has nothing to work with when the link carries neither', () => {
    expect(readCallbackParams(params(''))).toEqual({ kind: 'failed', reason: 'missing_code' })
  })
})

describe('why an exchange failed', () => {
  it('separates a link opened in the wrong browser from an expired one', () => {
    expect(
      exchangeFailureReason('invalid request: both auth code and code verifier should be non-empty'),
    ).toBe('link_wrong_device')
  })

  it('reads a missing flow state the same way, because it is the same situation', () => {
    expect(exchangeFailureReason('invalid flow state, no valid flow state found')).toBe(
      'link_wrong_device',
    )
  })

  it('reads an expired or spent code as expired', () => {
    expect(exchangeFailureReason('Email link is invalid or has expired')).toBe('link_expired')
    expect(exchangeFailureReason('Token has expired or is invalid')).toBe('link_expired')
  })

  it('does not guess at anything else', () => {
    expect(exchangeFailureReason('database connection failed')).toBe('exchange_failed')
  })
})

/** A `next` that can be pointed anywhere is an open redirect. */
describe('where the callback sends people afterwards', () => {
  it('keeps a path within the app', () => {
    expect(safeNext('/project/123')).toBe('/project/123')
  })

  it('refuses another site, and falls back to whatever the caller asked for', () => {
    expect(safeNext('https://example.com/phish')).toBe(AFTER_CONFIRMATION)
    expect(safeNext('//example.com/phish')).toBe(AFTER_CONFIRMATION)
    // A tampered recovery link must not be rescued onto the dashboard either.
    expect(safeNext('https://example.com/phish', AFTER_RECOVERY)).toBe(AFTER_RECOVERY)
  })

  it('defaults to the dashboard unless told otherwise', () => {
    expect(safeNext(null)).toBe(AFTER_CONFIRMATION)
    expect(safeNext('')).toBe(AFTER_CONFIRMATION)
    expect(safeNext(null, AFTER_RECOVERY)).toBe(AFTER_RECOVERY)
  })

  it('carries the reason back to the sign-in screen', () => {
    expect(signInUrl('https://example.ca', 'link_wrong_device')).toBe(
      'https://example.ca/sign-in?error=link_wrong_device',
    )
  })
})
