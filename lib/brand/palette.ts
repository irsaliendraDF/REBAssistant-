/**
 * The brand palette, and the contrast maths that keeps it usable.
 *
 * Five colours were supplied. Three of them are light, and the two greens in the
 * middle of the range are not usable as text on white, so the palette below adds
 * the neutrals and the one alert colour the interface needs, tuned to sit in the
 * same family rather than reverting to grey.
 *
 * Every value here is mirrored in `app/globals.css` as a Tailwind theme token.
 * This file is the source of truth and the thing the contrast test runs against.
 *
 * WHY THIS IS TESTED. This is a tool for preparing research ethics applications
 * at a university. Failing WCAG AA is both an accessibility failure for the
 * researchers using it and an awkward thing to hand a client whose whole subject
 * is the ethical treatment of people. The test below fails the build rather than
 * leaving it to be noticed later.
 */

/** As supplied. */
export const BRAND = {
  /** #142314 Very dark forest green. Body text and headings. */
  ink: '#142314',
  /** #19552D Rich evergreen. Primary actions, progress, active state. */
  forest: '#19552D',
  /** #96A537 Olive. Accent only. Too light for text on white. */
  olive: '#96A537',
  /** #DCE182 Soft yellow-green. Highlight backgrounds, with ink on top. */
  limeSoft: '#DCE182',
  /** #B4D7F0 Pale powder blue. Informational backgrounds, with ink on top. */
  skySoft: '#B4D7F0',
} as const

/** Derived, to complete a working interface. */
export const SUPPORT = {
  /** Darker evergreen for hover on primary actions. */
  forestDark: '#102E1A',
  /** Page background. A green-tinted off-white, so neutrals belong to the family. */
  surface: '#F6F8F2',
  /** Secondary surface, hover fills. */
  surface2: '#E9EEE0',
  /** Borders and rules. */
  line: '#D5DCC9',
  /** Secondary text. */
  muted: '#55604F',
  /** Tertiary text, e.g. section numbers. Still AA at normal size. */
  faint: '#6E7668',
  /** Errors only. Kept red because the convention carries meaning. */
  alert: '#8A2B1C',
  /** Error background. */
  alertSoft: '#F6E7E3',
} as const

export const PALETTE = { ...BRAND, ...SUPPORT }

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio. 4.5 is AA for normal text, 3 for large text and UI. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

export const WHITE = '#FFFFFF'

/**
 * The foreground and background pairings the interface actually uses. Adding a
 * new one means adding it here, which means it gets checked.
 */
export const TEXT_PAIRINGS: { name: string; fg: string; bg: string; minimum: number }[] = [
  { name: 'body text on white', fg: PALETTE.ink, bg: WHITE, minimum: 4.5 },
  { name: 'body text on page surface', fg: PALETTE.ink, bg: PALETTE.surface, minimum: 4.5 },
  { name: 'secondary text on white', fg: PALETTE.muted, bg: WHITE, minimum: 4.5 },
  { name: 'secondary text on page surface', fg: PALETTE.muted, bg: PALETTE.surface, minimum: 4.5 },
  { name: 'tertiary text on white', fg: PALETTE.faint, bg: WHITE, minimum: 4.5 },
  { name: 'white on primary action', fg: WHITE, bg: PALETTE.forest, minimum: 4.5 },
  { name: 'white on primary action hover', fg: WHITE, bg: PALETTE.forestDark, minimum: 4.5 },
  { name: 'ink on highlight background', fg: PALETTE.ink, bg: PALETTE.limeSoft, minimum: 4.5 },
  { name: 'ink on informational background', fg: PALETTE.ink, bg: PALETTE.skySoft, minimum: 4.5 },
  { name: 'ink on olive accent', fg: PALETTE.ink, bg: PALETTE.olive, minimum: 4.5 },
  { name: 'ink on secondary surface', fg: PALETTE.ink, bg: PALETTE.surface2, minimum: 4.5 },
  { name: 'alert text on alert background', fg: PALETTE.alert, bg: PALETTE.alertSoft, minimum: 4.5 },
  { name: 'alert text on white', fg: PALETTE.alert, bg: WHITE, minimum: 4.5 },
]

/** Non-text pairings: borders, fills, markers. AA asks 3:1 for these. */
export const UI_PAIRINGS: { name: string; fg: string; bg: string; minimum: number }[] = [
  { name: 'primary fill on white', fg: PALETTE.forest, bg: WHITE, minimum: 3 },
  { name: 'primary fill on page surface', fg: PALETTE.forest, bg: PALETTE.surface, minimum: 3 },
]
