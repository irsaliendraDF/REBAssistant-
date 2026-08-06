import { describe, expect, it, vi } from 'vitest'

import type { DataStore } from './types'

import { isClockSkewError, withClockSkewRetry } from './clock-skew'

/**
 * This exists because of a real 500 on the first click of a magic link. What
 * matters is not only that the retry happens, but that it is narrow: a
 * permission failure must fail immediately and a write must never be repeated
 * because something unrelated went wrong.
 */

function storeWith(getProfile: () => Promise<unknown>): DataStore {
  return { getProfile, isEphemeral: false, name: 'test' } as unknown as DataStore
}

describe('isClockSkewError', () => {
  it('recognises the wordings the token can be rejected with', () => {
    expect(isClockSkewError(new Error('Could not load your details: JWT issued at future'))).toBe(true)
    expect(isClockSkewError(new Error('token used before issued'))).toBe(true)
    expect(isClockSkewError(new Error('JWT is not yet valid'))).toBe(true)
  })

  it('does not treat other failures as skew', () => {
    expect(isClockSkewError(new Error('JWT expired'))).toBe(false)
    expect(isClockSkewError(new Error('new row violates row-level security policy'))).toBe(false)
    expect(isClockSkewError(new Error('permission denied for table profiles'))).toBe(false)
  })
})

describe('withClockSkewRetry', () => {
  it('returns the value once the token becomes valid', async () => {
    vi.useFakeTimers()
    const inner = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not load your details: JWT issued at future'))
      .mockResolvedValueOnce({ id: 'u1' })

    const result = withClockSkewRetry(storeWith(inner)).getProfile('u1')
    await vi.runAllTimersAsync()

    expect(await result).toEqual({ id: 'u1' })
    expect(inner).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('gives up rather than retrying forever', async () => {
    vi.useFakeTimers()
    const inner = vi.fn().mockRejectedValue(new Error('JWT issued at future'))

    const result = withClockSkewRetry(storeWith(inner)).getProfile('u1')
    const assertion = expect(result).rejects.toThrow('JWT issued at future')
    await vi.runAllTimersAsync()
    await assertion

    // The first attempt plus one per backoff step, and no more.
    expect(inner).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  // The point of the narrowness. A researcher denied access should be told so
  // at once, not after two seconds of pointless waiting.
  it('does not retry a permission failure', async () => {
    const inner = vi.fn().mockRejectedValue(new Error('permission denied for table profiles'))

    await expect(withClockSkewRetry(storeWith(inner)).getProfile('u1')).rejects.toThrow(
      'permission denied',
    )
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('calls through untouched when nothing fails', async () => {
    const inner = vi.fn().mockResolvedValue(null)

    await expect(withClockSkewRetry(storeWith(inner)).getProfile('u1')).resolves.toBeNull()
    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('leaves non-function properties alone', () => {
    const wrapped = withClockSkewRetry(storeWith(async () => null))
    expect(wrapped.isEphemeral).toBe(false)
    expect(wrapped.name).toBe('test')
  })
})
