import { describe, expect, it } from 'vitest'

import { isGenerationBlocked } from '@/lib/form/dalhousie-sections'

import {
  INTAKE_SECTIONS,
  TRIAGE_COMMUNITY_KEY,
  TRIAGE_INDIGENOUS_KEY,
  TRIAGE_QUESTIONS,
  allQuestions,
  missingRequired,
  sectionMap,
  triageFlags,
  visibleSections,
} from './questions'

describe('the question set as a whole', () => {
  it('uses a unique key for every question', () => {
    const keys = allQuestions().map((question) => question.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every intake question a form section, so no answer is orphaned', () => {
    for (const section of INTAKE_SECTIONS) {
      for (const question of section.questions) {
        expect(question.formSection).toBe(section.formSection)
      }
    }
  })

  it('gives every choice question options to choose from', () => {
    for (const question of allQuestions()) {
      if (question.type === 'choice') {
        expect(question.options?.length ?? 0).toBeGreaterThan(1)
      }
    }
  })

  it('never asks for a participant name or contact details', () => {
    // Guardrail 2 is enforced by the schema, but the surest way to keep this
    // data out is not to invite it. This test is a tripwire on new questions.
    const forbidden = /\b(participant|their|his|her|interviewee|respondent)['’s]*\s+(name|full name|email|phone|address|contact)\b/i
    for (const question of allQuestions()) {
      expect(question.label, `question ${question.key}`).not.toMatch(forbidden)
    }
  })
})

describe('triageFlags', () => {
  it('flags when the answer is yes', () => {
    expect(triageFlags({ [TRIAGE_INDIGENOUS_KEY]: 'yes' }).indigenous).toBe(true)
    expect(triageFlags({ [TRIAGE_COMMUNITY_KEY]: 'yes' }).communityEngaged).toBe(true)
  })

  it('flags when the researcher is not sure', () => {
    // The cost of flagging is a conversation with a person. The cost of not
    // flagging is a drafting tool improvising on TCPS2 Chapter 9. Uncertainty
    // resolves toward the person, and that is a guardrail decision, not a
    // default worth quietly changing.
    expect(triageFlags({ [TRIAGE_INDIGENOUS_KEY]: 'unsure' }).indigenous).toBe(true)
    expect(triageFlags({ [TRIAGE_COMMUNITY_KEY]: 'unsure' }).communityEngaged).toBe(true)
  })

  it('does not flag on a clear no', () => {
    const flags = triageFlags({
      [TRIAGE_INDIGENOUS_KEY]: 'no',
      [TRIAGE_COMMUNITY_KEY]: 'no',
    })
    expect(flags).toEqual({ indigenous: false, communityEngaged: false })
  })

  it('does not flag an unanswered question, because triage cannot be left unanswered', () => {
    expect(triageFlags({})).toEqual({ indigenous: false, communityEngaged: false })
    expect(missingRequired(TRIAGE_QUESTIONS, {})).toContain(TRIAGE_INDIGENOUS_KEY)
  })

  it('blocks generation of the affected sections once flagged', () => {
    const flags = triageFlags({ [TRIAGE_INDIGENOUS_KEY]: 'unsure' })
    expect(isGenerationBlocked('2.3', flags)).toBe(true)
    expect(isGenerationBlocked('2.13', flags)).toBe(true)
  })

  it('blocks section 2.13 even when nothing was flagged', () => {
    const flags = { indigenous: false, communityEngaged: false }
    expect(isGenerationBlocked('2.13', flags)).toBe(true)
  })
})

describe('missingRequired', () => {
  it('lists only required questions that have no answer', () => {
    const missing = missingRequired(TRIAGE_QUESTIONS, {})
    const requiredKeys = TRIAGE_QUESTIONS.filter((q) => q.required).map((q) => q.key)
    expect(missing).toEqual(requiredKeys)
  })

  it('treats whitespace as no answer', () => {
    const answers = Object.fromEntries(TRIAGE_QUESTIONS.map((q) => [q.key, '   ']))
    expect(missingRequired(TRIAGE_QUESTIONS, answers).length).toBeGreaterThan(0)
  })

  it('is empty once every required question is answered', () => {
    const answers = Object.fromEntries(TRIAGE_QUESTIONS.map((q) => [q.key, 'answered']))
    expect(missingRequired(TRIAGE_QUESTIONS, answers)).toEqual([])
  })

  it('ignores optional questions', () => {
    const optional = INTAKE_SECTIONS.find((s) => s.formSection === '2.12')!
    expect(missingRequired(optional.questions, {})).toEqual([])
  })
})

describe('visibleSections', () => {
  it('hides the conditional sections by default', () => {
    const shown = visibleSections({}).map((section) => section.formSection)
    expect(shown).not.toContain('2.14')
    expect(shown).not.toContain('2.15')
  })

  it('reveals clinical trials once an intervention is indicated', () => {
    const shown = visibleSections({ 'intake.2_6.intervention': 'yes' }).map((s) => s.formSection)
    expect(shown).toContain('2.14')
  })

  it('reveals personal health information once that is indicated', () => {
    const shown = visibleSections({ 'intake.2_7.health_information': 'yes' }).map(
      (s) => s.formSection,
    )
    expect(shown).toContain('2.15')
  })

  it('does not reveal them on unsure, since the follow-up questions assume a yes', () => {
    const shown = visibleSections({ 'intake.2_6.intervention': 'unsure' }).map((s) => s.formSection)
    expect(shown).not.toContain('2.14')
  })

  it('keeps the sections in form order', () => {
    // Section numbers are not decimals and do not sort as strings either: 2.10
    // follows 2.9, but Number('2.10') is 2.1 and '2.10' < '2.9' alphabetically.
    // Compare the parts as integers.
    const parts = (formSection: string) => formSection.split('.').map(Number)
    const shown = visibleSections({
      'intake.2_6.intervention': 'yes',
      'intake.2_7.health_information': 'yes',
    }).map((section) => parts(section.formSection))

    for (let i = 1; i < shown.length; i++) {
      const [major, minor] = shown[i]
      const [previousMajor, previousMinor] = shown[i - 1]
      expect(major === previousMajor ? minor > previousMinor : major > previousMajor).toBe(true)
    }
  })

  it('never offers the routed section as an intake step', () => {
    // Guardrail 4: section 2.13 goes to a person, so it is not a page of
    // questions the tool collects answers for.
    expect(visibleSections({}).map((s) => s.formSection)).not.toContain('2.13')
  })
})

describe('sectionMap', () => {
  it('maps each question key to the form section it feeds', () => {
    const section = INTAKE_SECTIONS.find((s) => s.formSection === '2.9')!
    const map = sectionMap(section.questions)
    for (const question of section.questions) {
      expect(map[question.key]).toBe('2.9')
    }
  })
})
