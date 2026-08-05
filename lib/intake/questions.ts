import type { AnswerMap } from '@/lib/data/types'

/**
 * The guided question sequence.
 *
 * Every question names the form section it feeds, so an answer can be traced to
 * the part of the application it will end up in, and so draft assembly can
 * gather its source material by section rather than by guesswork.
 *
 * The questions ask about the research, never about the people in it. There is
 * no question here whose honest answer is a participant's name, contact details
 * or identifiers, and there should never be one: guardrail 2 keeps that data out
 * of the database, and the surest way to keep it out is not to ask for it. The
 * redaction gate is the second line, not the first.
 *
 * Section numbers follow `lib/form/dalhousie-sections.ts`, which is provisional
 * until the real form is ingested. When that lands, both files get checked
 * against it together.
 */

export type QuestionType = 'text' | 'textarea' | 'choice'

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  key: string
  label: string
  /** Shown under the label. Plain language, advisory, never a determination. */
  help?: string
  type: QuestionType
  options?: QuestionOption[]
  required?: boolean
  placeholder?: string
  /** The form section this answer feeds, e.g. '2.3'. */
  formSection?: string
}

export interface IntakeSection {
  formSection: string
  title: string
  intro?: string
  questions: Question[]
  /** Sections that only apply to some studies. Absent means always shown. */
  showWhen?: (answers: AnswerMap) => boolean
}

const YES_NO_UNSURE: QuestionOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'I am not sure' },
]

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

export const TRIAGE_INDIGENOUS_KEY = 'triage.indigenous_research'
export const TRIAGE_COMMUNITY_KEY = 'triage.community_engaged'
export const TRIAGE_TITLE_KEY = 'triage.title'
export const TRIAGE_SUMMARY_KEY = 'triage.plain_summary'

export const TRIAGE_QUESTIONS: Question[] = [
  {
    key: TRIAGE_TITLE_KEY,
    label: 'What is the working title of this research?',
    help: 'It does not need to be final. You can change it at any point.',
    type: 'text',
    required: true,
    placeholder: 'Community Retrofit Readiness',
    // Every question declares where its answer lands, including the triage ones,
    // so draft assembly needs no special cases.
    formSection: '1',
  },
  {
    key: TRIAGE_SUMMARY_KEY,
    label: 'In two or three sentences, what are you trying to find out?',
    help: 'Write it the way you would say it out loud. This becomes the raw material for the lay summary later, so plain language now saves work then.',
    type: 'textarea',
    required: true,
    formSection: '2.1',
  },
  {
    key: 'triage.data_source',
    label: 'Will you collect information directly from people, or work only with records that already exist?',
    type: 'choice',
    required: true,
    options: [
      { value: 'direct', label: 'Directly from people, for example interviews, surveys or observation' },
      { value: 'existing', label: 'Only from records that already exist' },
      { value: 'both', label: 'Both' },
    ],
  },
  {
    key: TRIAGE_INDIGENOUS_KEY,
    label:
      'Does this research involve First Nations, Inuit or Métis Peoples, or take place in or with an Indigenous community?',
    help: 'This includes research about Indigenous Peoples using existing data, not only research with participants.',
    type: 'choice',
    required: true,
    options: YES_NO_UNSURE,
  },
  {
    key: TRIAGE_COMMUNITY_KEY,
    label:
      'Is a community organisation or group a partner in this research, rather than a subject of it?',
    help: 'For example, a group that helped shape the research question, or that will share ownership of the findings.',
    type: 'choice',
    required: true,
    options: YES_NO_UNSURE,
  },
]

/**
 * Guardrail 4, read off the triage answers.
 *
 * "I am not sure" counts as yes. The consequence of flagging is a conversation
 * with a person, and the consequence of not flagging is a drafting tool
 * improvising on TCPS2 Chapter 9 and community protocols. Those costs are not
 * remotely symmetrical, so uncertainty resolves toward the person.
 */
export function triageFlags(answers: AnswerMap): {
  indigenous: boolean
  communityEngaged: boolean
} {
  const flagged = (value: string | undefined) => value === 'yes' || value === 'unsure'
  return {
    indigenous: flagged(answers[TRIAGE_INDIGENOUS_KEY]),
    communityEngaged: flagged(answers[TRIAGE_COMMUNITY_KEY]),
  }
}

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

const INVOLVES_INTERVENTION_KEY = 'intake.2_6.intervention'
const HANDLES_HEALTH_INFORMATION_KEY = 'intake.2_7.health_information'

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    formSection: '2.2',
    title: 'Research question and objectives',
    questions: [
      {
        key: 'intake.2_2.question',
        label: 'What is your primary research question?',
        type: 'textarea',
        required: true,
        formSection: '2.2',
      },
      {
        key: 'intake.2_2.objectives',
        label: 'What are the specific objectives that follow from it?',
        help: 'One per line is fine.',
        type: 'textarea',
        formSection: '2.2',
      },
    ],
  },
  {
    formSection: '2.3',
    title: 'Study population',
    intro:
      'Describe who takes part as a group. Do not enter anyone’s name or contact details here, or anywhere in this tool.',
    questions: [
      {
        key: 'intake.2_3.who',
        label: 'Who will take part, described as a group?',
        help: 'For example, "homeowners in rural Nova Scotia who have considered a heat pump".',
        type: 'textarea',
        required: true,
        formSection: '2.3',
      },
      {
        key: 'intake.2_3.how_many',
        label: 'Roughly how many people, and how did you arrive at that number?',
        type: 'textarea',
        formSection: '2.3',
      },
      {
        key: 'intake.2_3.dependence',
        label:
          'Could anyone taking part be in a position of dependence on you, or have a reduced capacity to consent?',
        help: 'For example, your own students or employees, people in care, or children. This affects how consent is handled, and the Board will look closely at it.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.3',
      },
    ],
  },
  {
    formSection: '2.4',
    title: 'Recruitment',
    questions: [
      {
        key: 'intake.2_4.how',
        label: 'How will you find and approach people?',
        help: 'Include where the invitation appears and who does the approaching.',
        type: 'textarea',
        required: true,
        formSection: '2.4',
      },
      {
        key: 'intake.2_4.incentive',
        label: 'Is anyone being paid or compensated for taking part? If so, how much and in what form?',
        help: 'Compensation is normal. The Board looks at whether the amount could make it hard to refuse.',
        type: 'textarea',
        formSection: '2.4',
      },
    ],
  },
  {
    formSection: '2.5',
    title: 'Consent process',
    questions: [
      {
        key: 'intake.2_5.how',
        label: 'How will you obtain consent, and at what point?',
        type: 'choice',
        required: true,
        options: [
          { value: 'written', label: 'Written consent, signed before taking part' },
          { value: 'verbal', label: 'Verbal consent, recorded by the researcher' },
          { value: 'implied', label: 'Implied by completing a survey' },
          { value: 'other', label: 'Something else, described below' },
        ],
        formSection: '2.5',
      },
      {
        key: 'intake.2_5.withdrawal',
        label: 'How can someone withdraw, and what happens to their data if they do?',
        help: 'Include the point after which withdrawal is no longer possible, for example once results are aggregated.',
        type: 'textarea',
        required: true,
        formSection: '2.5',
      },
    ],
  },
  {
    formSection: '2.6',
    title: 'Methods and procedures',
    questions: [
      {
        key: 'intake.2_6.what_happens',
        label: 'Walk through what someone actually does, step by step, from agreeing to finishing.',
        help: 'Include how long each part takes and where it happens.',
        type: 'textarea',
        required: true,
        formSection: '2.6',
      },
      {
        key: 'intake.2_6.recording',
        label: 'Will anything be audio or video recorded, or transcribed by someone outside the research team?',
        help: 'If a transcriptionist is hired, the form asks for a signed confidentiality agreement at 2.6.3.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.6',
      },
      {
        key: INVOLVES_INTERVENTION_KEY,
        label: 'Does the research involve a health intervention, treatment or clinical procedure?',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.6',
      },
    ],
  },
  {
    formSection: '2.7',
    title: 'Privacy and confidentiality',
    questions: [
      {
        key: 'intake.2_7.identifiability',
        label: 'How identifiable will the information be once you hold it?',
        type: 'choice',
        required: true,
        options: [
          { value: 'identifiable', label: 'Directly identifiable' },
          { value: 'coded', label: 'Coded, with a key held separately' },
          { value: 'anonymised', label: 'Anonymised, with no way back to an individual' },
          { value: 'anonymous', label: 'Anonymous, never collected with identifiers' },
        ],
        formSection: '2.7',
      },
      {
        key: 'intake.2_7.storage',
        label: 'Where will the information be stored, and who can reach it?',
        type: 'textarea',
        required: true,
        formSection: '2.7',
      },
      {
        key: 'intake.2_7.outside_canada',
        label: 'Will any of it be stored or processed outside Canada?',
        help: 'Cloud services often store data outside Canada by default. Section 2.7.5 of the form asks this directly.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.7',
      },
      {
        key: HANDLES_HEALTH_INFORMATION_KEY,
        label: 'Will you handle personal health information?',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.7',
      },
    ],
  },
  {
    formSection: '2.8',
    title: 'Retention and disposal',
    questions: [
      {
        key: 'intake.2_8.how_long',
        label: 'How long will you keep the information, and what happens to it afterwards?',
        type: 'textarea',
        required: true,
        formSection: '2.8',
      },
    ],
  },
  {
    formSection: '2.9',
    title: 'Risk and benefit',
    questions: [
      {
        key: 'intake.2_9.risks',
        label: 'What could go wrong for someone taking part?',
        help: 'Include discomfort, inconvenience, and social or professional consequences, not only physical risk. Very few studies have none, and saying "none" tends to draw more questions than naming a small one.',
        type: 'textarea',
        required: true,
        formSection: '2.9',
      },
      {
        key: 'intake.2_9.mitigation',
        label: 'What will you do to reduce those risks?',
        type: 'textarea',
        required: true,
        formSection: '2.9',
      },
      {
        key: 'intake.2_9.benefits',
        label: 'What are the benefits, to participants or more broadly?',
        type: 'textarea',
        formSection: '2.9',
      },
    ],
  },
  {
    formSection: '2.10',
    title: 'Dissemination',
    questions: [
      {
        key: 'intake.2_10.where',
        label: 'Where will the results go?',
        help: 'Publications, conferences, reports to a partner organisation, and so on.',
        type: 'textarea',
        required: true,
        formSection: '2.10',
      },
      {
        key: 'intake.2_10.participants',
        label: 'Will participants be able to see the findings, and how?',
        type: 'textarea',
        formSection: '2.10',
      },
    ],
  },
  {
    formSection: '2.12',
    title: 'Conflict of interest',
    questions: [
      {
        key: 'intake.2_12.conflict',
        label: 'Is there any real or perceived conflict of interest?',
        help: 'For example, funding from a party with a stake in the result, or a dual role with participants.',
        type: 'textarea',
        formSection: '2.12',
      },
    ],
  },
  {
    formSection: '2.14',
    title: 'Clinical trials',
    intro: 'Shown because you indicated the research involves a health intervention or procedure.',
    showWhen: (answers) => answers[INVOLVES_INTERVENTION_KEY] === 'yes',
    questions: [
      {
        key: 'intake.2_14.description',
        label: 'Describe the intervention, including who administers it and how it is monitored.',
        type: 'textarea',
        required: true,
        formSection: '2.14',
      },
      {
        key: 'intake.2_14.registration',
        label: 'Is the trial registered, and where?',
        type: 'text',
        formSection: '2.14',
      },
    ],
  },
  {
    formSection: '2.15',
    title: 'Personal health information',
    intro: 'Shown because you indicated the research handles personal health information.',
    showWhen: (answers) => answers[HANDLES_HEALTH_INFORMATION_KEY] === 'yes',
    questions: [
      {
        key: 'intake.2_15.source',
        label: 'What health information will you handle, and where does it come from?',
        type: 'textarea',
        required: true,
        formSection: '2.15',
      },
      {
        key: 'intake.2_15.authority',
        label: 'Under what authority or agreement do you have access to it?',
        type: 'textarea',
        formSection: '2.15',
      },
    ],
  },
]

/** The sections that apply to this application, in order. */
export function visibleSections(answers: AnswerMap): IntakeSection[] {
  return INTAKE_SECTIONS.filter((section) => !section.showWhen || section.showWhen(answers))
}

/** Question keys still needed before a step can be left. */
export function missingRequired(questions: Question[], answers: AnswerMap): string[] {
  return questions
    .filter((question) => question.required)
    .filter((question) => !answers[question.key] || answers[question.key].trim().length === 0)
    .map((question) => question.key)
}

export function sectionMap(questions: Question[]): Record<string, string | undefined> {
  return Object.fromEntries(questions.map((question) => [question.key, question.formSection]))
}

/** Every question across triage and intake, for lookups. */
export function allQuestions(): Question[] {
  return [...TRIAGE_QUESTIONS, ...INTAKE_SECTIONS.flatMap((section) => section.questions)]
}
