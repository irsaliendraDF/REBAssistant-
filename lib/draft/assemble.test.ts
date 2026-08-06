import { describe, expect, it } from 'vitest'

import { FORM_SECTIONS } from '@/lib/form/dalhousie-sections'
import {
  TRIAGE_SUMMARY_KEY,
  TRIAGE_TITLE_KEY,
} from '@/lib/intake/questions'
import type { AnswerMap, Project } from '@/lib/data/types'

import { assembleDraft } from './assemble'

/**
 * Assembly is where guardrails 4, 5 and 6 all show up in the artefact that
 * actually leaves the building. A .docx gets forwarded, printed and read by
 * people who never saw the interface, so what it does and does not claim matters
 * more here than anywhere else.
 */

const NOW = new Date('2026-08-05T12:00:00.000Z')

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

const SOME_ANSWERS: AnswerMap = {
  [TRIAGE_TITLE_KEY]: 'Community Retrofit Readiness',
  [TRIAGE_SUMMARY_KEY]: 'What stops rural homeowners from going ahead with energy retrofits.',
  'intake.2_2.question': 'What blocks retrofit uptake when funding exists?',
  'intake.2_3.who': 'Homeowners in rural Nova Scotia.',
  'intake.2_9.risks': 'Time cost, and discomfort discussing household finances.',
}

describe('structure', () => {
  it('produces every form section, in the form’s own order', () => {
    const draft = assembleDraft({ project: project(), answers: {}, now: NOW })
    expect(draft.sections.map((section) => section.number)).toEqual(
      FORM_SECTIONS.map((section) => section.number),
    )
  })

  it('files each answer under the section its question declares', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })

    const laySummary = draft.sections.find((section) => section.number === '2.1')!
    expect(laySummary.sources.map((source) => source.answer)).toContain(
      SOME_ANSWERS[TRIAGE_SUMMARY_KEY],
    )

    const population = draft.sections.find((section) => section.number === '2.3')!
    expect(population.sources).toHaveLength(1)
  })

  it('records the word limit on the lay summary', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    expect(draft.sections.find((section) => section.number === '2.1')?.wordLimit).toBe(500)
  })

  it('treats 2.11 as a from-record section, not as missing answers', () => {
    // It reads as "no answers captured yet" if from_record is special-cased to
    // section 1 alone, which tells the researcher to go and fill in a section
    // that is completed on the form itself.
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    const team = draft.sections.find((section) => section.number === '2.11')!
    expect(team.status).toBe('from_record')
    expect(draft.incompleteSections).not.toContain('2.11')
  })

  it('names sections with nothing behind them, rather than leaving them silently blank', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    expect(draft.incompleteSections).toContain('2.4')
    expect(draft.incompleteSections).not.toContain('2.3')
  })

  it('fills section 1 from the project record without a model', () => {
    const draft = assembleDraft({ project: project(), answers: {}, now: NOW })
    const admin = draft.sections.find((section) => section.number === '1')!
    expect(admin.status).toBe('from_record')
    expect(admin.content).toContain('Community Retrofit Readiness')
  })

  it('turns a stored choice value back into the wording the researcher saw', () => {
    const draft = assembleDraft({
      project: project(),
      answers: { 'intake.2_7.identifiability': 'coded' },
      now: NOW,
    })
    const privacy = draft.sections.find((section) => section.number === '2.7')!
    expect(privacy.sources[0].answer).toBe('Coded, with a key held separately')
  })
})

describe('guardrail 4: routing', () => {
  it('never drafts section 2.13, whatever the triage answers were', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    const indigenous = draft.sections.find((section) => section.number === '2.13')!
    expect(indigenous.status).toBe('routed')
    expect(indigenous.content).toBe('')
    // The form cites Articles 9.1 and 9.2 specifically, and also asks about
    // Mi'kmaw Ethics Watch and OCAP. The note names all three.
    expect(indigenous.note).toMatch(/TCPS 2 Articles 9\.1 and 9\.2/)
    expect(indigenous.note).toMatch(/Mi’kmaw Ethics Watch/)
  })

  it('marks the affected sections as not drafted when triage flagged the project', () => {
    const draft = assembleDraft({
      project: project({ involvesIndigenousResearch: true }),
      answers: SOME_ANSWERS,
      now: NOW,
    })
    const population = draft.sections.find((section) => section.number === '2.3')!
    expect(population.note).toMatch(/will not draft this section/i)
  })

  it('still carries the researcher’s own answers in a flagged section', () => {
    // Flagging blocks the tool from generating. It does not delete what the
    // researcher wrote, which is theirs and belongs in the document.
    const draft = assembleDraft({
      project: project({ involvesIndigenousResearch: true }),
      answers: SOME_ANSWERS,
      now: NOW,
    })
    const population = draft.sections.find((section) => section.number === '2.3')!
    expect(population.sources).toHaveLength(1)
  })
})

describe('guardrail 8: disclosure matches what actually happened', () => {
  it('states plainly that nothing was AI-generated, while nothing is', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    expect(draft.disclosure).toMatch(/no section of it had been generated by an/i)
  })

  it('never claims AI assistance that did not happen', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    expect(draft.disclosure).not.toMatch(/Sections drafted with AI assistance/)
  })

  it('names the routed sections so the Board knows what was excluded', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    expect(draft.disclosure).toContain('2.13')
  })

  it('names every section withheld because of a triage flag, not only 2.13', () => {
    // A community-engaged project has 2.3 to 2.5 withheld too. A disclosure
    // listing 2.13 alone understates what the tool declined to draft.
    const draft = assembleDraft({
      project: project({ involvesCommunityEngagedResearch: true }),
      answers: SOME_ANSWERS,
      now: NOW,
    })
    for (const section of ['2.3', '2.4', '2.5', '2.13']) {
      expect(draft.disclosure).toContain(section)
    }
  })

  it('withholds nothing beyond 2.13 when triage flagged nothing', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    const blocked = draft.sections.filter((section) => section.blockedFromDrafting)
    expect(blocked.map((section) => section.number)).toEqual(['2.13'])
  })

  it('says no participant-identifying information was stored', () => {
    const draft = assembleDraft({ project: project(), answers: {}, now: NOW })
    expect(draft.disclosure).toMatch(/No participant-identifying information/i)
  })

  it('marks the wording as a placeholder pending review', () => {
    const draft = assembleDraft({ project: project(), answers: {}, now: NOW })
    expect(draft.disclosure).toMatch(/placeholder/i)
  })
})

describe('guardrail 6: nothing here is a determination', () => {
  it('never says a section is approved, compliant, adequate or exempt', () => {
    const draft = assembleDraft({ project: project(), answers: SOME_ANSWERS, now: NOW })
    const text = [
      draft.disclosure,
      ...draft.sections.flatMap((section) => [section.note ?? '', section.content]),
    ].join(' ')

    expect(text).not.toMatch(/\b(approved|compliant|non-compliant|exempt|adequate|sufficient)\b/i)
  })
})
