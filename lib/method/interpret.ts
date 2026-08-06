import type { AnswerMap, NewInterpretation } from '@/lib/data/types'
import { SECTIONS_BY_NUMBER } from '@/lib/form/dalhousie-sections'
import { allQuestions } from '@/lib/intake/questions'

/**
 * Building the tool's reading of the methodology, for the researcher to confirm,
 * alter or reject.
 *
 * WHAT THIS IS TODAY, honestly. With no model key, the reading below is derived
 * by rule: it restates the answers under each methodology-bearing section in a
 * fixed shape. It is a faithful summary, which also means it cannot
 * misunderstand, so confirming it is a weaker check than the one the method
 * check is ultimately for. It still catches the ordinary failures, answers filed
 * under a section the researcher did not intend, or an answer that reads
 * differently out of the box it was typed into.
 *
 * WHAT CHANGES when the key arrives: `deriveInterpretations` is replaced by a
 * model call through `lib/anthropic/client.ts`, and `modelVersion` stops being
 * null. Nothing else moves. The loop, the audit trail, the requirement to supply
 * a correction, and the backward transition on rejection are all real now and
 * are what the model output will plug into.
 *
 * `modelVersion: null` is the honest marker of a rule-derived reading, and it is
 * what tells a later reader which rounds were machine-reasoned.
 */

/** The sections whose answers describe how the research is actually done. */
export const METHODOLOGY_SECTIONS = ['2.3', '2.4', '2.5', '2.6', '2.7', '2.8'] as const

export function deriveInterpretations(answers: AnswerMap): NewInterpretation[] {
  const questions = allQuestions()

  return METHODOLOGY_SECTIONS.map((formSection): NewInterpretation | null => {
    const relevant = questions.filter((question) => question.formSection === formSection)

    const lines = relevant
      .map((question) => {
        const answer = answers[question.key]
        if (!answer || answer.trim().length === 0) return null

        const option = question.options?.find((candidate) => candidate.value === answer)
        return `${question.label} ${option ? option.label : answer.trim()}`
      })
      .filter((line): line is string => line !== null)

    if (lines.length === 0) return null

    const title = SECTIONS_BY_NUMBER[formSection]?.title ?? formSection

    return {
      formSection,
      interpretation: [
        `On ${title.toLowerCase()}, we have understood the following:`,
        '',
        ...lines.map((line) => `• ${line}`),
      ].join('\n'),
      modelVersion: null,
    }
  }).filter((item): item is NewInterpretation => item !== null)
}

/** True once every reading has had a response. Guardrail 3's gate condition. */
export function allResolved(
  items: { response: string }[],
): boolean {
  return items.length > 0 && items.every((item) => item.response !== 'pending')
}

/** Any rejection sends the project backwards, not through. */
export function hasRejection(items: { response: string }[]): boolean {
  return items.some((item) => item.response === 'rejected')
}
