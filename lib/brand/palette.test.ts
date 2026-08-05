import { describe, expect, it } from 'vitest'

import {
  BRAND,
  PALETTE,
  TEXT_PAIRINGS,
  UI_PAIRINGS,
  WHITE,
  contrastRatio,
  relativeLuminance,
} from './palette'

describe('contrast maths', () => {
  it('gives the known ratio for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('gives 1 for a colour against itself', () => {
    expect(contrastRatio(BRAND.forest, BRAND.forest)).toBeCloseTo(1, 5)
  })

  it('is symmetric, since contrast has no direction', () => {
    expect(contrastRatio(BRAND.ink, WHITE)).toBeCloseTo(contrastRatio(WHITE, BRAND.ink), 5)
  })

  it('orders the supplied colours from darkest to lightest as described', () => {
    expect(relativeLuminance(BRAND.ink)).toBeLessThan(relativeLuminance(BRAND.forest))
    expect(relativeLuminance(BRAND.forest)).toBeLessThan(relativeLuminance(BRAND.olive))
    expect(relativeLuminance(BRAND.olive)).toBeLessThan(relativeLuminance(BRAND.limeSoft))
  })
})

describe('every text pairing in the interface meets WCAG AA', () => {
  it.each(TEXT_PAIRINGS)('$name', ({ fg, bg, minimum }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum)
  })
})

describe('every non-text pairing meets the 3:1 minimum', () => {
  it.each(UI_PAIRINGS)('$name', ({ fg, bg, minimum }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minimum)
  })
})

describe('the limits of the supplied palette, recorded so they are not forgotten', () => {
  it('confirms the olive is not usable as text on white', () => {
    // 2.7:1. This is why olive is an accent and a fill only, and why ink sits on
    // top of it rather than the other way round. If a future change puts olive
    // text on a white background, this is the reason not to.
    expect(contrastRatio(BRAND.olive, WHITE)).toBeLessThan(4.5)
  })

  it('confirms the two pale colours are backgrounds, not text', () => {
    expect(contrastRatio(BRAND.limeSoft, WHITE)).toBeLessThan(4.5)
    expect(contrastRatio(BRAND.skySoft, WHITE)).toBeLessThan(4.5)
  })

  it('keeps the neutrals tinted rather than grey, so they belong to the family', () => {
    // A green tint means the red and blue channels are not equal. Pure grey
    // neutrals next to a green palette read as a different design.
    for (const hex of [PALETTE.surface, PALETTE.surface2, PALETTE.line, PALETTE.muted]) {
      const clean = hex.replace('#', '')
      const r = parseInt(clean.slice(0, 2), 16)
      const g = parseInt(clean.slice(2, 4), 16)
      const b = parseInt(clean.slice(4, 6), 16)
      expect(g).toBeGreaterThan(b)
      expect(r).not.toBe(g)
    }
  })
})
