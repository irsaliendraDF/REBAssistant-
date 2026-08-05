import { describe, expect, it } from 'vitest'

import type { AnswerMap } from '@/lib/data/types'

import { allResolved, deriveInterpretations, hasRejection } from './interpret'

const METHOD_ANSWERS: AnswerMap = {
  'intake.2_3.who': 'Homeowners in rural Nova Scotia.',
  'intake.2_3.dependence': 'no',
  'intake.2_4.how': 'Posters in community centres.',
  'intake.2_6.what_happens': 'One 45 minute interview.',
  'intake.2_6.recording': 'yes',
  'intake.2_7.identifiability': 'coded',
}

describe('deriveInterpretations', () => {
  it('produces one reading per methodology section that has answers', () => {
    const items = deriveInterpretations(METHOD_ANSWERS)
    expect(items.map((item) => item.formSection)).toEqual(['2.3', '2.4', '2.6', '2.7'])
  })

  it('skips sections with nothing answered, rather than reading back an empty one', () => {
    const items = deriveInterpretations(METHOD_ANSWERS)
    expect(items.map((item) => item.formSection)).not.toContain('2.5')
  })

  it('produces nothing at all when no methodology answers exist', () => {
    expect(deriveInterpretations({})).toEqual([])
    expect(deriveInterpretations({ 'intake.2_2.question': 'A question' })).toEqual([])
  })

  it('reads choices back in the researcher’s own wording, not the stored value', () => {
    const items = deriveInterpretations(METHOD_ANSWERS)
    const privacy = items.find((item) => item.formSection === '2.7')!
    expect(privacy.interpretation).toContain('Coded, with a key held separately')
    expect(privacy.interpretation).not.toMatch(/\bcoded\b/)
  })

  it('marks a rule-derived reading with a null model version', () => {
    // The honest marker of what produced this. It is what tells a later reader
    // which rounds were machine-reasoned and which were merely restated.
    for (const item of deriveInterpretations(METHOD_ANSWERS)) {
      expect(item.modelVersion).toBeNull()
    }
  })

  it('includes the answer text, so there is something real to check', () => {
    const items = deriveInterpretations(METHOD_ANSWERS)
    const population = items.find((item) => item.formSection === '2.3')!
    expect(population.interpretation).toContain('Homeowners in rural Nova Scotia.')
  })
})

describe('the gate condition', () => {
  const pending = { response: 'pending' }
  const confirmed = { response: 'confirmed' }
  const altered = { response: 'altered' }
  const rejected = { response: 'rejected' }

  it('is not satisfied while anything is unreviewed', () => {
    expect(allResolved([confirmed, pending])).toBe(false)
  })

  it('is satisfied once every reading has a response', () => {
    expect(allResolved([confirmed, altered])).toBe(true)
  })

  it('is not satisfied by an empty set, so an empty check cannot be walked past', () => {
    expect(allResolved([])).toBe(false)
  })

  it('counts a correction as reviewed', () => {
    expect(allResolved([altered])).toBe(true)
  })

  it('detects a rejection anywhere in the set', () => {
    expect(hasRejection([confirmed, rejected, confirmed])).toBe(true)
    expect(hasRejection([confirmed, altered])).toBe(false)
  })

  it('treats a rejected set as resolved but not passable', () => {
    // Both conditions are checked before advancing: resolved says everyone
    // answered, rejection says one of those answers was "you have this wrong".
    const items = [confirmed, rejected]
    expect(allResolved(items)).toBe(true)
    expect(hasRejection(items)).toBe(true)
  })
})
