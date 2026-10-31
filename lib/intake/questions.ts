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
  /**
   * Shown only when this returns true. Used for follow-ups to a yes or no
   * question inside a section that is otherwise always shown. Like the section
   * gates, it takes effect once the earlier answer is saved.
   */
  showWhen?: (answers: AnswerMap) => boolean
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
    key: 'triage.board',
    label: 'Which Research Ethics Board should review this research?',
    help: 'Section 1 of the form asks you to suggest one. Health Sciences covers clinical and health research; Social Sciences and Humanities covers most other work.',
    type: 'choice',
    required: true,
    formSection: '1',
    options: [
      { value: 'health', label: 'Health Sciences' },
      { value: 'social', label: 'Social Sciences and Humanities' },
      { value: 'unsure', label: 'I am not sure' },
    ],
  },
  {
    key: 'triage.data_source',
    label: 'Will you collect information directly from people, or work only with records that already exist?',
    help: 'This form is for prospective research, where new data is collected. Research using only existing records uses a different form.',
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

/** A follow-up that appears only when an earlier yes or no question was answered yes. */
const whenYes = (key: string) => (answers: AnswerMap) => answers[key] === 'yes'

const PHASED_KEY = 'intake.2_1.phased'
const CONSENT_EXCEPTION_KEY = 'intake.2_5.consent_exception'
const DECEPTION_KEY = 'intake.2_5.deception'
const INCIDENTAL_KEY = 'intake.2_10.incidental'
const GENETIC_KEY = 'intake.2_10.genetic'

/**
 * The yes or no questions that decide whether a follow-up applies. They are asked
 * of everyone, but the form question behind them applies only to some studies, so
 * drafting does not treat an unanswered one as a gap.
 */
export const GATE_KEYS = new Set([
  PHASED_KEY,
  CONSENT_EXCEPTION_KEY,
  DECEPTION_KEY,
  INCIDENTAL_KEY,
  GENETIC_KEY,
])

const INVOLVES_INTERVENTION_KEY = 'intake.2_6.intervention'
const HANDLES_HEALTH_INFORMATION_KEY = 'intake.2_7.health_information'
/** Drives section 2.8, which most studies mark not applicable. */
const FUTURE_USE_KEY = 'intake.2_5.future_use'

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    formSection: '2.1',
    title: 'Lay summary and phased review',
    intro:
      'The lay summary itself is drafted from your answer to the second opening question. This section asks only about phased review.',
    questions: [
      {
        key: PHASED_KEY,
        label: 'Are you asking the Board to review this research in phases?',
        help: 'Most studies are reviewed as a whole. A phased review is unusual, and the application instructions say to read them before asking for one. Choose Yes and save to be asked which phases.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.1',
      },
      {
        key: 'intake.2_1.phased_detail',
        label: 'Why is a phased review appropriate for this study, and which phases does this application cover?',
        type: 'textarea',
        formSection: '2.1',
        showWhen: whenYes(PHASED_KEY),
      },
    ],
  },
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
        key: 'intake.2_4.third_party',
        label:
          'Will you need the cooperation, assistance or approval of anyone outside the research team to reach participants?',
        help: 'For example a school, a clinic, an employer or a community organisation. If yes, the Board needs their written agreement appended before it will review your submission, so this is worth starting early.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.4',
      },
      {
        key: 'intake.2_4.how',
        label: 'How will you find and approach people?',
        help: 'Include where the invitation appears and who does the approaching.',
        type: 'textarea',
        required: true,
        formSection: '2.4',
      },
      {
        key: 'intake.2_4.who_recruits',
        label: 'Who will carry out the recruitment, and what will they do?',
        help: 'Name a role, such as research assistant, rather than a person. Do not enter anyone’s name here.',
        type: 'textarea',
        formSection: '2.4',
      },
      {
        key: 'intake.2_4.expressing_interest',
        label: 'What will someone do to show they are interested in taking part?',
        help: 'For example, reply to an email, scan a code or complete a short form.',
        type: 'textarea',
        formSection: '2.4',
      },
      {
        key: 'intake.2_4.screening',
        label: 'How will you check that someone is eligible to take part?',
        help: 'If people decide for themselves, say so.',
        type: 'textarea',
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
    title: 'Informed consent process',
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
      {
        key: FUTURE_USE_KEY,
        label: 'Might the data be kept for use in future research beyond this study?',
        help: 'If so, TCPS 2 Article 3.13 requires participants to consent to that separately, and they must still be able to take part if they say no.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.5',
      },
      {
        key: CONSENT_EXCEPTION_KEY,
        label:
          'Are you asking the Board to waive, or change, the requirement to obtain informed consent before people take part?',
        help: 'This is uncommon. If you are not sure, choose I am not sure and ask the Research Ethics Office. Choose Yes and save to be asked why.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.5',
      },
      {
        key: 'intake.2_5.consent_exception_detail',
        label: 'Why can consent not be obtained in the usual way, and how will participants be told about the research afterwards?',
        help: 'The form asks you to address the criteria in TCPS 2 Article 3.7A, so check your answer against them.',
        type: 'textarea',
        formSection: '2.5',
        showWhen: whenYes(CONSENT_EXCEPTION_KEY),
      },
      {
        key: DECEPTION_KEY,
        label: 'Will participants be told anything untrue, or kept unaware of the real purpose of the study?',
        help: 'Some research cannot work if participants know everything in advance. If that applies, choose Yes and save to be asked how you will justify it and debrief.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.5',
      },
      {
        key: 'intake.2_5.deception_detail',
        label: 'What will participants not be told, why is that necessary, and how will they be debriefed afterwards?',
        type: 'textarea',
        formSection: '2.5',
        showWhen: whenYes(DECEPTION_KEY),
      },
    ],
  },
  {
    formSection: '2.6',
    title: 'Methods, data collection and analysis',
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
        key: 'intake.2_6.analysis',
        label: 'Briefly, how will you analyse the data?',
        help: 'The form asks how the analysis addresses your research question, and asks you to justify using any demographic information you collect.',
        type: 'textarea',
        required: true,
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
        key: 'intake.2_7.retention',
        label: 'How long will you keep everything, and how will it eventually be destroyed?',
        help: 'Section 2.7.2 asks for a retention period with a rationale, where things live in the meantime, and who destroys them.',
        type: 'textarea',
        required: true,
        formSection: '2.7',
      },
      {
        key: 'intake.2_7.reporting',
        label: 'When you report the results, how will you protect confidentiality?',
        help: 'Say whether you will show only group results or individual results, and whether anyone will be quoted or could be recognised. If you will quote people, say how you will get their consent for that.',
        type: 'textarea',
        formSection: '2.7',
      },
      {
        key: 'intake.2_7.limits',
        label: 'Are there any limits on the confidentiality you can offer?',
        help: 'For example a legal duty to report abuse or neglect of a child, or of an adult in need of protection. These must also appear in the consent form.',
        type: 'textarea',
        formSection: '2.7',
      },
      {
        key: HANDLES_HEALTH_INFORMATION_KEY,
        label: 'Will you handle personal health information?',
        help: 'This may bring the research under Nova Scotia’s Personal Health Information Act.',
        type: 'choice',
        required: true,
        options: YES_NO_UNSURE,
        formSection: '2.7',
      },
    ],
  },
  {
    formSection: '2.8',
    title: 'Indefinite retention of research data',
    intro:
      'Shown because you indicated the data may be kept for future research. Most studies mark this section not applicable.',
    showWhen: (answers) => answers[FUTURE_USE_KEY] === 'yes',
    questions: [
      {
        key: 'intake.2_8.risks_benefits',
        label: 'What are the risks and benefits of keeping this data long term for unspecified future research?',
        type: 'textarea',
        required: true,
        formSection: '2.8',
      },
      {
        key: 'intake.2_8.keeper',
        label: 'Who will hold the data, and what happens to it if they leave Dalhousie?',
        help: 'Retirement, moving institution, or graduation all count. If it sits in a repository rather than with a person, say so.',
        type: 'textarea',
        required: true,
        formSection: '2.8',
      },
      {
        key: 'intake.2_8.access',
        label: 'Who will be able to access it in future, and under what circumstances?',
        type: 'textarea',
        formSection: '2.8',
      },
      {
        key: 'intake.2_8.repository',
        label: 'If the data will go into a repository or biobank, which one is it, and what protects participants’ data there?',
        help: 'If you will keep the data yourself instead, say so.',
        type: 'textarea',
        formSection: '2.8',
      },
      {
        key: 'intake.2_8.stored',
        label: 'What type of data or materials will be stored for re-use, how identifiable will they be, and roughly how much?',
        help: 'The form also asks for a list of every field in the final data set, as an appendix.',
        type: 'textarea',
        formSection: '2.8',
      },
    ],
  },
  {
    formSection: '2.9',
    title: 'Risk and benefit analysis',
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
        key: 'intake.2_9.others',
        label:
          'Could anyone beyond your participants be affected by this research, or by publishing the findings?',
        help: 'The form asks about people, groups or communities who are not participants themselves. Answering this is also where the form asks whether Indigenous communities are involved.',
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
    title: 'Provision of results and dissemination',
    questions: [
      {
        key: 'intake.2_10.participants',
        label: 'How will you share the results with the people who took part?',
        help: 'TCPS 2 encourages this. Describe the format and the process.',
        type: 'textarea',
        required: true,
        formSection: '2.10',
      },
      {
        key: 'intake.2_10.individual',
        label: 'Will anyone receive their own individual results?',
        help: 'If so, the form asks how they are delivered securely, how you make sure they are understandable, and what risks come with receiving them.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.10',
      },
      {
        key: 'intake.2_10.where',
        label: 'Where else will the findings go?',
        help: 'Publications, conferences, public lectures, reports to a partner organisation.',
        type: 'textarea',
        required: true,
        formSection: '2.10',
      },
      {
        key: INCIDENTAL_KEY,
        label: 'Could the research reveal something important about a person taking part that you would need to tell them, such as a health concern?',
        help: 'This is called an incidental finding: something found along the way that is outside what the study set out to learn. Choose Yes and save to be asked how you would tell them.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.10',
      },
      {
        key: 'intake.2_10.incidental_detail',
        label: 'How would you tell participants about such a finding?',
        type: 'textarea',
        formSection: '2.10',
        showWhen: whenYes(INCIDENTAL_KEY),
      },
      {
        key: GENETIC_KEY,
        label: 'Will you give genetic results or information to participants, communities or groups?',
        help: 'Most studies will not. Choose Yes and save to be asked about genetic counselling.',
        type: 'choice',
        options: YES_NO_UNSURE,
        formSection: '2.10',
      },
      {
        key: 'intake.2_10.genetic_detail',
        label: 'What genetic counselling will be offered?',
        type: 'textarea',
        formSection: '2.10',
        showWhen: whenYes(GENETIC_KEY),
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
      {
        key: 'intake.2_14.known_effects',
        label: 'What is known about the effects of any product or device being studied, what are its approved uses, and how does your use differ?',
        help: 'Include safety information and possible contraindications.',
        type: 'textarea',
        formSection: '2.14',
      },
      {
        key: 'intake.2_14.blinding',
        label: 'Will participants or researchers be blinded to who receives what, or will participants be randomly assigned? Describe the plan.',
        type: 'textarea',
        formSection: '2.14',
      },
      {
        key: 'intake.2_14.safety',
        label: 'How will safety be monitored, and how will new information reach participants, the Board, the research team, sponsors and the trial registry?',
        help: 'Include when participants would be withdrawn for safety reasons, when the trial would stop early, and what could happen to participants if it does.',
        type: 'textarea',
        formSection: '2.14',
      },
    ],
  },
  {
    formSection: '2.15',
    title: 'Use of personal health information',
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
      {
        key: 'intake.2_15.linking',
        label: 'Will separate sets of health data be linked as part of this research?',
        help: 'If yes, say why linking is necessary, how it will be done, and whether it makes participants easier to identify. If no, write No.',
        type: 'textarea',
        formSection: '2.15',
      },
      {
        key: 'intake.2_15.privacy_risks',
        label: 'What risks to privacy could reasonably be foreseen from using this health information, and how will each be reduced?',
        type: 'textarea',
        formSection: '2.15',
      },
    ],
  },
]

/** Whether a question is shown now. A question with no gate is always shown. */
export function isQuestionVisible(question: Question, answers: AnswerMap): boolean {
  return !question.showWhen || question.showWhen(answers)
}

/**
 * The sections that apply to this application, in order, each carrying only the
 * questions that apply now. Everything that walks a section's questions reads
 * this, so a follow-up that is not shown is also not required, not counted and
 * not saved.
 */
export function visibleSections(answers: AnswerMap): IntakeSection[] {
  return INTAKE_SECTIONS.filter((section) => !section.showWhen || section.showWhen(answers)).map(
    (section) => ({
      ...section,
      questions: section.questions.filter((question) => isQuestionVisible(question, answers)),
    }),
  )
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
