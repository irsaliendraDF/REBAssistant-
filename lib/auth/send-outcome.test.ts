import { describe, expect, it } from 'vitest'

import { isServiceUnavailable, readSendOutcome, type AuthErrorLike } from './send-outcome'

/**
 * The three shapes, read off the live project on 2026-09-21 with the same
 * library the app uses, and recorded in `docs/sign-in-spec.md`. Written out as
 * fixtures rather than paraphrased, so a library upgrade that changes them
 * fails here rather than in front of a researcher.
 */
const UNKNOWN_ADDRESS: AuthErrorLike = {
  name: 'AuthApiError',
  status: 422,
  code: 'otp_disabled',
  message: 'Signups not allowed for otp',
}

const UNREACHABLE: AuthErrorLike = {
  name: 'AuthRetryableFetchError',
  status: 0,
  code: undefined,
  message: 'fetch failed',
}

describe('readSendOutcome', () => {
  it('reports a send with no error as sent', () => {
    expect(readSendOutcome(null)).toBe('sent')
    expect(readSendOutcome(undefined)).toBe('sent')
  })

  it('recognises an address with no account', () => {
    expect(readSendOutcome(UNKNOWN_ADDRESS)).toBe('unknown_address')
  })

  it('recognises the project not answering', () => {
    expect(readSendOutcome(UNREACHABLE)).toBe('service_unavailable')
  })

  it('recognises rate limiting by status, not by wording', () => {
    // Both of Supabase's 429s here, including the one that says none of rate,
    // limit or too many. The old message test missed this exact sentence.
    expect(
      readSendOutcome({
        name: 'AuthApiError',
        status: 429,
        message: 'For security purposes, you can only request this after 51 seconds',
      }),
    ).toBe('rate_limited')

    expect(
      readSendOutcome({
        name: 'AuthApiError',
        status: 429,
        code: 'over_email_send_rate_limit',
        message: 'Email rate limit exceeded',
      }),
    ).toBe('rate_limited')
  })

  it('treats anything else Supabase answers with as unconfirmed, not as failed', () => {
    // The mail server not answering in time. The message usually arrives anyway,
    // so this must not become a claim that it did not.
    expect(
      readSendOutcome({
        name: 'AuthApiError',
        status: 500,
        message: 'Error sending magic link email',
      }),
    ).toBe('unconfirmed')
  })

  /**
   * The regression that caused both outages. An unreachable project must never
   * reach the sent screen, whatever its message says.
   */
  it('never reports an unreachable project as sent or unconfirmed', () => {
    for (const message of ['fetch failed', 'Failed to fetch', 'network error', '']) {
      const outcome = readSendOutcome({ name: 'AuthRetryableFetchError', status: 0, message })
      expect(outcome, message).toBe('service_unavailable')
    }
  })

  it('does not depend on the message for any decision it makes', () => {
    // Same errors, messages replaced with nonsense. Every outcome must hold.
    expect(readSendOutcome({ ...UNKNOWN_ADDRESS, message: 'xxx' })).toBe('unknown_address')
    expect(readSendOutcome({ ...UNREACHABLE, message: 'xxx' })).toBe('service_unavailable')
    expect(readSendOutcome({ name: 'AuthApiError', status: 429, message: 'xxx' })).toBe(
      'rate_limited',
    )
  })

  it('does not mistake an unreachable project for a rate limit or an unknown address', () => {
    expect(readSendOutcome(UNREACHABLE)).not.toBe('rate_limited')
    expect(readSendOutcome(UNREACHABLE)).not.toBe('unknown_address')
  })

  it('does not mistake an unknown address for a service outage', () => {
    // The distinction the whole design rests on. One means "type it again or
    // make an account", the other means "come back in five minutes".
    expect(readSendOutcome(UNKNOWN_ADDRESS)).not.toBe('service_unavailable')
  })
})

describe('isServiceUnavailable', () => {
  it('is true only when the server did not answer', () => {
    expect(isServiceUnavailable(UNREACHABLE)).toBe(true)
    expect(isServiceUnavailable(UNKNOWN_ADDRESS)).toBe(false)
    expect(isServiceUnavailable({ name: 'AuthApiError', status: 403, message: 'no' })).toBe(false)
    expect(isServiceUnavailable(null)).toBe(false)
  })
})
