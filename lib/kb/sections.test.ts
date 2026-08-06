import { describe, expect, it } from 'vitest'

import { compareSectionNumbers, splitGuidanceBySection } from './sections'

/**
 * Written against the shape of the real Dalhousie guidelines document, which
 * repeats every heading in a table of contents before the body starts. Splitting
 * naively yields twenty empty sections followed by twenty real ones, and the
 * empty ones win if the last occurrence is kept.
 */

const SAMPLE = `
Research Ethics ethics@dal.ca Version date: 2025-10
Application Instructions

2.3 Study Population ...................................................... 4
2.4 Recruitment ........................................................... 5
2.10 Provision of Results .................................................. 9

2.3 Study Population
2.3.1 The description of the study population should include any and all characteristics
relevant to the research question.
2.3.2 Justification should be provided for the sample size sought.

2.4 Recruitment
2.4.1 If the permission of organizations is needed, describe it here.
2.4.2 Specify the documents that will be used.

2.10 Provision of Results
2.10.1 Describe what participants will receive.
`.trim()

describe('splitGuidanceBySection', () => {
  const sections = splitGuidanceBySection(SAMPLE)

  it('finds each section once, not once per table of contents entry', () => {
    expect(sections.map((section) => section.formSection)).toEqual(['2.3', '2.4', '2.10'])
  })

  it('keeps the body rather than the empty table of contents entry', () => {
    const recruitment = sections.find((section) => section.formSection === '2.4')!
    expect(recruitment.text).toContain('permission of organizations')
    expect(recruitment.text).not.toMatch(/\.{4,}/)
  })

  it('gathers the numbered sub-points under their section', () => {
    const population = sections.find((section) => section.formSection === '2.3')!
    expect(population.text).toContain('2.3.1')
    expect(population.text).toContain('2.3.2')
    // And does not bleed into the next section.
    expect(population.text).not.toContain('Recruitment')
  })

  it('reads the heading without its number', () => {
    expect(sections.find((section) => section.formSection === '2.4')!.heading).toBe('Recruitment')
  })

  // The ordering trap that has already caught this project once.
  it('orders 2.10 after 2.4, not between 2.1 and 2.2', () => {
    expect(sections.at(-1)!.formSection).toBe('2.10')
  })

  it('drops front matter appearing before the first section', () => {
    expect(sections.every((section) => !section.text.includes('ethics@dal.ca'))).toBe(true)
  })
})

describe('compareSectionNumbers', () => {
  it('sorts numerically part by part', () => {
    const sorted = [
      { formSection: '2.10' },
      { formSection: '2.2' },
      { formSection: '2.9' },
      { formSection: '1.1' },
    ].sort(compareSectionNumbers)

    expect(sorted.map((entry) => entry.formSection)).toEqual(['1.1', '2.2', '2.9', '2.10'])
  })
})
