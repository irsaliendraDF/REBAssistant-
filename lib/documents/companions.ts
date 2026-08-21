import type { AnswerMap, Project } from '@/lib/data/types'

/**
 * Companion documents.
 *
 * The application is not the submission. Section 3 of the form asks for
 * appendices, and a Board will not review a file that arrives without the
 * consent form, the instrument, or the permission letter it depends on. Those
 * documents are written outside this tool, which is exactly why researchers
 * discover them late.
 *
 * This file works out which of them *this* study needs, from the answers the
 * researcher has already given, and says what each one has to contain. It runs
 * at the end of the workflow, where there is enough on record to be specific.
 *
 * DETERMINISTIC, like gap analysis and for the same reasons. No model is called
 * here and nothing leaves the machine: every suggestion below is traceable to an
 * answer, and can be explained to a researcher who asks why it appeared. A model
 * that usually notices you are running interviews is worth less than a rule that
 * always does.
 *
 * Guardrail 6 governs the wording. These are the documents a Board will expect
 * to see, described. Nothing here says a study is ready, and nothing here claims
 * a list is exhaustive: the Research Ethics Office is the authority on what a
 * particular submission needs.
 *
 * Guardrail 4 still holds. Where triage flagged Indigenous or community-engaged
 * research, the affected documents are marked as belonging to a conversation
 * with the community and the Research Ethics Office, not to this tool.
 */

/** How firmly the answers point at needing this. Never a determination. */
export type Necessity = 'required' | 'likely' | 'consider'

export interface CompanionDocument {
  id: string
  title: string
  necessity: Necessity
  /** Why it appeared, in terms of what the researcher actually answered. */
  why: string
  /** The line in the form's own appendix list this document satisfies. */
  appendix: string
  /** The form section it comes from, for a link back into the answers. */
  formSection: string | null
  /** What it has to contain, specific to this study where the answers allow. */
  checklist: string[]
  /** Knowledge base filename of a Dalhousie template, where one exists. */
  templateFilename: string | null
  /** What that file is. Null where the researcher writes this from scratch. */
  templateLabel: string | null
  /** Guardrail 4. Prepared with people, not drafted by the tool. */
  routedToHuman: boolean
}

const TEMPLATES = {
  consentProspective: {
    filename: 'consent-form-prospective-research-data-collection.pdf',
    label: 'Dalhousie consent form template, prospective research data collection',
  },
  consentSurvey: {
    filename: 'consent-form-template-online-survey.pdf',
    label: 'Dalhousie consent form template, online survey',
  },
  consentSecondaryRecords: {
    filename: 'consent-form-secondary-research-existing-records.pdf',
    label: 'Dalhousie consent form template, secondary research using existing records',
  },
  consentSecondaryPersonal: {
    filename: 'consent-form-secondary-personal-records.pdf',
    label: 'Dalhousie consent form template, secondary use of personal records',
  },
  consentRepository: {
    filename: 'consent-form-data-sharing-repository-future-research.pdf',
    label: 'Dalhousie consent form template, data sharing and future research',
  },
  confidentiality: {
    filename: 'confidentiality-agreement-template.pdf',
    label: 'Dalhousie confidentiality agreement template',
  },
  recruitmentHints: {
    // Guidance on writing a recruitment message, not a message to fill in. The
    // difference matters: a researcher sent to "the recruitment template" goes
    // looking for a document that does not exist.
    filename: 'hints-for-research-recruitment-messages.pdf',
    label: 'Dalhousie guidance on writing recruitment messages',
  },
} as const

// ---------------------------------------------------------------------------
// Reading the answers
// ---------------------------------------------------------------------------

/** The free text most likely to describe what participants actually do. */
const METHOD_KEYS = [
  'triage.plain_summary',
  'intake.2_2.question',
  'intake.2_2.objectives',
  'intake.2_4.how',
  'intake.2_4.screening',
  'intake.2_6.what_happens',
  'intake.2_6.analysis',
  'intake.2_9.risks',
]

function haystack(answers: AnswerMap): string {
  return METHOD_KEYS.map((key) => answers[key] ?? '')
    .join('\n')
    .toLowerCase()
}

const PATTERNS = {
  survey: /\bsurveys?\b|\bquestionnaires?\b|\bpolls?\b|likert|online form/,
  interview: /\binterview/,
  keyInformant: /key informant|expert interview|stakeholder interview|elite interview/,
  focusGroup: /focus group|group discussion|group interview|workshop|charrette/,
  observation: /\bobserv|ethnograph|site visit|walkthrough|walk-through|field note/,
  visualMedia: /photovoice|photo diary|\bdiar(y|ies)\b|journal entr|video submission|drawings?/,
  distress: /trauma|distress|mental health|suicid|abuse|bereave|violence|grief|addiction|harassment/,
} as const

function said(answers: AnswerMap, value: string, ...keys: string[]): boolean {
  return keys.some((key) => answers[key] === value)
}

/** "I am not sure" resolves toward preparing the document, as it does in triage. */
function saidYesOrUnsure(answers: AnswerMap, key: string): boolean {
  return answers[key] === 'yes' || answers[key] === 'unsure'
}

function answered(answers: AnswerMap, key: string): boolean {
  return (answers[key] ?? '').trim().length > 0
}

// ---------------------------------------------------------------------------

export function suggestCompanionDocuments(
  project: Project,
  answers: AnswerMap,
): CompanionDocument[] {
  const text = haystack(answers)
  const flagged = project.involvesIndigenousResearch || project.involvesCommunityEngagedResearch
  const dataSource = answers['triage.data_source']
  const collectsDirectly = dataSource === 'direct' || dataSource === 'both'
  const usesExisting = dataSource === 'existing' || dataSource === 'both'

  const documents: CompanionDocument[] = []

  // -- Consent -------------------------------------------------------------

  if (collectsDirectly) {
    const impliedBySurvey = answers['intake.2_5.how'] === 'implied'
    const template = impliedBySurvey ? TEMPLATES.consentSurvey : TEMPLATES.consentProspective

    documents.push({
      id: 'consent_form',
      title: impliedBySurvey ? 'Consent page for the survey' : 'Consent form or consent script',
      necessity: 'required',
      why: impliedBySurvey
        ? 'You said consent is implied by completing the survey, so the information participants read before they start is the consent document.'
        : `You said consent is obtained ${consentPhrase(answers)}, and the Board reviews the wording participants are given.`,
      appendix: 'Consent and assent documents or scripts',
      formSection: '2.5',
      checklist: consentChecklist(answers),
      templateFilename: template.filename,
      templateLabel: template.label,
      routedToHuman: flagged,
    })
  }

  if (usesExisting) {
    const health = saidYesOrUnsure(answers, 'intake.2_7.health_information')
    const template = health ? TEMPLATES.consentSecondaryPersonal : TEMPLATES.consentSecondaryRecords

    documents.push({
      id: 'consent_secondary',
      title: 'Consent or authorisation for the existing records',
      necessity: 'required',
      why: health
        ? 'You said the research uses records that already exist and handles personal health information, which the Board treats differently from information collected directly.'
        : 'You said the research uses records that already exist, which the Board treats differently from information collected directly.',
      appendix: 'Research agreements applicable to this study',
      formSection: '2.5',
      checklist: [
        'What the records contain and who holds them now.',
        'The authority you have to use them: consent already given, a data access agreement, or a waiver of consent the Board is being asked to approve.',
        'Whether the records reach you identifiable, coded or anonymised.',
      ],
      templateFilename: template.filename,
      templateLabel: template.label,
      routedToHuman: flagged,
    })
  }

  if (saidYesOrUnsure(answers, 'intake.2_5.future_use')) {
    documents.push({
      id: 'consent_future_use',
      title: 'Separate consent for keeping the data for future research',
      necessity: 'required',
      why: 'You said the data may be kept for research beyond this study. TCPS 2 Article 3.13 asks for that to be consented to separately, and someone who says no must still be able to take part.',
      appendix: 'List of data fields included in a data repository',
      formSection: '2.8',
      checklist: [
        'A tick box that is separate from the consent to take part in this study.',
        'What is kept, in what form, and for how long.',
        'Who will hold it, and what happens to it if that person leaves Dalhousie.',
        'Whether it can be withdrawn later, and up to what point.',
      ],
      templateFilename: TEMPLATES.consentRepository.filename,
      templateLabel: TEMPLATES.consentRepository.label,
      routedToHuman: flagged,
    })
  }

  if (saidYesOrUnsure(answers, 'intake.2_3.dependence')) {
    documents.push({
      id: 'assent_form',
      title: 'Assent script, and consent from a parent, guardian or authorised decision maker',
      necessity: 'likely',
      why: 'You said someone taking part could be in a position of dependence on you, or have a reduced capacity to consent. The Board looks closely at how consent works in that situation.',
      appendix: 'Consent and assent documents or scripts',
      formSection: '2.3',
      checklist: [
        'The words used to explain the study to the person taking part, at their level.',
        'How they can say no, or stop, without consequence, particularly where the person asking has authority over them.',
        'Who gives permission on their behalf, and how that permission is recorded.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: flagged,
    })
  }

  // -- Recruitment ---------------------------------------------------------

  if (answered(answers, 'intake.2_4.how')) {
    documents.push({
      id: 'recruitment_materials',
      title: 'Recruitment materials, exactly as participants will see them',
      necessity: 'required',
      why: 'You described how people will be found and approached. The Board reviews the wording of every poster, post, email and script, not a description of them.',
      appendix: 'Recruitment documents: posters, scripts, postings, invitations',
      formSection: '2.4',
      checklist: [
        'One document per channel: the poster, the email, the social post, the verbal script.',
        'What the study is about, what taking part involves, and roughly how long it takes.',
        answered(answers, 'intake.2_4.incentive')
          ? 'The compensation, stated the same way you described it at 2.4.'
          : 'Whether there is any compensation.',
        'That taking part is voluntary, and who to contact with questions.',
        'The Research Ethics Board file number, once you have it.',
      ],
      templateFilename: TEMPLATES.recruitmentHints.filename,
      templateLabel: TEMPLATES.recruitmentHints.label,
      routedToHuman: flagged,
    })
  }

  if (saidYesOrUnsure(answers, 'intake.2_4.third_party')) {
    documents.push({
      id: 'permission_letter',
      title: 'Permission or cooperation letter from each third party',
      necessity: 'required',
      why: 'You said you need the cooperation, assistance or approval of someone outside the research team to reach participants.',
      appendix: 'Permission or cooperation letters from any third party assisting recruitment',
      formSection: '2.4',
      checklist: [
        'On the organisation’s own letterhead, signed by someone with the authority to give it.',
        'What they are agreeing to do: pass on an invitation, provide space, allow access.',
        'That they understand the research is voluntary for the people they reach.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: flagged,
    })
  }

  if (answered(answers, 'intake.2_4.screening')) {
    documents.push({
      id: 'screening_documents',
      title: 'Screening questions or eligibility script',
      necessity: 'likely',
      why: 'You described how eligibility is checked, and the Board reviews the questions people are asked before they consent.',
      appendix: 'Screening documents',
      formSection: '2.4',
      checklist: [
        'The exact questions, in the order they are asked.',
        'What happens to the answers of someone who turns out not to be eligible.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  // -- Instruments ---------------------------------------------------------

  if (PATTERNS.survey.test(text) || answers['intake.2_5.how'] === 'implied') {
    documents.push({
      id: 'survey_instrument',
      title: 'The survey or questionnaire itself',
      necessity: 'required',
      why: 'Your answers describe a survey or questionnaire. The Board reads the actual items, not a summary of them.',
      appendix: 'Research instruments: questionnaires, interview or focus group questions',
      formSection: '2.6',
      checklist: [
        'Every question, in order, with the answer options as participants see them.',
        'Any branching or skip logic, marked.',
        'A way to decline an individual question, not only the survey as a whole.',
        'Demographic questions justified: the form asks why each one is collected.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (PATTERNS.interview.test(text) || PATTERNS.keyInformant.test(text)) {
    const keyInformant = PATTERNS.keyInformant.test(text)
    documents.push({
      id: 'interview_guide',
      title: keyInformant ? 'Key informant interview guide' : 'Interview guide',
      necessity: 'required',
      why: keyInformant
        ? 'Your answers describe key informant or stakeholder interviews. The Board expects the guide, including the questions you expect to follow up with.'
        : 'Your answers describe interviews. The Board expects the guide, including the questions you expect to follow up with.',
      appendix: 'Research instruments: questionnaires, interview or focus group questions',
      formSection: '2.6',
      checklist: [
        'Opening script: who you are, what the interview covers, that it can stop at any point.',
        'The questions themselves, with probes, marked as a guide rather than a script if that is how you will use it.',
        keyInformant
          ? 'How you handle a person who is identifiable by their role even without their name, which is the usual risk in key informant work.'
          : 'Any question likely to be difficult, and how you will handle it if someone becomes upset.',
        'Closing: what happens next, and how to reach you afterwards.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (PATTERNS.focusGroup.test(text)) {
    documents.push({
      id: 'focus_group_guide',
      title: 'Focus group guide and ground rules',
      necessity: 'required',
      why: 'Your answers describe a focus group or group session. The Board reads the guide, and looks for how confidentiality is handled between participants.',
      appendix: 'Research instruments: questionnaires, interview or focus group questions',
      formSection: '2.6',
      checklist: [
        'The discussion guide, with the opening and closing questions.',
        'Ground rules read out at the start, including what participants are asked not to repeat afterwards.',
        'A plain statement that you cannot guarantee what other participants will do with what they hear. This belongs in the consent form as well.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (PATTERNS.observation.test(text)) {
    documents.push({
      id: 'observation_protocol',
      title: 'Observation protocol',
      necessity: 'likely',
      why: 'Your answers describe observation or fieldwork. The Board looks for what is recorded, and how people who are present but not participating are handled.',
      appendix: 'Research instruments: questionnaires, interview or focus group questions',
      formSection: '2.6',
      checklist: [
        'What you record, and what you deliberately do not.',
        'How people present in the setting are told the research is happening.',
        'How anyone who does not want to be observed can say so.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (PATTERNS.visualMedia.test(text)) {
    documents.push({
      id: 'visual_media_consent',
      title: 'Instructions and a separate consent for photographs, video or diaries',
      necessity: 'likely',
      why: 'Your answers describe participants producing photographs, video, drawings or diary entries. Material like that often shows other people, who have not consented to anything.',
      appendix: 'Consent and assent documents or scripts',
      formSection: '2.6',
      checklist: [
        'What participants are asked to produce, and what they are asked not to photograph or record.',
        'A separate consent for any of it to be published or shown, with the choice to take part without agreeing to that.',
        'How third parties who appear in the material are handled.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  // -- Agreements ----------------------------------------------------------

  if (saidYesOrUnsure(answers, 'intake.2_6.recording')) {
    documents.push({
      id: 'confidentiality_agreement',
      title: 'Signed confidentiality agreement for anyone outside the research team',
      necessity: 'required',
      why: 'You said sessions will be recorded, or transcribed by someone outside the research team. Section 2.6.3 of the form asks for a signed agreement from each of them.',
      appendix: 'Confidentiality agreements for anyone transcribing recordings',
      formSection: '2.6',
      checklist: [
        'One per person: transcriptionist, translator, research assistant, anyone who hears or handles the recordings.',
        'Signed and dated before they receive anything.',
        'What they do with their copy when the work is finished.',
      ],
      templateFilename: TEMPLATES.confidentiality.filename,
      templateLabel: TEMPLATES.confidentiality.label,
      routedToHuman: false,
    })
  }

  if (
    saidYesOrUnsure(answers, 'intake.2_7.outside_canada') ||
    saidYesOrUnsure(answers, 'intake.2_7.health_information')
  ) {
    documents.push({
      id: 'data_agreements',
      title: 'Data sharing, transfer or access agreement',
      necessity: 'likely',
      why: saidYesOrUnsure(answers, 'intake.2_7.outside_canada')
        ? 'You said some of the information may be stored or processed outside Canada, which the Board asks about directly at 2.7.5.'
        : 'You said the research handles personal health information, which may bring it under Nova Scotia’s Personal Health Information Act.',
      appendix: 'Data transfer or data sharing agreements',
      formSection: '2.7',
      checklist: [
        'Who holds the data, where it physically sits, and under whose law.',
        'What the receiving party may and may not do with it.',
        'The custodian’s approval, where health information comes from a health authority.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (flagged) {
    documents.push({
      id: 'community_agreement',
      title: 'Research agreement with the community or partner organisation',
      necessity: 'required',
      why: buildCommunityWhy(project),
      appendix: 'Collaborative research agreements with Indigenous communities',
      formSection: '2.13',
      checklist: [
        'Prepared with the community, not for it. This tool does not draft it and does not suggest wording for it.',
        'Speak with the Research Ethics Office, and where Mi’kmaw communities are involved, about Mi’kmaw Ethics Watch.',
        'Ownership of the data and of the findings, and who approves what is published.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: true,
    })
  }

  // -- After participation -------------------------------------------------

  if (PATTERNS.distress.test(text) || saidYesOrUnsure(answers, 'intake.2_3.dependence')) {
    documents.push({
      id: 'debriefing',
      title: 'Debriefing sheet and list of support resources',
      necessity: 'likely',
      why: PATTERNS.distress.test(text)
        ? 'The risks or subject matter you described could leave someone distressed, and the Board looks for what a participant is handed afterwards.'
        : 'Where participants may be in a position of dependence, the Board looks for what they are handed after taking part.',
      appendix: 'Debriefing or study results templates',
      formSection: '2.9',
      checklist: [
        'What the study was about, restated plainly.',
        'Named support services with current contact details, local to where participants are.',
        'How to withdraw afterwards, and by when.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (answered(answers, 'intake.2_10.participants')) {
    documents.push({
      id: 'results_summary',
      title: 'Plain-language summary of the results for participants',
      necessity: 'consider',
      why: 'You described how results will be shared with the people who took part. If that is a written summary, the Board will want to see the template.',
      appendix: 'Debriefing or study results templates',
      formSection: '2.10',
      checklist: [
        'Written for the people who took part, not for a journal.',
        'How and when it reaches them, given they may have moved on by then.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  if (said(answers, 'yes', 'intake.2_10.individual')) {
    documents.push({
      id: 'individual_results',
      title: 'Plan for returning individual results',
      necessity: 'likely',
      why: 'You said someone will receive their own individual results. The form asks how they are delivered securely, how you make sure they are understood, and what risks come with receiving them.',
      appendix: 'Debriefing or study results templates',
      formSection: '2.10',
      checklist: [
        'How a result reaches one named person securely, without going to anyone else.',
        'Who explains it, and what happens if the result is distressing.',
        'What a participant is told in advance about what they might learn.',
      ],
      templateFilename: null,
      templateLabel: null,
      routedToHuman: false,
    })
  }

  return sortByNecessity(documents)
}

const NECESSITY_ORDER: Record<Necessity, number> = { required: 0, likely: 1, consider: 2 }

function sortByNecessity(documents: CompanionDocument[]): CompanionDocument[] {
  // A stable sort keeps the order the rules produced within each group, which is
  // roughly the order of the workflow: consent, recruitment, instruments, then
  // what happens afterwards.
  return [...documents].sort(
    (a, b) => NECESSITY_ORDER[a.necessity] - NECESSITY_ORDER[b.necessity],
  )
}

export function countByNecessity(documents: CompanionDocument[]): Record<Necessity, number> {
  return documents.reduce(
    (counts, document) => {
      counts[document.necessity] += 1
      return counts
    },
    { required: 0, likely: 0, consider: 0 } as Record<Necessity, number>,
  )
}

/** Templates this list points at, deduplicated, for a downloads panel. */
export function templatesReferenced(
  documents: CompanionDocument[],
): { filename: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const document of documents) {
    if (document.templateFilename && document.templateLabel) {
      seen.set(document.templateFilename, document.templateLabel)
    }
  }
  return [...seen].map(([filename, label]) => ({ filename, label }))
}

function consentPhrase(answers: AnswerMap): string {
  switch (answers['intake.2_5.how']) {
    case 'written':
      return 'in writing, signed before taking part'
    case 'verbal':
      return 'verbally, recorded by the researcher'
    case 'other':
      return 'in a way you described yourself'
    default:
      return 'from participants'
  }
}

/**
 * The consent checklist, tied to what this researcher said. Several lines only
 * appear because of an answer elsewhere in the application, which is the point:
 * a limit on confidentiality declared at 2.7 and absent from the consent form is
 * one of the most common reasons an application comes back.
 */
function consentChecklist(answers: AnswerMap): string[] {
  const checklist: string[] = [
    'What the study is, what taking part involves, and how long it takes.',
    'That taking part is voluntary, and that saying no carries no consequence.',
  ]

  if (answered(answers, 'intake.2_5.withdrawal')) {
    checklist.push(
      'How to withdraw and what happens to the data, including the point after which it can no longer be pulled out. You described this at 2.5; the consent form has to say the same thing.',
    )
  }

  if (answered(answers, 'intake.2_7.limits')) {
    checklist.push(
      'The limits on confidentiality you described at 2.7, stated plainly. A limit that appears in the application and not in the consent form is a common reason an application comes back.',
    )
  }

  if (answered(answers, 'intake.2_7.storage') || answered(answers, 'intake.2_7.retention')) {
    checklist.push('Where the information is kept, who can reach it, and for how long.')
  }

  if (saidYesOrUnsure(answers, 'intake.2_7.outside_canada')) {
    checklist.push('That some information may be stored or processed outside Canada.')
  }

  if (answered(answers, 'intake.2_4.incentive')) {
    checklist.push(
      'The compensation, including what happens to it if someone withdraws part way through.',
    )
  }

  if (saidYesOrUnsure(answers, 'intake.2_6.recording')) {
    checklist.push(
      'That the session is recorded, who transcribes it, and whether someone can take part without being recorded.',
    )
  }

  checklist.push(
    'Contact details for you, and for the Research Ethics Office, for someone with a concern about how they were treated.',
    'The paragraph about AI assistance, which Research Ethics Board Assistant includes at the end of your downloaded draft.',
  )

  return checklist
}

function buildCommunityWhy(project: Project): string {
  if (project.involvesIndigenousResearch && project.involvesCommunityEngagedResearch) {
    return 'Triage flagged this as research involving Indigenous Peoples and as community-engaged research.'
  }
  if (project.involvesIndigenousResearch) {
    return 'Triage flagged this as research involving First Nations, Inuit or Métis Peoples, which TCPS 2 Chapter 9 and community protocols govern.'
  }
  return 'Triage flagged this as community-engaged research, where a community organisation is a partner rather than a subject.'
}
