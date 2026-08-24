import { describe, expect, it } from 'vitest'

import {
  exchangeFailureReason,
  readCallbackParams,
  safeNext,
  signInUrl,
} from './callback'

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('reading a sign-in link', () => {
  it('takes the code from the default flow', () => {
    const outcome = readCallbackParams(params('code=abc123'))

    expect(outcome).toEqual({ kind: 'code', code: 'abc123', next: '/dashboard' })
  })

  it('takes a token hash, which works on a device that never asked for the link', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=magiclink'))

    expect(outcome).toEqual({
      kind: 'token_hash',
      tokenHash: 'xyz',
      type: 'magiclink',
      next: '/dashboard',
    })
  })

  it('recognises the first-time confirmation link', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=signup'))

    expect(outcome).toMatchObject({ kind: 'token_hash', type: 'signup' })
  })

  it('falls back to a magic link for a type it does not know', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&type=nonsense'))

    expect(outcome).toMatchObject({ type: 'magiclink' })
  })

  it('prefers the token hash where a link somehow carries both', () => {
    const outcome = readCallbackParams(params('token_hash=xyz&code=abc'))

    expect(outcome.kind).toBe('token_hash')
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

  it('refuses another site', () => {
    expect(safeNext('https://example.com/phish')).toBe('/dashboard')
    expect(safeNext('//example.com/phish')).toBe('/dashboard')
  })

  it('defaults to the dashboard', () => {
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext('')).toBe('/dashboard')
  })

  it('carries the reason back to the sign-in screen', () => {
    expect(signInUrl('https://example.ca', 'link_wrong_device')).toBe(
      'https://example.ca/sign-in?error=link_wrong_device',
    )
  })
})
