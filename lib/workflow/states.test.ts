import { describe, expect, it } from 'vitest'

import {
  PROJECT_STATES,
  STATE_DEFINITIONS,
  assertValidStepBack,
  assertValidTransition,
  canGoBack,
  canTransition,
  previousState,
  progressPercent,
  stateIndex,
  type ProjectState,
} from './states'

/**
 * Tests for the workflow state machine.
 *
 * Guardrail 3 lives here: nothing advances without an explicit user action, and
 * a rejected method check goes backwards rather than through. Those are
 * contractual, so they are asserted rather than assumed.
 */

describe('the shape of the sequence', () => {
  it('runs triage to complete in order', () => {
    expect(PROJECT_STATES).toEqual([
      'triage',
      'intake',
      'method_check',
      'draft',
      'gap_analysis',
      'complete',
    ])
  })

  it('defines every state exactly once', () => {
    for (const state of PROJECT_STATES) {
      expect(STATE_DEFINITIONS[state]?.state).toBe(state)
    }
    expect(Object.keys(STATE_DEFINITIONS)).toHaveLength(PROJECT_STATES.length)
  })

  it('never names a next state that does not exist', () => {
    for (const state of PROJECT_STATES) {
      for (const next of STATE_DEFINITIONS[state].allowedNext) {
        expect(PROJECT_STATES).toContain(next)
      }
    }
  })
})

describe('transitions', () => {
  it.each([
    ['triage', 'intake'],
    ['intake', 'method_check'],
    ['method_check', 'draft'],
    ['draft', 'gap_analysis'],
    ['gap_analysis', 'complete'],
  ] as [ProjectState, ProjectState][])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it('sends a rejected method check backwards to intake, not forwards', () => {
    expect(canTransition('method_check', 'intake')).toBe(true)
  })

  it('is the only state permitted to move backwards', () => {
    const backwards = PROJECT_STATES.filter((state) =>
      STATE_DEFINITIONS[state].allowedNext.some((next) => stateIndex(next) < stateIndex(state)),
    )
    expect(backwards).toEqual(['method_check'])
  })

  it('does not let a project skip a step', () => {
    expect(canTransition('triage', 'draft')).toBe(false)
    expect(canTransition('intake', 'gap_analysis')).toBe(false)
    expect(canTransition('triage', 'complete')).toBe(false)
  })

  it('does not let a completed project move anywhere', () => {
    expect(STATE_DEFINITIONS.complete.allowedNext).toEqual([])
    for (const state of PROJECT_STATES) {
      expect(canTransition('complete', state)).toBe(false)
    }
  })

  it('rejects an invalid transition with a message naming what was allowed', () => {
    expect(() =>
      assertValidTransition({
        projectId: 'p1',
        from: 'triage',
        to: 'complete',
        actorId: 'user-1',
      }),
    ).toThrow(/triage -> complete/)
  })

  it('refuses a transition with no actor, because projects never advance on their own', () => {
    expect(() =>
      assertValidTransition({
        projectId: 'p1',
        from: 'triage',
        to: 'intake',
        actorId: '',
      }),
    ).toThrow(/requires an actor/)
  })

  it('accepts a valid transition with an actor', () => {
    expect(() =>
      assertValidTransition({
        projectId: 'p1',
        from: 'intake',
        to: 'method_check',
        actorId: 'user-1',
      }),
    ).not.toThrow()
  })
})

describe('stepping back', () => {
  it('goes back exactly one step from anywhere after the first', () => {
    expect(previousState('intake')).toBe('triage')
    expect(previousState('method_check')).toBe('intake')
    expect(previousState('draft')).toBe('method_check')
    expect(previousState('gap_analysis')).toBe('draft')
    expect(previousState('complete')).toBe('gap_analysis')
  })

  it('has nowhere to go back to from the first step', () => {
    expect(previousState('triage')).toBeNull()
    expect(canGoBack('triage')).toBe(false)
  })

  it('is offered from every other step', () => {
    for (const state of PROJECT_STATES.filter((s) => s !== 'triage')) {
      expect(canGoBack(state)).toBe(true)
    }
  })

  it('refuses to skip more than one step at a time', () => {
    expect(() =>
      assertValidStepBack({
        projectId: 'p1',
        from: 'complete',
        to: 'intake',
        actorId: 'user-1',
      }),
    ).toThrow(/one step at a time/)
  })

  it('refuses a step back with no actor', () => {
    expect(() =>
      assertValidStepBack({ projectId: 'p1', from: 'draft', to: 'method_check', actorId: '' }),
    ).toThrow(/requires an actor/)
  })

  it('accepts a single step back with an actor', () => {
    expect(() =>
      assertValidStepBack({
        projectId: 'p1',
        from: 'draft',
        to: 'method_check',
        actorId: 'user-1',
      }),
    ).not.toThrow()
  })

  it('leaves the forward path unchanged, so a back move cannot pass as a forward one', () => {
    // Stepping back is deliberately not in allowedNext. A caller reading the
    // forward path should never see a backward move in it.
    expect(canTransition('draft', 'method_check')).toBe(false)
    expect(canTransition('complete', 'gap_analysis')).toBe(false)
  })
})

describe('progressPercent', () => {
  it('is empty when there is no project at all', () => {
    expect(progressPercent()).toBe(0)
  })

  it('is empty at the first step, rather than already part filled', () => {
    expect(progressPercent('triage')).toBe(0)
  })

  it('fills the track when the application is finished', () => {
    expect(progressPercent('complete')).toBe(100)
  })

  it('increases with every step and never exceeds the track', () => {
    const values = PROJECT_STATES.map((state) => progressPercent(state))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
    expect(Math.min(...values)).toBe(0)
    expect(Math.max(...values)).toBe(100)
  })
})
