import 'server-only'

import { callModel } from '@/lib/anthropic/client'
import type { AnswerMap, NewInterpretation, Project } from '@/lib/data/types'
import { SECTIONS_BY_NUMBER } from '@/lib/form/dalhousie-sections'
import { isAnthropicConfigured } from '@/lib/env'
import { allQuestions } from '@/lib/intake/questions'

import { METHODOLOGY_SECTIONS, deriveInterpretations } from './interpret'

/**
 * The tool's reading of the methodology, reasoned rather than restated.
 *
 * This is the step the whole verification loop exists for. A rule-derived
 * reading repeats the researcher's answers back in a fixed shape: faithful, and
 * therefore impossible to disagree with, which makes confirming it prove
 * nothing. A reading that can be wrong is the only kind worth confirming, and
 * guardrail 3 is only a real check once the thing being checked can fail.
 *
 * So this asks for what follows from the answers, not what the answers said. The
 * researcher then confirms, alters or rejects it, and a rejection sends the
 * project back to intake.
 *
 * One call covers every methodology section rather than one call each. Half the
 * misreadings worth catching are between sections, not inside one: a recruitment
 * route that does not fit the stated population, consent that does not match how
 * the data is captured. A per-section call cannot see those.
 *
 * If the model is not configured, refuses, or returns something unusable, this
 * falls back to the rule-derived reading rather than failing. A researcher is
 * never stuck at this step, and `modelVersion` stays null so a later reader can
 * tell which rounds were machine-reasoned.
 */

const SYSTEM_PROMPT = `
You are helping a researcher check that a Research Ethics Board preparation tool has
understood their study before it drafts anything from it.

For each section you are given, write what you understand the research team to be doing.
This is a reading, not a summary. Do not repeat their answers back to them. State what
follows from what they wrote: who will actually be approached and how, what a participant
will experience, what is collected, what happens to it afterwards.

Write it so that a researcher could recognise it as wrong. A reading nobody could disagree
with is useless here, because they are being asked to confirm it. Where their answers leave
something genuinely ambiguous, say which way you have read it and that you may have it
backwards.

Where two sections do not sit together, say so plainly in the reading for the section it
affects. A recruitment route that does not reach the population described, or a consent
process that does not match how data is captured, is exactly what this step is for.

Write in the second person, addressed to the researcher: "You are recruiting...". Two to
five sentences per section. Plain language, no jargon, no headings, no bullet points.

You must never state or imply that the research is approved, compliant, exempt, adequate,
ethical, low risk, or that it meets any requirement, and never suggest a change. You are
not the Research Ethics Board and you are not reviewing the study. You are only saying what
you understood, so the researcher can tell you if you got it wrong.

Never write a participant's name, contact details or any other identifying information,
even if it appears in the material you are given.
`.trim()

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          formSection: { type: 'string', enum: [...METHODOLOGY_SECTIONS] },
          reading: { type: 'string' },
        },
        required: ['formSection', 'reading'],
        additionalProperties: false,
      },
    },
  },
  required: ['readings'],
  additionalProperties: false,
} as const

export interface InterpretInput {
  project: Project
  answers: AnswerMap
  userId?: string
}

export async function interpretMethodology({
  project,
  answers,
  userId,
}: InterpretInput): Promise<NewInterpretation[]> {
  const fallback = deriveInterpretations(answers)

  if (!isAnthropicConfigured) return fallback

  const sections = METHODOLOGY_SECTIONS.map((formSection) => ({
    formSection,
    title: SECTIONS_BY_NUMBER[formSection]?.title ?? formSection,
    sources: sourcesFor(formSection, answers),
  })).filter((section) => section.sources.length > 0)

  if (sections.length === 0) return fallback

  const result = await callModel({
    purpose: 'method_check',
    projectId: project.id,
    userId,
    system: SYSTEM_PROMPT,
    effort: 'high',
    maxTokens: 4000,
    jsonSchema: RESPONSE_SCHEMA,
    messages: [
      {
        role: 'user',
        content: [
          `Study: ${project.title}`,
          project.plainLanguageSummary ? `Summary: ${project.plainLanguageSummary}` : '',
          '',
          'The researcher answered the following, section by section.',
          '',
          ...sections.map((section) =>
            [
              `Section ${section.formSection}: ${section.title}`,
              ...section.sources.map((source) => `  Q: ${source.question}\n  A: ${source.answer}`),
            ].join('\n'),
          ),
          '',
          `Write one reading for each of these sections: ${sections
            .map((section) => section.formSection)
            .join(', ')}.`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  })

  // A refusal is not an error the researcher should be shown here. The redaction
  // gate refusing means their answers held something that must not be sent, and
  // they will meet that message at the drafting step where they can act on it.
  // Stopping the workflow at method check would strand them with nothing to do.
  if (!result.ok) return fallback

  const readings = parseReadings(result.text)
  if (readings.length === 0) return fallback

  return readings.map((reading) => ({
    formSection: reading.formSection,
    interpretation: reading.reading.trim(),
    modelVersion: result.modelVersion,
  }))
}

/**
 * The response is schema-constrained, so this should always parse. It is guarded
 * anyway: an unparseable response falling back to the rule-derived reading is a
 * worse method check, while an exception here is a researcher who cannot leave
 * intake.
 */
function parseReadings(text: string): { formSection: string; reading: string }[] {
  try {
    const parsed = JSON.parse(text) as { readings?: unknown }
    if (!Array.isArray(parsed.readings)) return []

    return parsed.readings.filter(
      (entry): entry is { formSection: string; reading: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { formSection?: unknown }).formSection === 'string' &&
        typeof (entry as { reading?: unknown }).reading === 'string' &&
        (entry as { reading: string }).reading.trim().length > 0,
    )
  } catch {
    return []
  }
}

/** The researcher's answers for one section, in the order they were asked. */
function sourcesFor(
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
