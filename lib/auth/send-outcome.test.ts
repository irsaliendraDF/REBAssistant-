import { describe, expect, it } from 'vitest'

import {
  isServiceUnavailable,
  readRegisterOutcome,
  readSignInOutcome,
  type AuthErrorLike,
} from './send-outcome'

/**
 * Shapes read off the live project with the same library the app uses, and
 * recorded in `docs/sign-in-spec-2.md`. Written out as fixtures rather than
 * paraphrased, so a library upgrade that changes them fails here rather than in
 * front of a researcher.
 */
const WRONG_PASSWORD: AuthErrorLike = {
  name: 'AuthApiError',
  status: 400,
  code: 'invalid_credentials',
  message: 'Invalid login credentials',
}

/** Byte for byte identical to the above. That is the point of the next test. */
const NO_SUCH_ACCOUNT: AuthErrorLike = {
  name: 'AuthApiError',
  status: 400,
  code: 'invalid_credentials',
  message: 'Invalid login credentials',
}

const UNREACHABLE: AuthErrorLike = {
  name: 'AuthRetryableFetchError',
  status: 0,
  code: undefined,
  message: 'fetch failed',
}

describe('readSignInOutcome', () => {
  it('reports a sign-in with no error as signed in', () => {
    expect(readSignInOutcome(null)).toBe('signed_in')
    expect(readSignInOutcome(undefined)).toBe('signed_in')
  })

  /**
   * The finding that shaped this whole design. Supabase will not say whether an
   * address has an account, so the interface must not claim to know either.
   */
  it('cannot tell a wrong password from an address with no account', () => {
    expect(readSignInOutcome(WRONG_PASSWORD)).toBe('invalid_credentials')
    expect(readSignInOutcome(NO_SUCH_ACCOUNT)).toBe('invalid_credentials')
    expect(readSignInOutcome(WRONG_PASSWORD)).toBe(readSignInOutcome(NO_SUCH_ACCOUNT))
  })

  it('recognises an account that was never confirmed', () => {
    expect(
      readSignInOutcome({
        name: 'AuthApiError',
        status: 400,
        code: 'email_not_confirmed',
        message: 'Email not confirmed',
      }),
    ).toBe('email_not_confirmed')
  })

  it('recognises rate limiting by status, not by wording', () => {
    // Both of Supabase's 429s here, including the one that says none of rate,
    // limit or too many.
    expect(
      readSignInOutcome({
        status: 429,
        message: 'For security purposes, you can only request this after 51 seconds',
      }),
    ).toBe('rate_limited')
    expect(
      readSignInOutcome({ status: 429, code: 'over_request_rate_limit', message: 'slow down' }),
    ).toBe('rate_limited')
  })

  /**
   * The regression behind both outages. A project that is not answering must
   * never be reported as a credentials problem: the researcher would retype a
   * correct password until they gave up.
   */
  it('never blames the password when the server did not answer', () => {
    for (const message of ['fetch failed', 'Failed to fetch', 'network error', '']) {
      const outcome = readSignInOutcome({ name: 'AuthRetryableFetchError', status: 0, message })
      expect(outcome, message).toBe('service_unavailable')
    }
    expect(readSignInOutcome(UNREACHABLE)).not.toBe('invalid_credentials')
    expect(readSignInOutcome(UNREACHABLE)).not.toBe('failed')
  })

  it('does not depend on the message for any decision it makes', () => {
    expect(readSignInOutcome({ ...WRONG_PASSWORD, message: 'xxx' })).toBe('invalid_credentials')
    expect(readSignInOutcome({ ...UNREACHABLE, message: 'xxx' })).toBe('service_unavailable')
  })

  it('falls back rather than guessing at anything else', () => {
    expect(readSignInOutcome({ status: 500, message: 'Internal server error' })).toBe('failed')
  })
})

describe('readRegisterOutcome', () => {
  it('reports a clean sign-up as needing confirmation', () => {
    expect(readRegisterOutcome(null, { identities: [{}] })).toBe('confirm_email')
  })

  /**
   * Supabase does not error on a repeat sign-up. It returns a user with an
   * empty identities array, so this has to read the success shape too. Missing
   * it would tell a researcher who already has an account to go and check an
   * inbox for a confirmation email that is never sent.
   */
  it('recognises a repeat sign-up from the empty identities array', () => {
    expect(readRegisterOutcome(null, { identities: [] })).toBe('already_registered')
  })

  it('also recognises it from the error code, where Supabase gives one', () => {
    expect(
      readRegisterOutcome({ status: 422, code: 'user_already_exists', message: 'already exists' }),
    ).toBe('already_registered')
  })

  it('does not mistake a missing identities field for a repeat sign-up', () => {
    // Absent is not the same as empty. Guessing wrong here sends a genuinely new
    // researcher to a screen telling them they already have an account.
    expect(readRegisterOutcome(null, {})).toBe('confirm_email')
    expect(readRegisterOutcome(null, { identities: null })).toBe('confirm_email')
    expect(readRegisterOutcome(null, null)).toBe('confirm_email')
    expect(readRegisterOutcome(null)).toBe('confirm_email')
  })

  it('names a password Supabase refused, which is fixable by the person typing', () => {
    expect(
      readRegisterOutcome({ status: 422, code: 'weak_password', message: 'Password is too short' }),
    ).toBe('weak_password')
  })

  it('never reports an unreachable project as a sign-up problem', () => {
    expect(readRegisterOutcome(UNREACHABLE)).toBe('service_unavailable')
    expect(readRegisterOutcome({ status: 429, message: 'too many' })).toBe('rate_limited')
  })
})

describe('isServiceUnavailable', () => {
  it('is true only when the server did not answer', () => {
    expect(isServiceUnavailable(UNREACHABLE)).toBe(true)
    expect(isServiceUnavailable(WRONG_PASSWORD)).toBe(false)
    expect(isServiceUnavailable({ name: 'AuthApiError', status: 403, message: 'no' })).toBe(false)
    expect(isServiceUnavailable(null)).toBe(false)
  })
})
