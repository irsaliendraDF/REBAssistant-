# Brand

Five colours were supplied for Research Ethics Board Assistant.

| Colour | Hex | Role in the interface |
| --- | --- | --- |
| Very dark forest green | `#142314` | All body text and headings |
| Rich evergreen | `#19552D` | Primary buttons, progress fill, active state, the rule across the top |
| Olive | `#96A537` | Accent only: focus rings, the edge on an unreviewed item |
| Soft yellow-green | `#DCE182` | Highlight backgrounds, with dark green text on top |
| Pale powder blue | `#B4D7F0` | Informational backgrounds, with dark green text on top |

Tokens live in two places that must change together:

- [`lib/brand/palette.ts`](../lib/brand/palette.ts) is the source of truth and
  carries the contrast test.
- [`app/globals.css`](../app/globals.css) declares the same values as Tailwind
  theme tokens, so the utility classes exist.

Tokens are named by role, not by colour (`--color-ink`, not
`--color-dark-green`), so a future palette change is a value change in two files
rather than a rename across every component.

## Added, because five colours are not an interface

Three of the supplied colours are light and none of the greens in the middle of
the range work as text on white. These fill the gaps and are tinted toward green
so they read as part of the family rather than as generic grey:

`--color-surface #F6F8F2` page background · `--color-surface-2 #E9EEE0` secondary
surfaces · `--color-line #D5DCC9` borders · `--color-muted #55604F` secondary
text · `--color-faint #6E7668` tertiary text · `--color-forest-dark #102E1A`
primary hover · `--color-alert #8A2B1C` and `--color-alert-soft #F6E7E3` for
errors only.

Red stays for validation errors. The convention carries meaning that a green
palette cannot replace, and losing it would cost more than the consistency gains.

## The constraint worth knowing

**Olive `#96A537` is 2.7:1 against white. It is not text.** Neither are the two
pale colours. They are fills and backgrounds, with `#142314` on top of them,
which is where the contrast comes from.

Every pairing the interface uses is listed in `TEXT_PAIRINGS` and `UI_PAIRINGS`
in the palette module, and `npm test` fails if any of them drops below WCAG AA
(4.5:1 for text, 3:1 for interface elements). Adding a new pairing means adding
it to that list, which means it gets checked.

This is tested rather than reviewed by eye because the product is a research
ethics tool for a university. An accessibility failure here is both a real
barrier for the researchers using it and an awkward thing to hand a client whose
entire subject is the ethical treatment of people.

## Restraint is the design

The interface is a long form that researchers work through over weeks, not a
landing page. Brand presence is deliberately limited to the rule across the top,
the wordmark, and the primary actions. Everything else stays quiet so the
questions are what people see.
