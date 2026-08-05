import type { AnswerMap, Project } from '@/lib/data/types'
import { countWords } from '@/lib/form/dalhousie-sections'
import { missingRequired, visibleSections } from '@/lib/intake/questions'

/**
 * Gap analysis.
 *
 * What looks missing or thin, and what looks inconsistent, tied to the section
 * it affects.
 *
 * Guardrail 6 governs every string in this file. These are observations, not
 * determinations. Nothing here says an application is compliant, adequate,
 * sufficient or approvable, and the severity scale is descriptive rather than
 * judgemental for the same reason. The Board decides; this points.
 *
 * ON CITATIONS. Findings carry a TCPS2 reference at chapter level, because
 * chapter numbering is something this file can state accurately. Article-level
 * citations are deliberately absent until the knowledge base is ingested, at
 * which point they come from the source document with a retrievable chunk behind
 * them. A drafting tool inventing plausible-looking article numbers into a
 * research ethics application is a worse failure than citing nothing: the
 * researcher cannot tell the difference, and the Board can.
 *
 * The rules below are deterministic. Model-generated findings will be added
 * alongside them, flagged with `aiGenerated`, not in place of them: a rule that
 * always catches a contradiction is worth more than a model that usually does.
 */

export type GapSeverity = 'missing' | 'thin' | 'worth_reviewing'

export interface GapFinding {
  formSection: string | null
  severity: GapSeverity
  /** Advisory wording, shown to the researcher as written. */
  finding: string
  /** Chapter-level only until ingestion. Null where no chapter applies cleanly. */
  tcps2Reference: string | null
  aiGenerated: boolean
  modelVersion: string | null
}

/** Chapters this file can name with confidence. */
const TCPS2 = {
  consent: 'TCPS 2, Chapter 3: The Consent Process',
  fairness: 'TCPS 2, Chapter 4: Fairness and Equity in Research Participation',
  privacy: 'TCPS 2, Chapter 5: Privacy and Confidentiality',
  indigenous:
    'TCPS 2, Chapter 9: Research Involving the First Nations, Inuit and Métis Peoples of Canada',
  qualitative: 'TCPS 2, Chapter 10: Qualitative Research',
  trials: 'TCPS 2, Chapter 11: Clinical Trials',
} as const

/** Below this, a narrative answer is unlikely to carry a Board. */
const THIN_WORD_COUNT = 15

const NONE_ISH = /^\s*(none|n\.?\/?a\.?|no risks?|nil|not applicable)\s*\.?\s*$/i

function rule(
  finding: string,
  formSection: string | null,
  severity: GapSeverity,
  tcps2Reference: string | null = null,
): GapFinding {
  return { formSection, severity, finding, tcps2Reference, aiGenerated: false, modelVersion: null }
}

export function analyseGaps(project: Project, answers: AnswerMap): GapFinding[] {
  const findings: GapFinding[] = [
    ...missingSections(answers),
    ...thinAnswers(answers),
    ...consistencyChecks(answers),
    ...flagChecks(project),
  ]

  // Most consequential first, so a long list still reads usefully from the top.
  const order: Record<GapSeverity, number> = { missing: 0, worth_reviewing: 1, thin: 2 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Sections whose required questions have not been answered. */
function missingSections(answers: AnswerMap): GapFinding[] {
  return visibleSections(answers)
    .filter((section) => missingRequired(section.questions, answers).length > 0)
    .map((section) =>
      rule(
        `Section ${section.formSection}, ${section.title.toLowerCase()}, is not complete. The Board will expect this section to be filled in.`,
        section.formSection,
        'missing',
      ),
    )
}

/** Answers present but short enough that a Board is likely to come back on them. */
function thinAnswers(answers: AnswerMap): GapFinding[] {
  const findings: GapFinding[] = []

  for (const section of visibleSections(answers)) {
    for (const question of section.questions) {
      if (question.type !== 'textarea') continue
      // Required questions only. Applying this to optional ones too produced
      // roughly nine findings on a reasonable application, which is the fastest
      // way to teach a researcher that findings are noise worth scrolling past.
      if (!question.required) continue
      const answer = answers[question.key]
      if (!answer || answer.trim().length === 0) continue
      if (countWords(answer) >= THIN_WORD_COUNT) continue

      findings.push(
        rule(
          `Your answer to "${question.label}" is brief. Reviewers usually look for enough detail to picture what happens without asking follow-up questions.`,
          section.formSection,
          'thin',
        ),
      )
    }
  }

  return findings
}

/**
 * Answers that contradict each other, or that commonly draw questions.
 *
 * These are the findings worth having. A missing section is obvious to the
 * researcher; two answers that cannot both be true is exactly what gets missed
 * when a long form is filled in over three weeks.
 */
function consistencyChecks(answers: AnswerMap): GapFinding[] {
  const findings: GapFinding[] = []

  const identifiability = answers['intake.2_7.identifiability']
  const recording = answers['intake.2_6.recording']
  const withdrawal = answers['intake.2_5.withdrawal']
  const dependence = answers['intake.2_3.dependence']
  const outsideCanada = answers['intake.2_7.outside_canada']
  const risks = answers['intake.2_9.risks']
  const incentive = answers['intake.2_4.incentive']
  const intervention = answers['intake.2_6.intervention']

  if (identifiability === 'anonymous' && recording === 'yes') {
    findings.push(
      rule(
        'You have described the data as anonymous, and also said sessions will be recorded. A voice or video recording is identifiable. These two answers are hard to hold together, and the Board will notice.',
        '2.7',
        'worth_reviewing',
        TCPS2.privacy,
      ),
    )
  }

  if (identifiability === 'anonymous' && withdrawal && /withdraw|delete|remove/i.test(withdrawal)) {
    findings.push(
      rule(
        'You have described the data as anonymous, and also offered participants the ability to withdraw their data. If nothing links a person to their data, there is no way to find and remove it. Consider saying at what point withdrawal stops being possible.',
        '2.5',
        'worth_reviewing',
        TCPS2.consent,
      ),
    )
  }

  if (dependence === 'yes' || dependence === 'unsure') {
    findings.push(
      rule(
        'You indicated that some participants may be in a position of dependence on you or have reduced capacity to consent. The consent process usually needs to say specifically how undue influence is avoided, for example who does the asking and how a refusal is kept private.',
        '2.5',
        'worth_reviewing',
        TCPS2.consent,
      ),
    )
  }

  if (dependence === 'yes' && incentive && incentive.trim().length > 0) {
    findings.push(
      rule(
        'Compensation is offered, and some participants may be in a dependent relationship. Boards look closely at whether an amount could make it hard for those participants to decline.',
        '2.4',
        'worth_reviewing',
        TCPS2.fairness,
      ),
    )
  }

  if (recording === 'yes') {
    findings.push(
      rule(
        'Sessions will be recorded. If anyone outside the research team transcribes them, the form asks for a signed confidentiality agreement at 2.6.3.',
        '2.6',
        'worth_reviewing',
        TCPS2.privacy,
      ),
    )
  }

  if (outsideCanada === 'yes' || outsideCanada === 'unsure') {
    findings.push(
      rule(
        outsideCanada === 'unsure'
          ? 'You were not sure whether data will be stored or processed outside Canada. Section 2.7.5 asks this directly, and cloud services often store data outside Canada by default, so this is worth checking with whoever administers the tools you plan to use.'
          : 'Data will be stored or processed outside Canada. Section 2.7.5 asks you to say so, and participants are usually told in the consent form what that means for them.',
        '2.7',
        'worth_reviewing',
        TCPS2.privacy,
      ),
    )
  }

  if (risks && NONE_ISH.test(risks)) {
    findings.push(
      rule(
        'The risks section says there are none. Very few studies have no risk at all once inconvenience, discomfort and social consequences are counted, and "none" tends to draw more questions from a Board than naming a small risk and saying how it is handled.',
        '2.9',
        'worth_reviewing',
        null,
      ),
    )
  }

  if (intervention === 'yes') {
    findings.push(
      rule(
        'You indicated a health intervention or clinical procedure. Applications of this kind carry additional requirements, and the clinical trials section will be reviewed closely.',
        '2.14',
        'worth_reviewing',
        TCPS2.trials,
      ),
    )
  }

  return findings
}

/** Guardrail 4 restated as a finding, so it appears in the list the researcher works from. */
function flagChecks(project: Project): GapFinding[] {
  const findings: GapFinding[] = []

  if (project.involvesIndigenousResearch) {
    findings.push(
      rule(
        'This project was flagged as involving Indigenous Peoples. Those sections are not drafted by this tool. Please speak with the Research Ethics Office and with the relevant community about what is required.',
        '2.13',
        'worth_reviewing',
        TCPS2.indigenous,
      ),
    )
  }

  if (project.involvesCommunityEngagedResearch) {
    findings.push(
      rule(
        'This project was flagged as community-engaged. The study population, recruitment and consent sections are not drafted by this tool, and the Board will look for evidence of how the community partner shaped the research.',
        '2.3',
        'worth_reviewing',
        TCPS2.indigenous,
      ),
    )
  }

  return findings
}

export function countBySeverity(findings: GapFinding[]): Record<GapSeverity, number> {
  return {
    missing: findings.filter((finding) => finding.severity === 'missing').length,
    worth_reviewing: findings.filter((finding) => finding.severity === 'worth_reviewing').length,
    thin: findings.filter((finding) => finding.severity === 'thin').length,
  }
}
