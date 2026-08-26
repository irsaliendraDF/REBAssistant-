import { describe, expect, it } from 'vitest'

import { exchangeFailureReason, readCallbackParams, type SignInReason } from './callback'
import { SIGN_IN_MESSAGES, resetHelps, signInMessage } from './messages'

/**
 * Every reason the callback can produce, listed here rather than derived, so
 * adding one to the union forces a decision about what the researcher is told.
 */
const EVERY_REASON: SignInReason[] = [
  'link_expired',
  'link_wrong_device',
  'missing_code',
  'exchange_failed',
  'auth_not_configured',
]

describe('sign-in messages', () => {
  it('has something to say for every reason', () => {
    for (const reason of EVERY_REASON) {
      expect(SIGN_IN_MESSAGES[reason], reason).toBeTruthy()
    }
  })

  it('covers every reason the callback actually produces', () => {
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
      expect(/try again|request|use the six-digit code|check|wait/i.test(message), reason).toBe(true)
    }
  })

  it('does not send someone round the same loop when a new link will not help', () => {
    expect(SIGN_IN_MESSAGES.link_wrong_device).toContain('six-digit code')
  })

  it('returns nothing for a reason it does not recognise', () => {
    expect(signInMessage('made_up')).toBeUndefined()
    expect(signInMessage(undefined)).toBeUndefined()
  })
})

describe('resetHelps', () => {
  // The case that prompted this. A paused database surfaces as a send failure,
  // and clearing browser cookies cannot send an email.
  it('does not offer the reset for failures it cannot fix', () => {
    for (const reason of ['rate_limited', 'invalid_email', 'invalid_code']) {
      expect(resetHelps(reason)).toBe(false)
    }
  })

  it('offers the reset where a stuck session is the likely cause', () => {
    expect(resetHelps('exchange_failed')).toBe(true)
  })

  it('does not offer it on a clean sign-in screen', () => {
    expect(resetHelps(undefined)).toBe(false)
    expect(resetHelps('')).toBe(false)
  })

  it('ignores a reason it does not recognise', () => {
    expect(resetHelps('something_invented')).toBe(false)
  })
})

describe('no unconfirmed send is reported as a failure', () => {
  /**
   * Supabase reports a failure when the mail server does not answer in time.
   * With Gmail behind it the message usually arrives anyway, so the app claimed
   * the email could not be sent while the researcher was reading it. That
   * message is gone on purpose, and this fails if anyone reintroduces it.
   */
  it('has no message asserting the email was not sent', () => {
    const claims = Object.values(SIGN_IN_MESSAGES).filter((message) =>
      /could not be sent|failed to send|was not sent/i.test(message),
    )
    expect(claims).toEqual([])
  })

  it('still names rate limiting, where trying again at once is the wrong move', () => {
    expect(signInMessage('rate_limited')).toMatch(/wait a minute/i)
  })
})
