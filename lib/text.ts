/**
 * Presenting researcher-entered text.
 *
 * A project title typed as "research" renders as a lowercase heading, which
 * looks like a bug in an otherwise carefully set interface. Capitalising the
 * first character fixes that.
 *
 * Deliberately only the first character. Title-casing the whole string would
 * mangle the things research titles are full of: acronyms, proper nouns,
 * hyphenated terms, Latin names, and words like "of" and "and" that title case
 * rules disagree about. The stored value is never changed, only what is shown,
 * so nothing is lost either way.
 */
export function displayTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
