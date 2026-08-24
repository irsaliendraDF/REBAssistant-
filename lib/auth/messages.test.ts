import { describe, expect, it } from 'vitest'

import { exchangeFailureReason, readCallbackParams, type SignInReason } from './callback'
import { SIGN_IN_MESSAGES, signInMessage } from './messages'

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
