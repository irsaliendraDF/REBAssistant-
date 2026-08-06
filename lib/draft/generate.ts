import 'server-only'

import { callModel } from '@/lib/anthropic/client'
import type { AnswerMap, Project } from '@/lib/data/types'
import {
  SECTIONS_BY_NUMBER,
  countWords,
  isGenerationBlocked,
  wordLimitFor,
} from '@/lib/form/dalhousie-sections'
import { allQuestions } from '@/lib/intake/questions'

/**
 * Model-assisted drafting of one form section.
 *
 * Everything the tool refuses to do is enforced here in code, before a request
 * can be constructed, rather than asked for in the prompt. A prompt is a request;
 * a guard is a guarantee, and guardrails 4 and 6 are contractual.
 */

export type DraftRefusal =
  /** Guardrail 4. The section is routed to a person, or triage flagged the project. */
  | 'blocked_by_guardrail'
  /** Nothing was captured for this section, so there is nothing to draft from. */
  | 'no_source_material'
  /** The redaction gate stopped the request. */
  | 'refused_by_redaction_gate'
  /** The model declined. */
  | 'declined_by_model'

export type SectionDraftResult =
  | {
      ok: true
      content: string
      modelVersion: string
      wordCount: number
      wordLimit?: number
      overWordLimit: boolean
    }
  | { ok: false; reason: DraftRefusal; message: string }

const SYSTEM_PROMPT = `
You help researchers at a Canadian university prepare Research Ethics Board applications.
You are drafting one section of a specific application form, from answers the researcher
has already given.

How to write:

- Write as the research team, in the voice a researcher would use on the form itself.
  Prose, not bullet points, unless the section is genuinely a list.
- Use only what the researcher supplied. If something the section needs is missing, say
  what is missing in one plain sentence rather than inventing a plausible detail. A
  fabricated methodology detail in a research ethics application is a serious problem,
  and a visible gap is not.
- Plain language. A Board member outside the discipline should follow it.
- No headings, no preamble, no "Here is the draft". Return only the section text.

What you must never do:

- Never state or imply that the research is approved, compliant, exempt, adequate, low
  risk, or that it meets any requirement. You are not the Board and cannot make an ethics
  determination. Describe what the research does; leave every judgement to the Board.
- Never write a participant's name, contact details, or any other identifying information,
  even if it appears in the material you are given.
- Never soften or omit a risk the researcher described. If they named a discomfort, it
  belongs in the draft.
`.trim()

export interface DraftSectionInput {
  project: Project
  answers: AnswerMap
  /** Form section number, e.g. '2.4'. */
  formSection: string
  userId?: string
}

export async function draftSection({
  project,
  answers,
  formSection,
  userId,
}: DraftSectionInput): Promise<SectionDraftResult> {
  const section = SECTIONS_BY_NUMBER[formSection]
  if (!section) {
    return { ok: false, reason: 'no_source_material', message: 'Unknown form section.' }
  }

  // Guardrail 4, checked in code before a prompt exists. There is deliberately
  // no path from a blocked section to a constructed request: the check cannot
  // be talked around, which is what makes it a guarantee rather than a request.
  const blocked = isGenerationBlocked(formSection, {
    indigenous: project.involvesIndigenousResearch,
    communityEngaged: project.involvesCommunityEngagedResearch,
  })

  if (blocked || section.generation === 'routed_to_human') {
    return {
      ok: false,
      reason: 'blocked_by_guardrail',
      message:
        section.routingNote ??
        'This section is not drafted by Research Ethics Board Assistant. Your answers are yours to write up, with the Research Ethics Office and, where relevant, the community.',
    }
  }

  if (section.generation !== 'ai_assisted') {
    return {
      ok: false,
      reason: 'blocked_by_guardrail',
      message: 'This section is completed from your saved details, not drafted.',
    }
  }

  const sources = sourcesFor(formSection, answers)
  if (sources.length === 0) {
    return {
      ok: false,
      reason: 'no_source_material',
      message: 'There are no answers for this section yet, so there is nothing to draft from.',
    }
  }

  const wordLimit = wordLimitFor(formSection)

  const result = await callModel({
    purpose: `draft:${formSection}`,
    projectId: project.id,
    userId,
    system: SYSTEM_PROMPT,
    effort: 'high',
    maxTokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          `Section ${formSection}: ${section.title}`,
          '',
          wordLimit
            ? `This section has a hard limit of ${wordLimit} words. Stay under it.`
            : 'Match the length to what the section needs. Do not pad.',
          '',
          'The researcher answered the following:',
          '',
          ...sources.map((source) => `Q: ${source.question}\nA: ${source.answer}`),
          '',
          `Write section ${formSection} of the application from these answers.`,
        ].join('\n'),
      },
    ],
  })

  if (!result.ok) {
    return {
      ok: false,
      reason:
        result.reason === 'refused_by_redaction_gate'
          ? 'refused_by_redaction_gate'
          : 'declined_by_model',
      message: result.message,
    }
  }

  const wordCount = countWords(result.text)

  return {
    ok: true,
    content: result.text,
    modelVersion: result.modelVersion,
    wordCount,
    wordLimit,
    // Reported, never enforced by truncation. Cutting a researcher's section at
    // the word limit would silently remove content they are responsible for.
    overWordLimit: wordLimit !== undefined && wordCount > wordLimit,
  }
}

/** The researcher's answers that feed one section, in the order they were asked. */
export function sourcesFor(
  formSection: string,
  answers: AnswerMap,
): { question: string; answer: string }[] {
  return allQuestions()
    .filter((question) => question.formSection === formSection)
    .map((question) => {
      const answer = answers[question.key]
      if (!answer || answer.trim().length === 0) return null

      const option = question.options?.find((candidate) => candidate.value === answer)
      return { question: question.label, answer: option ? option.label : answer.trim() }
    })
    .filter((entry): entry is { question: string; answer: string } => entry !== null)
}
