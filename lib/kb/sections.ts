/**
 * Splitting the Dalhousie application guidelines into per-section guidance.
 *
 * The guidelines document is written against the form's own numbering: 2.4 is
 * Recruitment, and underneath it 2.4.1 to 2.4.5 say what a Board expects that
 * section to cover. That structure is why this knowledge base does not need
 * similarity search. The relationship between "the section being drafted" and
 * "the guidance that applies to it" is not something to infer from a score; it
 * is the section number, printed in the document.
 *
 * What comes out is auditable in a way a vector index is not. Anyone can read
 * what guidance section 2.4 receives, and correct it.
 */

export interface SectionGuidance {
  /** Form section number, e.g. '2.4'. */
  formSection: string
  /** Heading as printed, e.g. 'Recruitment'. */
  heading: string
  /** The guidance body, including its numbered sub-points. */
  text: string
}

/**
 * A numbered heading at the start of a line. The trailing group is deliberately
 * greedy to the end of the line, because headings and sub-point text are matched
 * by the same pattern and separated afterwards.
 */
const HEADING = /^[ \t]*(\d{1,2}(?:\.\d{1,2}){0,2})[ \t]+(\S.*)$/

/**
 * Table of contents entries, which repeat every heading in the document before
 * the body starts. They carry dot leaders, which body text never does.
 */
const DOT_LEADER = /\.{4,}/

/** A section, as opposed to a sub-point within one: '2.4', not '2.4.1'. */
function isSectionNumber(number: string): boolean {
  return number.split('.').length === 2
}

export function splitGuidanceBySection(raw: string): SectionGuidance[] {
  const sections: SectionGuidance[] = []
  let current: { formSection: string; heading: string; lines: string[] } | null = null

  for (const line of raw.split(/\r?\n/)) {
    if (DOT_LEADER.test(line)) continue

    const match = HEADING.exec(line)

    if (match && isSectionNumber(match[1])) {
      if (current) sections.push(finish(current))
      current = { formSection: match[1], heading: match[2].trim(), lines: [] }
      continue
    }

    // Everything else, sub-points included, belongs to the open section. Text
    // before the first heading is front matter and is dropped.
    if (current) current.lines.push(line)
  }

  if (current) sections.push(finish(current))

  // A section that appears twice keeps the longer body. The document repeats its
  // headings in a summary list as well as the table of contents, and the summary
  // has no dot leaders to filter on.
  const best = new Map<string, SectionGuidance>()
  for (const section of sections) {
    const existing = best.get(section.formSection)
    if (!existing || section.text.length > existing.text.length) {
      best.set(section.formSection, section)
    }
  }

  return [...best.values()].sort(compareSectionNumbers)
}

function finish(current: { formSection: string; heading: string; lines: string[] }): SectionGuidance {
  return {
    formSection: current.formSection,
    heading: current.heading,
    text: current.lines
      .join('\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  }
}

/**
 * Numeric, part by part. String ordering puts 2.10 before 2.9, which is wrong
 * everywhere it appears and quietly wrong in a document a Board reads.
 */
export function compareSectionNumbers(a: { formSection: string }, b: { formSection: string }): number {
  const left = a.formSection.split('.').map(Number)
  const right = b.formSection.split('.').map(Number)

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}
