import {
  FORM_SECTIONS,
  countWords,
  isGenerationBlocked,
  wordLimitFor,
  type FormSection,
} from '@/lib/form/dalhousie-sections'
import {
  formNumbersFor,
  formQuestionsFor,
  printSectionFor,
  toolCoveredNumbers,
} from '@/lib/form/dalhousie-questions'
import { allQuestions, visibleSections } from '@/lib/intake/questions'
import { boardDisclosure } from '@/lib/disclosure/text'
import { suggestCompanionDocuments, type CompanionDocument } from '@/lib/documents/companions'
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
  /** For a choice question: every option, with the one the researcher picked marked. */
  choices?: { label: string; selected: boolean }[]
}

export type DraftPartStatus =
  /** The researcher's own answers sit under this form question. */
  | 'answered'
  /** Drafted with model assistance from those answers. */
  | 'drafted'
  /** The tool asks this form question and the researcher has not answered it yet. */
  | 'unanswered'
  /** The tool never asks this form question. The researcher completes it on the form. */
  | 'not_asked'
  /** Completed on the form by design, such as names and contact details. */
  | 'for_form'
  /** Guardrail 4. The tool will not write this. */
  | 'routed'

/**
 * One numbered question on the Dalhousie form, with whatever the tool holds for
 * it. The Word document prints these in the form's own order so the researcher
 * can copy across number to number.
 */
export interface DraftPart {
  number: string
  label: string
  status: DraftPartStatus
  answers: SourceAnswer[]
  /** Model-drafted text for this question, when the draft was split by question. */
  drafted?: string
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
  /** The form's numbered questions within this section, in the form's order. */
  parts: DraftPart[]
}

export interface DraftPackage {
  title: string
  institution: string
  generatedAt: string
  sections: DraftSection[]
  disclosure: string
  /** Sections with no answers behind them yet. Advisory, for the researcher. */
  incompleteSections: string[]
  /**
   * The appendices this study's answers point at: consent forms, instruments,
   * permission letters. They travel with the document because the document is
   * what the researcher works from once they have left the tool, and a Board
   * asks for these alongside the application rather than after it.
   */
  companionDocuments: CompanionDocument[]
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

  const applicable = applicableSections(answers)

  const sections = FORM_SECTIONS.filter(
    (section) => !section.conditional || applicable.has(section.number),
  ).map((section) =>
    buildSection(section, sources[section.number] ?? [], flags, project, bySection.get(section.number), {
      byNumber: answersByFormNumber(answers),
      answers,
      project,
    }),
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
    companionDocuments: suggestCompanionDocuments(project, answers),
  }
}

/**
 * Which conditional form sections this study actually has.
 *
 * `conditional` was declared on the form sections and read by the intake list,
 * which correctly adds and removes 2.8, 2.14 and 2.15 as their gates are
 * answered. Assembly ignored it until 22 September 2026, so a study that had
 * answered no to clinical trials still got "2.14 Clinical trials, no answers
 * captured yet" in its Word document. To a Board that reads as a section left
 * unanswered rather than one that does not apply, which is a worse thing to hand
 * over than nothing at all.
 *
 * The intake list is the source of truth for the answer-driven ones, so this
 * asks it rather than restating its rules.
 *
 * **2.13 always stays, whatever triage said, and that is guardrail 4 rather than
 * an oversight.** It has no intake section because research involving Indigenous
 * Peoples is routed to a person and never drafted. Dropping it for a study that
 * answered no would mean the one section the tool must never write could vanish
 * on the strength of a single self-reported answer, and the disclosure to the
 * Board would stop naming it. A researcher who answered no and was wrong is
 * exactly the case the guardrail is for.
 */
function applicableSections(answers: AnswerMap): Set<string> {
  const numbers = new Set(
    visibleSections(answers)
      .map((section) => section.formSection)
      .filter((number): number is string => Boolean(number)),
  )

  numbers.add('2.13')

  return numbers
}

function buildSectionBase(
  section: FormSection,
  sources: SourceAnswer[],
  flags: { indigenous: boolean; communityEngaged: boolean },
  project: Project,
  draft?: Draft,
): Omit<DraftSection, 'parts'> {
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

interface PartsContext {
  byNumber: Record<string, SourceAnswer[]>
  answers: AnswerMap
  project: Project
}

/**
 * A section together with the form's numbered questions inside it.
 *
 * Added 31 October 2026 after KJ's feedback that the Word download groups answers
 * by section while the form asks numbered questions, so every answer was copied
 * across by hand. The section-level fields are unchanged; `parts` is what the
 * document prints.
 */
function buildSection(
  section: FormSection,
  sources: SourceAnswer[],
  flags: { indigenous: boolean; communityEngaged: boolean },
  project: Project,
  draft: Draft | undefined,
  context: PartsContext,
): DraftSection {
  const base = buildSectionBase(section, sources, flags, project, draft)
  const covered = toolCoveredNumbers(section.number)

  // A drafted section may arrive split by form question. Split it here, so the
  // screen shows clean prose and the document can print each piece under its own
  // number. Older drafts carry no markers and stay whole.
  if (base.status === 'ai_drafted') {
    const split = splitDraft(base.content, covered)
    const wordLimit = base.wordLimit
    const wordCount = countWords(split.text)
    return {
      ...base,
      content: split.text,
      wordCount,
      overWordLimit: wordLimit !== undefined && wordCount > wordLimit,
      parts: buildParts(section, context, split.parts),
    }
  }

  return { ...base, parts: buildParts(section, context, {}) }
}

const PART_MARKER = /^\[\[(\d+(?:\.\d+)+)\]\][ \t]*$/gm

/**
 * Splits drafted prose by form question.
 *
 * The drafting prompt asks the model to put `[[2.3.1]]` on its own line before
 * each answer where a section holds more than one question the tool covers. This
 * reads those markers back. With no markers and exactly one covered question, the
 * whole text belongs to that question. With no markers and several, the text
 * stays whole and the document prints it once for the section, so a model that
 * ignores the format costs layout and never loses text.
 */
export function splitDraft(
  content: string,
  covered: string[],
): { text: string; parts: Record<string, string> } {
  const markers = [...content.matchAll(PART_MARKER)]

  if (markers.length === 0) {
    return { text: content, parts: covered.length === 1 ? { [covered[0]]: content } : {} }
  }

  const parts: Record<string, string> = {}
  markers.forEach((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length
    const end = index + 1 < markers.length ? (markers[index + 1].index ?? content.length) : content.length
    const text = content.slice(start, end).trim()
    if (text) parts[marker[1]] = parts[marker[1]] ? `${parts[marker[1]]}\n\n${text}` : text
  })

  const text = content.replace(PART_MARKER, '').replace(/\n{3,}/g, '\n\n').trim()
  return { text, parts }
}

function buildParts(
  section: FormSection,
  context: PartsContext,
  drafted: Record<string, string>,
): DraftPart[] {
  if (section.number === '1') return administrativeParts(context)

  const covered = new Set(toolCoveredNumbers(section.number))

  return formQuestionsFor(section.number).map((question) => {
    if (section.generation === 'routed_to_human') {
      return { number: question.number, label: question.label, status: 'routed' as const, answers: [] }
    }
    if (section.generation === 'from_record') {
      return { number: question.number, label: question.label, status: 'for_form' as const, answers: [] }
    }

    const answers = context.byNumber[question.number] ?? []
    const text = drafted[question.number]

    return {
      number: question.number,
      label: question.label,
      status: text
        ? ('drafted' as const)
        : answers.length > 0
          ? ('answered' as const)
          : covered.has(question.number)
            ? ('unanswered' as const)
            : ('not_asked' as const),
      answers,
      ...(text ? { drafted: text } : {}),
    }
  })
}

/**
 * Section 1 holds names, Banner numbers, phone numbers and attestations. The tool
 * is built never to ask for people's details, so only the title and the Board the
 * researcher preferred are filled; the rest print as labelled blanks.
 */
function administrativeParts(context: PartsContext): DraftPart[] {
  const boardQuestion = allQuestions().find((question) => question.key === 'triage.board')
  const boardAnswer = context.answers['triage.board']
  const board = boardQuestion && boardAnswer ? readable(boardQuestion, boardAnswer) : null

  const parts: DraftPart[] = [
    {
      number: 'Title',
      label: 'Project title',
      status: 'answered',
      answers: [{ question: 'Working title', answer: context.project.title }],
    },
    board
      ? {
          number: 'Board',
          label: 'Preferred Research Ethics Board',
          status: 'answered',
          answers: [{ question: boardQuestion!.label, answer: board }],
        }
      : { number: 'Board', label: 'Preferred Research Ethics Board', status: 'for_form', answers: [] },
  ]

  const blanks: [string, string][] = [
    ['1.1', 'Research team information'],
    ['1.2', 'Academic and supervisor information'],
    ['1.3', 'Other reviews'],
    ['1.4', 'Funding'],
    ['1.5', 'Attestations'],
  ]
  for (const [number, label] of blanks) {
    parts.push({ number, label, status: 'for_form', answers: [] })
  }

  return parts
}

/** Every answer the researcher gave, grouped under the form question it prints at. */
function answersByFormNumber(answers: AnswerMap): Record<string, SourceAnswer[]> {
  const grouped: Record<string, SourceAnswer[]> = {}

  for (const question of allQuestions()) {
    const answer = answers[question.key]
    if (!answer || answer.trim().length === 0) continue

    for (const number of formNumbersFor(question.key)) {
      const entry: SourceAnswer = { question: question.label, answer: readable(question, answer) }
      if (question.type === 'choice' && question.options) {
        entry.choices = question.options.map((option) => ({
          label: option.label,
          selected: option.value === answer,
        }))
      }
      ;(grouped[number] ??= []).push(entry)
    }
  }

  return grouped
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

    // The section the answer prints in, which is the section of its form question.
    // Two questions are asked in one intake section and printed in another, so
    // drafting must read them where they print.
    const section = printSectionFor(question.key, question.formSection)
    if (!section) continue

    const list = (grouped[section] ??= [])
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
