import { describe, expect, it } from 'vitest'

import { normaliseSupabaseUrlForTest } from './env'

/**
 * The Supabase dashboard shows the project reference and the project URL one
 * line apart, and pasting the wrong one is an easy mistake that surfaces much
 * later as an unrelated-looking failure.
 */
describe('normalising the Supabase URL', () => {
  it('accepts a full URL unchanged', () => {
    expect(normaliseSupabaseUrlForTest('https://abcdefghijklmnop.supabase.co')).toBe(
      'https://abcdefghijklmnop.supabase.co',
    )
  })

  it('builds a URL from a bare project reference', () => {
    expect(normaliseSupabaseUrlForTest('abcdefghijklmnop')).toBe(
      'https://abcdefghijklmnop.supabase.co',
    )
  })

  it('strips a trailing slash, which would double up in a redirect path', () => {
    expect(normaliseSupabaseUrlForTest('https://abcdefghijklmnop.supabase.co/')).toBe(
      'https://abcdefghijklmnop.supabase.co',
    )
  })

  it('trims stray whitespace from a copy and paste', () => {
    expect(normaliseSupabaseUrlForTest('  https://abcdefghijklmnop.supabase.co  ')).toBe(
      'https://abcdefghijklmnop.supabase.co',
    )
  })

  it('leaves an unset value unset', () => {
    expect(normaliseSupabaseUrlForTest(undefined)).toBeUndefined()
    expect(normaliseSupabaseUrlForTest('')).toBeUndefined()
  })

  it('does not invent a URL from something that is not a project reference', () => {
    // Better to pass the value through and fail loudly than to guess and produce
    // a plausible URL pointing at a project that does not exist.
    expect(normaliseSupabaseUrlForTest('not a ref')).toBe('not a ref')
    expect(normaliseSupabaseUrlForTest('SHOUTING')).toBe('SHOUTING')
  })
})
