import { describe, expect, it, vi } from 'vitest'

import type { AnswerMap, Draft, Project } from '@/lib/data/types'
import {
  TRIAGE_SUMMARY_KEY,
  TRIAGE_TITLE_KEY,
  missingRequired,
  visibleSections,
} from '@/lib/intake/questions'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/anthropic/client', () => ({ callModel: vi.fn() }))
vi.mock('@/lib/kb/retrieve', () => ({ guidanceForSection: vi.fn(async () => []) }))

import { assembleDraft, splitDraft } from './assemble'
const { questionLayoutInstruction } = await import('./generate')

/**
 * The Word download prints each answer under the form's own question number, so
 * a researcher copies across number to number. These tests hold that layout.
 */

const NOW = new Date('2026-10-31T12:00:00.000Z')

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: null,
    institution: 'Dalhousie University',
    state: 'intake',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

const ANSWERS: AnswerMap = {
  [TRIAGE_TITLE_KEY]: 'Community Retrofit Readiness',
  [TRIAGE_SUMMARY_KEY]: 'What stops rural homeowners going ahead with retrofits.',
  'triage.board': 'social',
  'intake.2_3.who': 'Homeowners in rural Nova Scotia.',
  'intake.2_3.how_many': '15 to 20 interviews.',
  'intake.2_3.dependence': 'No one depends on the researcher.',
  'intake.2_4.third_party': 'no',
  'intake.2_4.incentive': 'A $25 gift card.',
}

function section(draft: ReturnType<typeof assembleDraft>, number: string) {
  const found = draft.sections.find((candidate) => candidate.number === number)
  if (!found) throw new Error(`no section ${number}`)
  return found
}

function part(draft: ReturnType<typeof assembleDraft>, sectionNumber: string, number: string) {
  const found = section(draft, sectionNumber).parts.find((candidate) => candidate.number === number)
  if (!found) throw new Error(`no part ${number}`)
  return found
}

describe('parts', () => {
  const draft = assembleDraft({ project: project(), answers: ANSWERS, now: NOW })

  it('prints each answer under its own form question', () => {
    expect(part(draft, '2.3', '2.3.1').answers.map((answer) => answer.answer)).toEqual([
      'Homeowners in rural Nova Scotia.',
    ])
    expect(part(draft, '2.3', '2.3.2').answers.map((answer) => answer.answer)).toEqual([
      '15 to 20 interviews.',
    ])
  })

  it('moves dependence to 2.5.1 and incentives to 2.6.5', () => {
    expect(part(draft, '2.5', '2.5.1').answers.map((answer) => answer.answer)).toContain(
      'No one depends on the researcher.',
    )
    expect(part(draft, '2.6', '2.6.5').answers.map((answer) => answer.answer)).toEqual([
      'A $25 gift card.',
    ])
    expect(part(draft, '2.3', '2.3.1').answers.map((answer) => answer.answer)).not.toContain(
      'No one depends on the researcher.',
    )
  })

  it('says which question is unanswered when another answer sits under the same number', () => {
    // 2.5.1 holds the dependence answer, and the consent-method question under the
    // same number was never answered. One answer must not hide the other gap.
    const consent = part(draft, '2.5', '2.5.1')
    expect(consent.status).toBe('answered')
    expect(consent.missing).toEqual(['How will you obtain consent, and at what point?'])
  })

  it('lists nothing as missing where every question under a number is answered', () => {
    expect(part(draft, '2.3', '2.3.1').missing).toBeUndefined()
  })

  it('lists every choice for a choice question, with the picked one ticked', () => {
    const choices = part(draft, '2.4', '2.4.1').answers[0].choices
    expect(choices?.length).toBeGreaterThan(1)
    expect(choices?.filter((choice) => choice.selected)).toHaveLength(1)
  })

  it('says plainly which questions the form leaves to the researcher', () => {
    expect(part(draft, '2.11', '2.11.1').status).toBe('for_form')
    expect(part(draft, '1', '1.1').status).toBe('for_form')
  })

  it('shows a question the tool asks and the researcher has not answered as unanswered', () => {
    expect(part(draft, '2.4', '2.4.2').status).toBe('unanswered')
    expect(part(draft, '2.4', '2.4.3').status).toBe('unanswered')
    expect(part(draft, '2.4', '2.4.4').status).toBe('unanswered')
  })

  it('holds every form question of a section in the form’s order', () => {
    expect(section(draft, '2.4').parts.map((candidate) => candidate.number)).toEqual([
      '2.4.1',
      '2.4.2',
      '2.4.3',
      '2.4.4',
      '2.4.5',
    ])
  })

  it('prints Section 1 as the title and Board, then blanks for what the tool never asks', () => {
    const parts = section(draft, '1').parts
    expect(parts[0].answers[0].answer).toBe('Community Retrofit Readiness')
    expect(parts[1].answers[0].answer).toBe('Social Sciences and Humanities')
    expect(parts.slice(2).map((candidate) => [candidate.number, candidate.status])).toEqual([
      ['1.1', 'for_form'],
      ['1.2', 'for_form'],
      ['1.3', 'for_form'],
      ['1.4', 'for_form'],
      ['1.5', 'for_form'],
    ])
  })

  it('keeps 2.13 routed whatever triage said, one part per question', () => {
    const routed = section(draft, '2.13').parts
    expect(routed.map((candidate) => candidate.number)).toEqual(['2.13.1', '2.13.2', '2.13.3', '2.13.4'])
    expect(routed.every((candidate) => candidate.status === 'routed')).toBe(true)
  })

  it('leaves 2.11 for the form', () => {
    expect(section(draft, '2.11').parts.every((candidate) => candidate.status === 'for_form')).toBe(true)
  })
})

describe('gated questions', () => {
  const GATE = 'intake.2_5.consent_exception'
  const DETAIL = 'intake.2_5.consent_exception_detail'

  it('shows a follow-up only once its gate is answered yes', () => {
    const hidden = visibleSections({ [GATE]: 'no' }).find((section) => section.formSection === '2.5')!
    expect(hidden.questions.map((question) => question.key)).not.toContain(DETAIL)

    const shown = visibleSections({ [GATE]: 'yes' }).find((section) => section.formSection === '2.5')!
    expect(shown.questions.map((question) => question.key)).toContain(DETAIL)
  })

  it('prints the gate answer under the form number, ticked, as the form’s own Not applicable box', () => {
    const draft = assembleDraft({ project: project(), answers: { [GATE]: 'no' }, now: NOW })
    const consentException = part(draft, '2.5', '2.5.4')
    expect(consentException.status).toBe('answered')
    expect(consentException.answers[0].choices?.find((choice) => choice.selected)?.label).toBe('No')
    expect(consentException.missing).toBeUndefined()
  })

  it('lists the follow-up as unanswered when the gate is yes and the follow-up is blank', () => {
    const draft = assembleDraft({ project: project(), answers: { [GATE]: 'yes' }, now: NOW })
    expect(part(draft, '2.5', '2.5.4').missing).toEqual([
      'Why can consent not be obtained in the usual way, and how will participants be told about the research afterwards?',
    ])
  })

  it('does not print a follow-up kept from before its gate was changed back to no', () => {
    const draft = assembleDraft({
      project: project(),
      answers: { [GATE]: 'no', [DETAIL]: 'An answer written while the gate said yes.' },
      now: NOW,
    })
    const printed = part(draft, '2.5', '2.5.4').answers.map((answer) => answer.answer)
    expect(printed).not.toContain('An answer written while the gate said yes.')
  })

  it('does not require a follow-up that is not shown', () => {
    const section = visibleSections({ [GATE]: 'no' }).find((entry) => entry.formSection === '2.5')!
    expect(missingRequired(section.questions, { [GATE]: 'no' })).not.toContain(DETAIL)
  })
})

describe('splitDraft', () => {
  it('gives the whole text to the one question when a section covers only one', () => {
    const split = splitDraft('A plain summary.', ['2.1.1'])
    expect(split.parts).toEqual({ '2.1.1': 'A plain summary.' })
    expect(split.text).toBe('A plain summary.')
  })

  it('splits on question markers and strips them from the section text', () => {
    const split = splitDraft('[[2.3.1]]\nHomeowners.\n\n[[2.3.2]]\nAbout twenty.', ['2.3.1', '2.3.2'])
    expect(split.parts).toEqual({ '2.3.1': 'Homeowners.', '2.3.2': 'About twenty.' })
    expect(split.text).toBe('Homeowners.\n\nAbout twenty.')
    expect(split.text).not.toContain('[[')
  })

  it('keeps the text whole when the model ignored the format and several questions apply', () => {
    const split = splitDraft('Homeowners, about twenty of them.', ['2.3.1', '2.3.2'])
    expect(split.parts).toEqual({})
    expect(split.text).toBe('Homeowners, about twenty of them.')
  })
})

describe('a drafted section', () => {
  const drafts: Draft[] = [
    {
      id: 'd1',
      projectId: 'p1',
      formSection: '2.3',
      content: '[[2.3.1]]\nHomeowners.\n\n[[2.3.2]]\nAbout twenty.',
      aiGenerated: true,
      modelVersion: 'test',
      wordCount: 6,
      createdAt: NOW.toISOString(),
    } as Draft,
  ]
  const draft = assembleDraft({ project: project(), answers: ANSWERS, drafts, now: NOW })

  it('prints each piece under its number and keeps the screen text free of markers', () => {
    expect(part(draft, '2.3', '2.3.1').drafted).toBe('Homeowners.')
    expect(part(draft, '2.3', '2.3.1').status).toBe('drafted')
    expect(part(draft, '2.3', '2.3.2').drafted).toBe('About twenty.')
    expect(section(draft, '2.3').content).not.toContain('[[')
  })

  it('still counts the section as drafted with AI assistance, for the disclosure', () => {
    expect(section(draft, '2.3').status).toBe('ai_drafted')
    expect(draft.disclosure).toContain('2.3')
  })
})

describe('the drafting prompt', () => {
  it('asks for numbered answers only where a section has more than one covered question', () => {
    expect(questionLayoutInstruction('2.3').join('\n')).toContain('[[2.3.1]]')
    expect(questionLayoutInstruction('2.1')).toEqual([])
    expect(questionLayoutInstruction('2.2')).toEqual([])
  })

  it('lists a question asked of everyone even before it is answered', () => {
    const text = questionLayoutInstruction('2.4').join('\n')
    expect(text).toContain('2.4.3')
    expect(text).toContain('2.4.4')
  })

  it('leaves out a question that only applies in some studies until it is answered', () => {
    // 2.5.4 and 2.5.5 apply only when the researcher seeks a consent exception or
    // uses deception. With the gates unanswered the model is not asked to write a
    // gap sentence about something that may not apply.
    const unanswered = questionLayoutInstruction('2.5', {}).join('\n')
    expect(unanswered).not.toContain('2.5.4')
    expect(unanswered).not.toContain('2.5.5')

    const answered = questionLayoutInstruction('2.5', { 'intake.2_5.consent_exception': 'no' }).join('\n')
    expect(answered).toContain('2.5.4')
    expect(answered).not.toContain('2.5.5')
  })
})
