import { describe, expect, it } from 'vitest'

import { allQuestions } from '@/lib/intake/questions'

import { FORM_SECTIONS } from './dalhousie-sections'
import {
  FORM_QUESTIONS,
  QUESTION_TO_FORM,
  formNumbersFor,
  printSectionFor,
  toolCoveredNumbers,
} from './dalhousie-questions'

/**
 * The map is the one place that says where an answer prints on the form. A
 * question missing from it would silently vanish from the Word document, and a
 * number that does not exist on the form would print an answer under a question
 * the Board never asked.
 */

describe('form questions', () => {
  it('holds all 54 numbered questions of the form, with no number twice', () => {
    expect(FORM_QUESTIONS).toHaveLength(54)
    expect(new Set(FORM_QUESTIONS.map((question) => question.number)).size).toBe(54)
  })

  it('keeps every question inside a section the form has', () => {
    const sections = new Set(FORM_SECTIONS.map((section) => section.number))
    for (const question of FORM_QUESTIONS) {
      expect(sections.has(question.section), question.number).toBe(true)
    }
  })

  it('numbers each question inside its own section', () => {
    for (const question of FORM_QUESTIONS) {
      expect(question.number.startsWith(question.section), question.number).toBe(true)
    }
  })
})

describe('where the tool’s questions print', () => {
  it('accounts for every question the tool asks, so none can vanish from the document', () => {
    for (const question of allQuestions()) {
      expect(Object.prototype.hasOwnProperty.call(QUESTION_TO_FORM, question.key), question.key).toBe(true)
    }
  })

  it('has no entry for a question the tool does not ask', () => {
    const keys = new Set(allQuestions().map((question) => question.key))
    for (const key of Object.keys(QUESTION_TO_FORM)) {
      expect(keys.has(key), key).toBe(true)
    }
  })

  it('only prints under numbers that exist on the form', () => {
    const numbers = new Set(FORM_QUESTIONS.map((question) => question.number))
    for (const [key, targets] of Object.entries(QUESTION_TO_FORM)) {
      for (const target of targets ?? []) {
        expect(numbers.has(target), `${key} -> ${target}`).toBe(true)
      }
    }
  })

  it('asks every numbered question on the form, other than those it leaves to the form or a person', () => {
    // 2.11 is completed on the form from the researcher's saved details and 2.13 is
    // routed to a person, so neither is asked. Every other question has at least one
    // of the tool's questions feeding it. This was 15 short until 31 October 2026.
    const never = FORM_QUESTIONS.filter(
      (question) =>
        question.section !== '2.11' &&
        question.section !== '2.13' &&
        !toolCoveredNumbers(question.section).includes(question.number),
    ).map((question) => question.number)

    expect(never).toEqual([])
  })

  it('moves dependence to 2.5.1 and incentives to 2.6.5, where the form asks them', () => {
    expect(formNumbersFor('intake.2_3.dependence')).toEqual(['2.5.1'])
    expect(formNumbersFor('intake.2_4.incentive')).toEqual(['2.6.5'])
    expect(printSectionFor('intake.2_3.dependence', '2.3')).toBe('2.5')
    expect(printSectionFor('intake.2_4.incentive', '2.4')).toBe('2.6')
  })

  it('feeds the keeper answer to both 2.8.2 and 2.8.3', () => {
    expect(formNumbersFor('intake.2_8.keeper')).toEqual(['2.8.2', '2.8.3'])
  })

  it('keeps a question with no form field in the section it was asked in', () => {
    expect(formNumbersFor('intake.2_7.health_information')).toEqual([])
    expect(printSectionFor('intake.2_7.health_information', '2.7')).toBe('2.7')
  })
})
