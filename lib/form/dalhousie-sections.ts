/**
 * The Dalhousie Research Ethics Board application form for prospective research,
 * as a structure.
 *
 * This is the target output shape and the spine of the whole build. Draft
 * assembly, intake questions and gap findings all key off these section numbers.
 *
 * VALIDATED against the real form on 2026-08-05:
 * `application-human-ethics-prospective-research.docx`, version April 2025, read
 * from the client's Drive folder. Numbers and titles below are the form's own.
 *
 * Corrections made at that validation, recorded because each was wrong in a way
 * that would have produced a misleading document:
 *
 * - 2.8 is "Indefinite retention", about keeping data for future unspecified
 *   research, and is not applicable to most studies. It had been modelled as
 *   ordinary retention and disposal. Ordinary retention lives at 2.7.2.
 * - Section 3, Appendices, was missing entirely. It is a checklist of material
 *   the researcher must append, and several sections of the form require an
 *   appendix before the Board will review the submission.
 * - 2.5 is "Informed consent process", 2.6 is "Methods, data collection and
 *   analysis", 2.10 is "Provision of results to participants and dissemination
 *   plans", 2.15 is "Use of personal health information". The shorter titles
 *   previously used dropped scope the Board expects to see covered.
 * - 2.1 has a second part, 2.1.2 Phased review.
 *
 * The 500-word cap on 2.1.1 is confirmed correct.
 */

export type SectionGeneration =
  /** The app may draft this section with model assistance. */
  | 'ai_assisted'
  /** Filled from stored profile or project data. No model call. */
  | 'from_record'
  /** The researcher assembles this themselves. The tool lists what is needed. */
  | 'researcher_completes'
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
  /** True where the form itself offers a "Not applicable" checkbox. */
  conditional?: boolean
  /** Shown to the researcher when this section is routed rather than drafted. */
  routingNote?: string
}

export const FORM_SECTIONS: FormSection[] = [
  {
    number: '1',
    title: 'Administrative information',
    generation: 'from_record',
  },
  {
    number: '2.1',
    title: 'Lay summary',
    generation: 'ai_assisted',
    wordLimit: 500,
  },
  { number: '2.2', title: 'Research question', generation: 'ai_assisted' },
  { number: '2.3', title: 'Study population', generation: 'ai_assisted' },
  { number: '2.4', title: 'Recruitment', generation: 'ai_assisted' },
  { number: '2.5', title: 'Informed consent process', generation: 'ai_assisted' },
  {
    number: '2.6',
    title: 'Methods, data collection and analysis',
    generation: 'ai_assisted',
  },
  { number: '2.7', title: 'Privacy and confidentiality', generation: 'ai_assisted' },
  {
    number: '2.8',
    title: 'Indefinite retention of research data and biological materials',
    generation: 'ai_assisted',
    // "Not applicable" unless data is kept for future unspecified research.
    conditional: true,
  },
  { number: '2.9', title: 'Risk and benefit analysis', generation: 'ai_assisted' },
  {
    number: '2.10',
    title: 'Provision of results to participants and dissemination plans',
    generation: 'ai_assisted',
  },
  { number: '2.11', title: 'Research team', generation: 'from_record' },
  {
    number: '2.12',
    title: 'Conflict of interest',
    generation: 'ai_assisted',
    conditional: true,
  },
  {
    number: '2.13',
    title: 'Research involving Indigenous peoples',
    generation: 'routed_to_human',
    conditional: true,
    routingNote:
      'Research involving Indigenous peoples is governed by TCPS 2 Articles 9.1 and 9.2, by OCAP principles, and by community protocols that a drafting tool is not positioned to interpret. This section also asks whether approval has been sought from Mi’kmaw Ethics Watch. Research Ethics Board Assistant will not draft it. Please speak with the Research Ethics Office and with the relevant community before continuing.',
  },
  {
    number: '2.14',
    title: 'Clinical trials',
    generation: 'ai_assisted',
    conditional: true,
  },
  {
    number: '2.15',
    title: 'Use of personal health information',
    generation: 'ai_assisted',
    conditional: true,
  },
  {
    number: '3',
    title: 'Appendices',
    generation: 'researcher_completes',
  },
]

/**
 * Material the form requires as an appendix. Several of these must be secured
 * before the Board will consider the submission at all, which is worth surfacing
 * early rather than at the point of submitting.
 */
export const APPENDIX_CHECKLIST: { label: string; requiredWhen?: string }[] = [
  { label: 'Recruitment documents: posters, scripts, postings, invitations' },
  {
    label: 'Permission or cooperation letters from any third party assisting recruitment',
    requiredWhen: 'Required before review if a third party is involved (2.4.1)',
  },
  { label: 'Screening documents' },
  { label: 'Consent and assent documents or scripts' },
  { label: 'Research instruments: questionnaires, interview or focus group questions' },
  { label: 'Research agreements applicable to this study' },
  {
    label: 'Collaborative research agreements with Indigenous communities',
    requiredWhen: 'Where section 2.13 applies',
  },
  { label: 'Data transfer or data sharing agreements' },
  { label: 'Material transfer agreements' },
  { label: 'Debriefing or study results templates' },
  { label: 'List of data fields included in a data repository' },
  {
    label: 'Confidentiality agreements for anyone transcribing recordings',
    requiredWhen: 'Where a transcriptionist is hired (2.6.3)',
  },
  { label: 'Reference list' },
]

/**
 * The 500-word cap sits on the lay summary specifically, at 2.1.1. Keyed
 * separately because the form applies limits at subsection level.
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
