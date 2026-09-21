import { describe, expect, it } from 'vitest'

import { exchangeFailureReason, readCallbackParams, type SignInReason } from './callback'
import { SIGN_IN_MESSAGES, signInMessage, type CredentialReason } from './messages'
import { readRegisterOutcome, readSignInOutcome } from './send-outcome'

/**
 * Every reason the app can produce, listed here rather than derived, so adding
 * one to a union forces a decision about what the researcher is told.
 */
const EVERY_LINK_REASON: SignInReason[] = [
  'link_expired',
  'link_wrong_device',
  'missing_code',
  'exchange_failed',
  'auth_not_configured',
]

const EVERY_CREDENTIAL_REASON: CredentialReason[] = [
  'invalid_email',
  'invalid_credentials',
  'email_not_confirmed',
  'weak_password',
  'missing_password',
  'already_registered',
  'rate_limited',
  'service_unavailable',
  'reset_failed',
]

describe('sign-in messages', () => {
  it('has something to say for every reason', () => {
    for (const reason of [...EVERY_LINK_REASON, ...EVERY_CREDENTIAL_REASON]) {
      expect(SIGN_IN_MESSAGES[reason], reason).toBeTruthy()
    }
  })

  it('covers every outcome the sign-in and sign-up paths actually produce', () => {
    // Drawn from the readers rather than written out again, so an outcome added
    // there without a message here fails the suite.
    const produced = new Set<string>()
    for (const error of [
      { status: 400, code: 'invalid_credentials' },
      { status: 400, code: 'email_not_confirmed' },
      { status: 429 },
      { name: 'AuthRetryableFetchError', status: 0 },
      { status: 422, code: 'weak_password' },
      { status: 422, code: 'user_already_exists' },
    ]) {
      produced.add(readSignInOutcome(error))
      produced.add(readRegisterOutcome(error))
    }

    for (const outcome of produced) {
      // 'failed', 'signed_in' and 'confirm_email' are screens, not error text.
      if (['failed', 'signed_in', 'confirm_email'].includes(outcome)) continue
      expect(signInMessage(outcome), outcome).toBeTruthy()
    }
  })

  it('covers every reason the callback can still produce', () => {
    const produced = new Set<string>()
    for (const query of ['', 'error=access_denied&error_code=otp_expired', 'error=server_error']) {
      const outcome = readCallbackParams(new URLSearchParams(query))
      if (outcome.kind === 'failed') produced.add(outcome.reason)
    }
    for (const message of [
      'both auth code and code verifier should be non-empty',
      'Email link is invalid or has expired',
      'something nobody has seen before',
    ]) {
      produced.add(exchangeFailureReason(message))
    }

    for (const reason of produced) {
      expect(signInMessage(reason), reason).toBeTruthy()
    }
  })

  it('tells the researcher what to do next, not only what went wrong', () => {
    // Every message ends up in front of someone who is stuck. A message with no
    // instruction in it leaves them exactly where they were.
    for (const [reason, message] of Object.entries(SIGN_IN_MESSAGES)) {
      expect(
        /try again|request|check|wait|reset|sign in|create an account|choose|enter/i.test(message),
        reason,
      ).toBe(true)
    }
  })

  it('returns nothing for a reason it does not recognise', () => {
    expect(signInMessage('made_up')).toBeUndefined()
    expect(signInMessage(undefined)).toBeUndefined()
  })
})

describe('the sign-in screen does not claim to know who has an account', () => {
  /**
   * Supabase returns one error for a wrong password and for an address that has
   * never registered, deliberately, so the box cannot be used to discover who
   * has an account. The message must not undo that by guessing.
   */
  it('does not assert that the account exists, or that it does not', () => {
    const message = SIGN_IN_MESSAGES.invalid_credentials
    expect(message).not.toMatch(/no account (for|with|exists)|not registered|never signed up/i)
    expect(message).not.toMatch(/your password is wrong|incorrect password/i)
  })

  it('offers the route out of both possibilities, since it cannot pick one', () => {
    const message = SIGN_IN_MESSAGES.invalid_credentials
    expect(message).toMatch(/reset/i)
    expect(message).toMatch(/create an account/i)
  })
})

describe('an outage says it is an outage', () => {
  /**
   * Added after the second paused-project outage, 2026-09-21. Under the magic
   * link this surfaced as "check your email". Under a password it would surface
   * as a rejected password, which is worse: the researcher retypes a password
   * they know is right until they conclude they are locked out.
   */
  it('names the service, and clears the password explicitly', () => {
    const message = signInMessage('service_unavailable') ?? ''
    expect(message).toMatch(/unavailable/i)
    expect(message).toMatch(/nothing to do with your password/i)
  })

  it('does not send the researcher to their inbox', () => {
    expect(signInMessage('service_unavailable')).not.toMatch(/junk|spam|check your email/i)
  })
})

describe('the magic link is gone', () => {
  /**
   * Replaced by email and password on 21 September 2026. These assert the
   * remedies went with it, so nobody reintroduces a six-digit code box or a
   * browser reset while wiring something unrelated.
   */
  it('has no message about a six-digit code', () => {
    const remaining = Object.entries(SIGN_IN_MESSAGES).filter(([, message]) =>
      /six-digit|six digit/i.test(message),
    )
    expect(remaining).toEqual([])
  })

  it('has no message offering to clear the browser', () => {
    const remaining = Object.entries(SIGN_IN_MESSAGES).filter(([, message]) =>
      /clear.*(browser|sign-in data)/i.test(message),
    )
    expect(remaining).toEqual([])
  })

  it('has no message asserting an email was not sent', () => {
    const claims = Object.values(SIGN_IN_MESSAGES).filter((message) =>
      /could not be sent|failed to send|was not sent/i.test(message),
    )
    expect(claims).toEqual([])
  })
})
