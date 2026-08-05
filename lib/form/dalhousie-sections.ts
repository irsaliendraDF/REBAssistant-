/**
 * The Dalhousie REB application form for prospective research, as a structure.
 *
 * This is the target output shape and the spine of the whole build. Draft
 * assembly, intake questions and gap findings all key off these section numbers.
 *
 * PROVISIONAL. The section list and titles below come from the build plan's
 * description of `application-human-ethics-prospective-research.docx`. The real
 * form has not been ingested yet. When it lands in `knowledge-base/source/`,
 * verify every number, title, word limit and subsection against it and correct
 * this file. It is the one place that needs correcting, which is the point of
 * keeping it here rather than scattering section numbers through the code.
 */

export type SectionGeneration =
  /** The app may draft this section with model assistance. */
  | 'ai_assisted'
  /** Filled from stored profile or project data. No model call. */
  | 'from_record'
  /**
   * Guardrail 4. Never generated. Flagged during triage and routed to a person.
   */
  | 'routed_to_human'

export interface FormSection {
  /** The form's own number, used as the key everywhere else. */
  number: string
  title: string
  generation: SectionGeneration
  /** Word cap where the form states one. */
  wordLimit?: number
  /** Shown to the researcher when this section is routed rather than drafted. */
  routingNote?: string
}

export const FORM_SECTIONS: FormSection[] = [
  {
    number: '1',
    title: 'Administrative information, research team, funding and attestations',
    generation: 'from_record',
  },
  {
    number: '2.1',
    title: 'Lay summary',
    generation: 'ai_assisted',
    wordLimit: 500,
  },
  { number: '2.2', title: 'Research question and objectives', generation: 'ai_assisted' },
  { number: '2.3', title: 'Study population', generation: 'ai_assisted' },
  { number: '2.4', title: 'Recruitment', generation: 'ai_assisted' },
  { number: '2.5', title: 'Consent process', generation: 'ai_assisted' },
  { number: '2.6', title: 'Methods and procedures', generation: 'ai_assisted' },
  { number: '2.7', title: 'Privacy and confidentiality', generation: 'ai_assisted' },
  { number: '2.8', title: 'Data retention and disposal', generation: 'ai_assisted' },
  { number: '2.9', title: 'Risk and benefit', generation: 'ai_assisted' },
  { number: '2.10', title: 'Dissemination of results', generation: 'ai_assisted' },
  { number: '2.11', title: 'Research team', generation: 'from_record' },
  { number: '2.12', title: 'Conflict of interest', generation: 'ai_assisted' },
  {
    number: '2.13',
    title: 'Research involving Indigenous Peoples',
    generation: 'routed_to_human',
    routingNote:
      'Research involving Indigenous Peoples is governed by TCPS2 Chapter 9 and by community protocols that a drafting tool is not positioned to interpret. REB Assistant will not draft this section. Please speak with the Research Ethics Office and the relevant community before continuing.',
  },
  { number: '2.14', title: 'Clinical trials', generation: 'ai_assisted' },
  { number: '2.15', title: 'Personal health information', generation: 'ai_assisted' },
]

/**
 * The 500-word cap sits on the lay summary specifically. Keyed separately
 * because the form applies limits at subsection level in places.
 */
export const WORD_LIMITS: Record<string, number> = {
  '2.1': 500,
  '2.1.1': 500,
}

export const SECTIONS_BY_NUMBER: Record<string, FormSection> = Object.fromEntries(
  FORM_SECTIONS.map((section) => [section.number, section]),
)

export function getSection(number: string): FormSection | undefined {
  return SECTIONS_BY_NUMBER[number]
}

export function wordLimitFor(number: string): number | undefined {
  return WORD_LIMITS[number] ?? SECTIONS_BY_NUMBER[number]?.wordLimit
}

/**
 * Guardrail 4 in one call. A section is blocked from generation either because
 * it is always routed to a human, or because triage flagged the project as
 * involving Indigenous or community-engaged research.
 */
export function isGenerationBlocked(
  number: string,
  flags: { indigenous: boolean; communityEngaged: boolean },
): boolean {
  const section = SECTIONS_BY_NUMBER[number]
  if (!section) return false
  if (section.generation === 'routed_to_human') return true
  return flags.indigenous || flags.communityEngaged
    ? ['2.3', '2.4', '2.5', '2.13'].includes(number)
    : false
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
