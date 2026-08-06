import {
  FORM_SECTIONS,
  countWords,
  isGenerationBlocked,
  wordLimitFor,
  type FormSection,
} from '@/lib/form/dalhousie-sections'
import { allQuestions } from '@/lib/intake/questions'
import { boardDisclosure } from '@/lib/disclosure/text'
import type { AnswerMap, Draft, Project } from '@/lib/data/types'

/**
 * Draft assembly.
 *
 * Turns a project and its answers into the application, section by section,
 * against the form's own numbering. This is deliberately separate from anything
 * that calls a model: assembly decides what belongs where, what is missing, and
 * what must not be generated. Drafting prose is a later step that fills in the
 * `awaiting_drafting` sections.
 *
 * That separation is why this works today with no API key. What comes out is a
 * complete, correctly structured document in which the researcher's own words
 * appear under the section they belong to, and every section the tool has not
 * written says so plainly rather than appearing finished.
 *
 * Guardrail 6 runs through all of it. Nothing here says a section is adequate,
 * compliant or approved. It reports what is present and what is not.
 */

export type DraftSectionStatus =
  /** Filled from stored project or profile data. No model involved. */
  | 'from_record'
  /** The tool may draft this, but has not yet. */
  | 'awaiting_drafting'
  /** Drafted with model assistance. Recorded for disclosure. */
  | 'ai_drafted'
  /** Guardrail 4. The tool will not draft this. */
  | 'routed'
  /** Nothing supplied and nothing to draft from. */
  | 'no_answers_yet'

export interface SourceAnswer {
  question: string
  answer: string
}

export interface DraftSection {
  number: string
  title: string
  status: DraftSectionStatus
  /** Drafted prose, once drafting exists. Empty until then. */
  content: string
  /** The researcher's own answers feeding this section, shown verbatim. */
  sources: SourceAnswer[]
  /** Explains a routed or undrafted section to the reader. */
  note?: string
  wordLimit?: number
  wordCount: number
  /** Advisory. The form states the cap; the Board applies it. */
  overWordLimit: boolean
  /**
   * Guardrail 4. True when the tool will not draft this section, either because
   * it is always routed or because triage flagged the project. Tracked
   * separately from `status`, since a blocked section may also be waiting for
   * answers, and the disclosure has to name it either way.
   */
  blockedFromDrafting: boolean
}

export interface DraftPackage {
  title: string
  institution: string
  generatedAt: string
  sections: DraftSection[]
  disclosure: string
  /** Sections with no answers behind them yet. Advisory, for the researcher. */
  incompleteSections: string[]
}

export interface AssembleInput {
  project: Project
  answers: AnswerMap
  /** Current drafted sections. Absent means nothing has been drafted yet. */
  drafts?: Draft[]
  /** Injected so the output is reproducible in tests. */
  now?: Date
}

export function assembleDraft({ project, answers, drafts, now }: AssembleInput): DraftPackage {
  const flags = {
    indigenous: project.involvesIndigenousResearch,
    communityEngaged: project.involvesCommunityEngagedResearch,
  }

  const sources = sourcesBySection(answers)
  const bySection = new Map((drafts ?? []).map((draft) => [draft.formSection, draft]))

  const sections = FORM_SECTIONS.map((section) =>
    buildSection(section, sources[section.number] ?? [], flags, project, bySection.get(section.number)),
  )

  const aiAssistedSections = sections
    .filter((section) => section.status === 'ai_drafted')
    .map((section) => section.number)

  // Everything the tool declined to draft, not only the always-routed section.
  // A project flagged as community-engaged has 2.3 to 2.5 withheld too, and a
  // disclosure that named only 2.13 would understate what was excluded.
  const routedSections = sections
    .filter((section) => section.blockedFromDrafting)
    .map((section) => section.number)

  return {
    title: project.title,
    institution: project.institution,
    generatedAt: (now ?? new Date()).toISOString(),
    sections,
    disclosure: boardDisclosure({ aiAssistedSections, routedSections }),
    incompleteSections: sections
      .filter((section) => section.status === 'no_answers_yet')
      .map((section) => section.number),
  }
}

function buildSection(
  section: FormSection,
  sources: SourceAnswer[],
  flags: { indigenous: boolean; communityEngaged: boolean },
  project: Project,
  draft?: Draft,
): DraftSection {
  const wordLimit = wordLimitFor(section.number)
  const blocked = isGenerationBlocked(section.number, flags)

  // Guardrail 4 first, before anything else can fill this section in.
  if (section.generation === 'routed_to_human') {
    return {
      number: section.number,
      title: section.title,
      status: 'routed',
      content: '',
      sources,
      note:
        section.routingNote ??
        'This section is not drafted by Research Ethics Board Assistant. Please prepare it directly.',
      wordLimit,
      wordCount: 0,
      overWordLimit: false,
      blockedFromDrafting: true,
    }
  }

  // Sections filled from stored data rather than drafted. Section 1 has project
  // details to show; 2.11 is completed on the form itself. Neither is "no
  // answers captured", which is what they read as before this branch existed.
  if (section.generation === 'from_record') {
    const content = section.number === '1' ? administrativeSection(project) : ''
    return {
      number: section.number,
      title: section.title,
      status: 'from_record',
      content,
      sources,
      note:
        section.number === '1'
          ? 'Team details, funding and attestations are completed by the research team on the form itself.'
          : 'Completed by the research team on the form itself, from your saved researcher details.',
      wordLimit,
      wordCount: countWords(content),
      overWordLimit: false,
      blockedFromDrafting: blocked,
    }
  }

  // A drafted section, if one exists and the section is not blocked. The guard
  // matters: a project flagged after a section was drafted must stop showing
  // that draft, or guardrail 4 would hold only for projects flagged early.
  if (draft && !blocked) {
    const wordCount = draft.wordCount ?? countWords(draft.content)
    return {
      number: section.number,
      title: section.title,
      status: draft.aiGenerated ? 'ai_drafted' : 'from_record',
      content: draft.content,
      sources,
      note: draft.aiGenerated
        ? 'Drafted with AI assistance from your answers. Read it closely before you submit: you are responsible for what it says.'
        : undefined,
      wordLimit,
      wordCount,
      overWordLimit: wordLimit !== undefined && wordCount > wordLimit,
      blockedFromDrafting: false,
    }
  }

  if (sources.length === 0) {
    return {
      number: section.number,
      title: section.title,
      status: 'no_answers_yet',
      content: '',
      sources,
      note: blocked
        ? 'No answers captured yet. Flagged during triage, so this section will not be drafted by the tool either.'
        : 'No answers captured for this section yet.',
      wordLimit,
      wordCount: 0,
      overWordLimit: false,
      blockedFromDrafting: blocked,
    }
  }

  // Drafting is not wired yet, so nothing here is model-generated. The section
  // carries the researcher's own answers and says it has not been drafted, which
  // keeps the disclosure honest: with no AI-drafted sections, the disclosure
  // says exactly that.
  return {
    number: section.number,
    title: section.title,
    status: 'awaiting_drafting',
    content: '',
    sources,
    note: blocked
      ? 'Flagged during triage. Research Ethics Board Assistant will not draft this section. Your answers are below, to write up directly.'
      : 'Not yet drafted. Your answers are below, in the order they were asked.',
    wordLimit,
    wordCount: 0,
    overWordLimit: false,
    blockedFromDrafting: blocked,
  }
}

function administrativeSection(project: Project): string {
  return [
    `Project title: ${project.title}`,
    `Institution: ${project.institution}`,
    'Principal Investigator: to be completed by the research team.',
    'Funding: to be completed by the research team.',
    'Attestations: to be signed by the research team on the form itself.',
  ].join('\n')
}

/** Groups answers under the form section each question declares. */
function sourcesBySection(answers: AnswerMap): Record<string, SourceAnswer[]> {
  const grouped: Record<string, SourceAnswer[]> = {}

  for (const question of allQuestions()) {
    const answer = answers[question.key]
    if (!answer || answer.trim().length === 0) continue
    if (!question.formSection) continue

    const list = (grouped[question.formSection] ??= [])
    list.push({ question: question.label, answer: readable(question, answer) })
  }

  return grouped
}

/** Turns a stored choice value back into the wording the researcher saw. */
function readable(
  question: { options?: { value: string; label: string }[] },
  answer: string,
): string {
  const option = question.options?.find((candidate) => candidate.value === answer)
  return option ? option.label : answer
}
