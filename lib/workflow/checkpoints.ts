import type { AnswerMap, Draft, MethodInterpretation, Project } from '@/lib/data/types'
import { countWords, wordLimitFor } from '@/lib/form/dalhousie-sections'
import { analyseGaps, countBySeverity } from '@/lib/gaps/analyse'
import {
  TRIAGE_QUESTIONS,
  allQuestions,
  missingRequired,
  visibleSections,
  type IntakeSection,
  type Question,
} from '@/lib/intake/questions'

import { STATE_DEFINITIONS, type ProjectState } from './states'

/**
 * Checkpoints.
 *
 * A stop between every pair of stages. The researcher is shown what the stage
 * they are leaving actually captured, what confirming will start, and anything
 * worth knowing before it does. Nothing moves until they press the button on
 * that screen.
 *
 * This is guardrail 3 made visible. The workflow already refused to advance
 * without a user action, but "Save and Continue" at the bottom of a form is an
 * action a person takes without reading what is above it. A checkpoint puts a
 * summary between the two stages, so the explicit action is explicit about what
 * it is agreeing to.
 *
 * Guardrail 6 governs the wording, as it does in gap analysis. A checkpoint
 * reports what is there. It does not say a stage is complete, adequate or done
 * well, and it mostly does not block: `blockers` carries only what the workflow
 * itself cannot proceed without, such as a required question with no answer, or
 * a reading of the methodology nobody has answered. Everything else is a note
 * the researcher weighs.
 */

export type CheckpointId = 'triage' | 'intake' | 'method_check' | 'draft' | 'gap_analysis'

export interface CheckpointDefinition {
  id: CheckpointId
  from: ProjectState
  to: ProjectState
  title: string
  /** What the researcher is looking at, and why it is in front of them. */
  intro: string
  /** What confirming starts. Stated before they confirm, not after. */
  next: string
  confirmLabel: string
  backLabel: string
}

export interface CheckpointItem {
  label: string
  detail: string
  /** A second line, where the first needs qualifying. */
  note?: string
  /** The form section this line is about, for a link back into it. */
  formSection?: string
}

export interface CheckpointSummary {
  definition: CheckpointDefinition
  /** What the stage being left captured, read back. */
  captured: CheckpointItem[]
  /** Worth knowing before continuing. Never blocking. */
  notes: string[]
  /**
   * Why the workflow cannot continue yet. Rare, and never a matter of judgement:
   * a required answer that is not there, a reading that is unresolved. The same
   * conditions are re-checked on the server when the researcher confirms.
   */
  blockers: string[]
}

export const CHECKPOINTS: Record<CheckpointId, CheckpointDefinition> = {
  triage: {
    id: 'triage',
    from: 'triage',
    to: 'intake',
    title: 'Checkpoint: Before Intake',
    intro:
      'This is what the opening questions captured. Read it back before intake starts, because two of these answers decide which parts of the application the tool will draft at all.',
    next: 'Intake asks about the research one form section at a time. You can save and leave at any point, and come back to any section afterwards.',
    confirmLabel: 'Confirm and Continue to Intake',
    backLabel: 'Go Back and Change an Answer',
  },
  intake: {
    id: 'intake',
    from: 'intake',
    to: 'method_check',
    title: 'Checkpoint: Before the Method Check',
    intro:
      'This is what intake captured, section by section. Anything left blank here stays blank in the draft, so the count on each line is worth reading.',
    next: 'Confirming builds the tool’s reading of your methodology from the answers as they now stand. That is one call to the AI model and takes a few seconds. You then confirm, correct or reject each reading.',
    confirmLabel: 'Confirm and Build the Method Reading',
    backLabel: 'Go Back to Intake',
  },
  method_check: {
    id: 'method_check',
    from: 'method_check',
    to: 'draft',
    title: 'Checkpoint: Before Drafting',
    intro:
      'This is how the tool understood your methodology, and what you said about each reading. Drafting works from your intake answers, so a reading you corrected is a signal to check the answer behind it.',
    next: 'Drafting is one section at a time, and only when you ask for it. Every section a model writes is recorded as AI-assisted and named in the disclosure that goes to the Board.',
    confirmLabel: 'Confirm and Continue to Drafting',
    backLabel: 'Go Back to the Readings',
  },
  draft: {
    id: 'draft',
    from: 'draft',
    to: 'gap_analysis',
    title: 'Checkpoint: Before Gap Analysis',
    intro:
      'This is the state of the document you are carrying forward. Sections with nothing behind them travel into the download labelled as not drafted, rather than quietly looking finished.',
    next: 'Gap analysis points at what looks missing, thin or inconsistent, with the relevant guidance. They are observations, not conditions to satisfy.',
    confirmLabel: 'Confirm and Continue to Gap Analysis',
    backLabel: 'Go Back to Drafting',
  },
  gap_analysis: {
    id: 'gap_analysis',
    from: 'gap_analysis',
    to: 'complete',
    title: 'Checkpoint: Before You Finish',
    intro:
      'This is what the checks raised, and what is still outstanding. You can finish with findings outstanding: the Board decides what matters, and you decide what to act on.',
    next: 'The last step gives you the document to download, and the companion documents this study still needs alongside it, such as consent forms, instruments and permission letters.',
    confirmLabel: 'Confirm and Mark Ready to Review',
    backLabel: 'Go Back to the Findings',
  },
}

/** The checkpoint a project in this state is heading for, if any. */
export function checkpointFor(state: ProjectState): CheckpointDefinition | null {
  return (CHECKPOINTS as Record<string, CheckpointDefinition | undefined>)[state] ?? null
}

/**
 * Whether a checkpoint id names the checkpoint this project is actually at. A
 * parameter in a URL is a request, not a fact about the project.
 */
export function isCheckpointFor(state: ProjectState, id: string | undefined): boolean {
  const definition = checkpointFor(state)
  return definition !== null && definition.id === id
}

export interface CheckpointInput {
  project: Project
  answers: AnswerMap
  interpretations?: MethodInterpretation[]
  drafts?: Draft[]
}

export function buildCheckpoint(input: CheckpointInput): CheckpointSummary | null {
  const definition = checkpointFor(input.project.state)
  if (!definition) return null

  switch (definition.id) {
    case 'triage':
      return { definition, ...triageCheckpoint(input.project, input.answers) }
    case 'intake':
      return { definition, ...intakeCheckpoint(input.answers) }
    case 'method_check':
      return { definition, ...methodCheckCheckpoint(input.interpretations ?? []) }
    case 'draft':
      return { definition, ...draftCheckpoint(input.project, input.answers, input.drafts ?? []) }
    case 'gap_analysis':
      return { definition, ...gapCheckpoint(input.project, input.answers) }
  }
}

type CheckpointBody = Omit<CheckpointSummary, 'definition'>

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

function triageCheckpoint(project: Project, answers: AnswerMap): CheckpointBody {
  const summary = answers['triage.plain_summary'] ?? ''

  const captured: CheckpointItem[] = [
    { label: 'Working title', detail: project.title, formSection: '1' },
    {
      label: 'Board suggested',
      detail: choiceLabel('triage.board', answers),
      note:
        answers['triage.board'] === 'unsure'
          ? 'You are not sure yet. The Research Ethics Office routes it if you leave it open.'
          : undefined,
      formSection: '1',
    },
    {
      label: 'Where the information comes from',
      detail: choiceLabel('triage.data_source', answers),
    },
    {
      label: 'Plain-language summary',
      detail: summary.trim().length > 0 ? `${countWords(summary)} words captured` : 'Not answered',
      note: 'This becomes the raw material for the lay summary at 2.1, which the form caps at 500 words.',
      formSection: '2.1',
    },
  ]

  const notes: string[] = []

  if (project.routingNote) {
    notes.push(project.routingNote)
  }

  // "I am not sure" was counted as yes on the way in. A researcher who sees a
  // routing note without knowing that reads it as the tool having decided
  // something about their study that they never said.
  const unsure = ['triage.indigenous_research', 'triage.community_engaged'].filter(
    (key) => answers[key] === 'unsure',
  )
  if (unsure.length > 0) {
    notes.push(
      'You answered “I am not sure” on ' +
        (unsure.length === 1 ? 'one of the two questions' : 'both of the questions') +
        ' about Indigenous and community-engaged research. Not sure is treated as yes here, because the cost of flagging is a conversation and the cost of not flagging is a tool improvising on community protocols. If the answer turns out to be no, come back and change it.',
    )
  }

  if (answers['triage.data_source'] === 'existing') {
    notes.push(
      'You said the research uses only records that already exist. This form is for prospective research, where new information is collected. Check with the Research Ethics Office that it is the right form before you go much further.',
    )
  }

  return {
    captured,
    notes,
    blockers:
      missingRequired(TRIAGE_QUESTIONS, answers).length > 0
        ? ['Some of the opening questions do not have an answer yet. Go back and complete them.']
        : [],
  }
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

function intakeCheckpoint(answers: AnswerMap): CheckpointBody {
  const captured: CheckpointItem[] = []
  const optionalGaps: string[] = []
  const blockers: string[] = []

  for (const section of visibleSections(answers)) {
    const total = section.questions.length
    const answered = section.questions.filter(
      (question) => (answers[question.key] ?? '').trim().length > 0,
    ).length
    const missing = missingRequired(section.questions, answers)

    captured.push({
      label: `Section ${section.formSection}, ${section.title.toLowerCase()}`,
      detail: `${answered} of ${total} answered`,
      note: missing.length > 0 ? `${missing.length} required, still without an answer` : undefined,
      formSection: section.formSection,
    })

    if (missing.length > 0) {
      blockers.push(
        `Section ${section.formSection}, ${section.title.toLowerCase()}, has ${
          missing.length === 1 ? 'a required question' : `${missing.length} required questions`
        } without an answer.`,
      )
      continue
    }

    if (answered < total) {
      optionalGaps.push(section.formSection)
    }
  }

  const notes: string[] = []

  if (optionalGaps.length > 0) {
    notes.push(
      `Optional questions were left blank in section${optionalGaps.length === 1 ? '' : 's'} ${optionalGaps.join(', ')}. Optional in this tool is not the same as optional to the Board: it means the workflow will not stop for it.`,
    )
  }

  // Both of these open a section most studies never see, and both are easy to
  // have answered on the way past without noticing what they turned on.
  if (answers['intake.2_5.future_use'] === 'yes') {
    notes.push(
      'You said the data may be kept for future research, which opened section 2.8 and means participants have to consent to that separately, and must still be able to take part if they say no.',
    )
  }
  if (answers['intake.2_6.intervention'] === 'yes') {
    notes.push(
      'You said the research involves a health intervention or procedure, which opened the clinical trials section and points this application at the Health Sciences Board.',
    )
  }

  return { captured, notes, blockers }
}

// ---------------------------------------------------------------------------
// Method check
// ---------------------------------------------------------------------------

const RESPONSE_LABELS: Record<MethodInterpretation['response'], string> = {
  pending: 'Not answered yet',
  confirmed: 'Confirmed',
  altered: 'Corrected',
  rejected: 'Rejected',
}

function methodCheckCheckpoint(interpretations: MethodInterpretation[]): CheckpointBody {
  const captured: CheckpointItem[] = interpretations.map((interpretation) => ({
    label: RESPONSE_LABELS[interpretation.response],
    detail: interpretation.interpretation,
    note: interpretation.researcherCorrection
      ? `Your correction: ${interpretation.researcherCorrection}`
      : undefined,
    formSection: interpretation.formSection ?? undefined,
  }))

  const notes: string[] = []
  const altered = interpretations.filter((entry) => entry.response === 'altered')

  if (altered.length > 0) {
    notes.push(
      `You corrected ${
        altered.length === 1 ? 'one reading' : `${altered.length} readings`
      }. Your correction is kept with the application’s history, but drafting works from your intake answers rather than from the correction. If a correction changes what the study actually does, change the answer behind it too.`,
    )
  }

  if (interpretations.length === 0) {
    notes.push(
      'There are no readings to show. That happens when intake has not been completed since the last time this project was sent back to it.',
    )
  }

  const blockers: string[] = []
  const unresolved = interpretations.filter((entry) => entry.response === 'pending').length

  if (unresolved > 0) {
    blockers.push(
      `${
        unresolved === 1 ? 'One reading has' : `${unresolved} readings have`
      } not been answered yet.`,
    )
  }
  if (interpretations.some((entry) => entry.response === 'rejected')) {
    blockers.push(
      'A reading was rejected, which sends this project back to intake rather than on to drafting.',
    )
  }

  return { captured, notes, blockers }
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

function draftCheckpoint(project: Project, answers: AnswerMap, drafts: Draft[]): CheckpointBody {
  const aiDrafted = drafts.filter((draft) => draft.aiGenerated).map((draft) => draft.formSection)
  const edited = drafts.filter((draft) => draft.editedByHuman).map((draft) => draft.formSection)
  const withDrafts = new Set(drafts.map((draft) => draft.formSection))
  const undrafted = visibleSections(answers)
    .map((section) => section.formSection)
    .filter((number) => !withDrafts.has(number))

  const captured: CheckpointItem[] = [
    {
      label: 'Drafted with AI assistance',
      detail: describeSections(aiDrafted),
      note:
        aiDrafted.length > 0
          ? 'Named individually in the disclosure that travels with the document.'
          : undefined,
    },
    {
      label: 'Written or edited by you',
      detail: describeSections(edited),
    },
    {
      label: 'No draft yet',
      detail: describeSections(undrafted),
      note:
        undrafted.length > 0
          ? 'These appear in the download under their own heading, labelled as not drafted, with your answers beneath them.'
          : undefined,
    },
  ]

  const notes: string[] = []

  const overLimit = drafts.filter((draft) => {
    const limit = draft.wordLimit ?? wordLimitFor(draft.formSection)
    return limit !== undefined && (draft.wordCount ?? 0) > limit
  })
  if (overLimit.length > 0) {
    notes.push(
      `Section ${overLimit
        .map((draft) => draft.formSection)
        .join(', ')} ${overLimit.length === 1 ? 'is' : 'are'} over the word limit the form states. The form sets the cap; the Board applies it.`,
    )
  }

  if (project.routingNote) {
    notes.push(project.routingNote)
  }

  return { captured, notes, blockers: [] }
}

function describeSections(numbers: string[]): string {
  if (numbers.length === 0) return 'None'
  // Every section is listed, including one the form structure does not know
  // about. Dropping it would be this line quietly under-reporting what a model
  // wrote, which is the one thing the disclosure cannot afford.
  const unique = [...new Set(numbers)].sort(compareSectionNumbers)
  return `${unique.length} section${unique.length === 1 ? '' : 's'}: ${unique.join(', ')}`
}

/** '2.10' sorts after '2.9', which a string comparison gets backwards. */
function compareSectionNumbers(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

function gapCheckpoint(project: Project, answers: AnswerMap): CheckpointBody {
  const findings = analyseGaps(project, answers)
  const counts = countBySeverity(findings)

  const captured: CheckpointItem[] = [
    { label: 'Sections not complete', detail: String(counts.missing) },
    { label: 'Findings worth reviewing', detail: String(counts.worth_reviewing) },
    { label: 'Answers flagged as brief', detail: String(counts.thin) },
  ]

  const notes: string[] = [
    'Marking the application ready to review does not submit it and does not send it anywhere. It moves this project to its last step, where you download the document and see the companion documents to prepare alongside it.',
  ]

  if (findings.length > 0) {
    notes.push(
      `${
        findings.length === 1 ? 'One finding is' : `${findings.length} findings are`
      } outstanding. Finishing with findings outstanding is normal: they are observations for you to weigh, and this tool does not decide which of them matter.`,
    )
  }

  return { captured, notes, blockers: [] }
}

// ---------------------------------------------------------------------------
// Between one intake section and the next
// ---------------------------------------------------------------------------

/**
 * The smaller checkpoint, inside intake.
 *
 * Intake is nine or more sections down the left-hand list, and a researcher
 * works through it over weeks. The stage checkpoint at the end of all of them is
 * too late to be the only stop: by then a contradiction between section 2.6 and
 * section 2.7 is three weeks old and reads as someone else's mistake.
 *
 * So each section ends with its own read-back. The answers are shown as given,
 * with what this section just turned on, and with anything the gap rules already
 * know about it. Nothing new is invented here: the findings come from
 * `analyseGaps`, tagged to this section, rather than from a second copy of the
 * same rules that would drift from the first.
 *
 * This one moves no state. Sections are a route within intake, so confirming
 * goes to the next section, and the last one hands over to the stage checkpoint.
 */
export interface SectionCheckpointSummary {
  formSection: string
  title: string
  /** Where confirming goes. Null on the last section, which ends the stage. */
  next: { formSection: string; title: string } | null
  captured: CheckpointItem[]
  notes: string[]
  blockers: string[]
}

export interface SectionCheckpointInput {
  project: Project
  answers: AnswerMap
  formSection: string
}

export function buildSectionCheckpoint({
  project,
  answers,
  formSection,
}: SectionCheckpointInput): SectionCheckpointSummary | null {
  const sections = visibleSections(answers)
  const index = sections.findIndex((section) => section.formSection === formSection)
  const section = sections[index]
  if (!section) return null

  const next = sections[index + 1]
  const missing = missingRequired(section.questions, answers)

  return {
    formSection: section.formSection,
    title: section.title,
    next: next ? { formSection: next.formSection, title: next.title } : null,
    captured: section.questions.map((question) => capturedAnswer(question, answers)),
    notes: sectionNotes(project, answers, section),
    blockers:
      missing.length > 0
        ? [
            `${
              missing.length === 1 ? 'A required question' : `${missing.length} required questions`
            } in this section still need an answer.`,
          ]
        : [],
  }
}

function capturedAnswer(question: Question, answers: AnswerMap): CheckpointItem {
  const answer = (answers[question.key] ?? '').trim()

  if (answer.length === 0) {
    return {
      label: question.label,
      detail: 'Left blank',
      note: question.required ? 'This one is required.' : 'Optional, and not answered.',
      formSection: question.formSection,
    }
  }

  return {
    label: question.label,
    // Choices read back in the words the researcher chose from, never as the
    // stored value: "Coded, with a key held separately", not "coded".
    detail: question.options?.find((option) => option.value === answer)?.label ?? answer,
    formSection: question.formSection,
  }
}

function sectionNotes(project: Project, answers: AnswerMap, section: IntakeSection): string[] {
  const notes: string[] = []

  // What this section just turned on. These are the consequences a researcher
  // cannot see from the answer itself, and they are worth saying at the moment
  // the answer is given rather than at the end of intake.
  for (const [key, value, note] of CONSEQUENCES) {
    if (!section.questions.some((question) => question.key === key)) continue
    const answer = answers[key]
    if (value === 'yes_or_unsure' ? answer === 'yes' || answer === 'unsure' : answer === value) {
      notes.push(note)
    }
  }

  // Everything the gap rules already know about this section. Reused rather than
  // restated: one set of rules, surfaced early here and again at gap analysis.
  for (const finding of analyseGaps(project, answers)) {
    if (finding.formSection !== section.formSection) continue
    if (finding.severity === 'missing') continue
    notes.push(finding.finding)
  }

  const blank = section.questions.filter(
    (question) => !question.required && (answers[question.key] ?? '').trim().length === 0,
  )
  if (blank.length > 0) {
    notes.push(
      `${
        blank.length === 1 ? 'One optional question was' : `${blank.length} optional questions were`
      } left blank. Optional in this tool means the workflow will not stop for it, which is not the same as optional to the Board.`,
    )
  }

  return notes
}

/** Answer, and what it commits the researcher to. */
const CONSEQUENCES: [key: string, value: string, note: string][] = [
  [
    'intake.2_4.third_party',
    'yes_or_unsure',
    'Because someone outside the research team is involved in reaching participants, the Board needs their written agreement appended before it will review your submission. That letter takes longer to get than it does to write, so it is worth asking now rather than at the end.',
  ],
  [
    'intake.2_5.how',
    'implied',
    'Consent implied by completing a survey means the page participants read before they start is the consent document. It carries everything a signed form would.',
  ],
  [
    'intake.2_5.future_use',
    'yes',
    'Keeping the data for future research opens section 2.8, and TCPS 2 Article 3.13 asks participants to consent to it separately. Someone who says no must still be able to take part.',
  ],
  [
    'intake.2_6.intervention',
    'yes',
    'A health intervention or procedure opens the clinical trials section, and points this application at the Health Sciences Board rather than Social Sciences and Humanities.',
  ],
  [
    'intake.2_7.health_information',
    'yes',
    'Handling personal health information opens section 2.15, and may bring this research under Nova Scotia’s Personal Health Information Act.',
  ],
]

// ---------------------------------------------------------------------------

/** A stored choice value, back in the wording the researcher was shown. */
function choiceLabel(key: string, answers: AnswerMap): string {
  const value = answers[key]
  if (!value) return 'Not answered'
  const question = allQuestions().find((entry) => entry.key === key)
  return question?.options?.find((option) => option.value === value)?.label ?? value
}

/** The stage a checkpoint sits between, for headings that name both sides. */
export function checkpointStageLabels(definition: CheckpointDefinition): {
  from: string
  to: string
} {
  return {
    from: STATE_DEFINITIONS[definition.from].label,
    to: STATE_DEFINITIONS[definition.to].label,
  }
}
