import { describe, expect, it } from 'vitest'

import type { AnswerMap, Draft, MethodInterpretation, Project } from '@/lib/data/types'

import {
  CHECKPOINTS,
  buildCheckpoint,
  buildSectionCheckpoint,
  checkpointFor,
  isCheckpointFor,
  type CheckpointId,
} from './checkpoints'
import { PROJECT_STATES, STATE_DEFINITIONS, canTransition, type ProjectState } from './states'

const NOW = new Date('2026-08-21T12:00:00.000Z').toISOString()

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: null,
    institution: 'Dalhousie University',
    state: 'triage',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const TRIAGE_ANSWERS: AnswerMap = {
  'triage.title': 'Community Retrofit Readiness',
  'triage.plain_summary':
    'We want to find out what stops rural homeowners going ahead with a retrofit once the funding is in place.',
  'triage.board': 'social',
  'triage.data_source': 'direct',
  'triage.indigenous_research': 'no',
  'triage.community_engaged': 'no',
}

function interpretation(overrides: Partial<MethodInterpretation> = {}): MethodInterpretation {
  return {
    id: 'i1',
    projectId: 'p1',
    formSection: '2.6',
    interpretation: 'You are running semi-structured interviews with homeowners.',
    response: 'confirmed',
    researcherCorrection: null,
    respondedBy: 'u1',
    respondedAt: NOW,
    modelVersion: null,
    createdAt: NOW,
    ...overrides,
  }
}

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'd1',
    projectId: 'p1',
    formSection: '2.2',
    sectionTitle: 'Research question',
    content: 'A drafted section.',
    version: 1,
    isCurrent: true,
    aiGenerated: true,
    modelVersion: 'claude-test',
    editedByHuman: false,
    wordCount: 3,
    wordLimit: null,
    createdAt: NOW,
    ...overrides,
  }
}

/**
 * The structural guarantee. Every forward move in the state machine has a
 * checkpoint in front of it, so a stage cannot be added later that quietly
 * advances without one.
 */
describe('a checkpoint on every boundary', () => {
  it('covers every forward transition the state machine allows', () => {
    for (const state of PROJECT_STATES) {
      for (const next of STATE_DEFINITIONS[state].allowedNext) {
        // The backward move out of a rejected method check is not a boundary a
        // researcher is walked across. It is the tool being told it was wrong.
        const backwards = PROJECT_STATES.indexOf(next) < PROJECT_STATES.indexOf(state)
        if (backwards) continue

        const definition = checkpointFor(state)
        expect(definition, `no checkpoint before ${state} -> ${next}`).not.toBeNull()
        expect(definition!.to).toBe(next)
      }
    }
  })

  it('has no checkpoint after the last state', () => {
    expect(checkpointFor('complete')).toBeNull()
  })

  it('describes only transitions the state machine permits', () => {
    for (const definition of Object.values(CHECKPOINTS)) {
      expect(canTransition(definition.from, definition.to)).toBe(true)
    }
  })

  it('names a stage the researcher is leaving, and one they are entering', () => {
    for (const definition of Object.values(CHECKPOINTS)) {
      expect(definition.confirmLabel.length).toBeGreaterThan(0)
      expect(definition.next.length).toBeGreaterThan(0)
    }
  })
})

describe('a checkpoint id is a request, not a fact', () => {
  it('accepts the id that matches the state the project is in', () => {
    expect(isCheckpointFor('triage', 'triage')).toBe(true)
  })

  it('refuses an id from a different boundary', () => {
    expect(isCheckpointFor('triage', 'gap_analysis')).toBe(false)
  })

  it('refuses a state that has no checkpoint', () => {
    expect(isCheckpointFor('complete', 'gap_analysis')).toBe(false)
  })

  it('refuses nonsense', () => {
    expect(isCheckpointFor('draft', undefined)).toBe(false)
    expect(isCheckpointFor('draft', 'not-a-checkpoint')).toBe(false)
  })
})

describe('the triage checkpoint', () => {
  it('reads back the answers that decide what gets drafted', () => {
    const summary = buildCheckpoint({ project: project(), answers: TRIAGE_ANSWERS })!
    const labels = summary.captured.map((item) => item.label)

    expect(labels).toContain('Working title')
    expect(labels).toContain('Where the information comes from')
    expect(summary.blockers).toEqual([])
  })

  it('shows the choice in the words the researcher was shown, not the stored value', () => {
    const summary = buildCheckpoint({ project: project(), answers: TRIAGE_ANSWERS })!
    const board = summary.captured.find((item) => item.label === 'Board suggested')

    expect(board?.detail).toBe('Social Sciences and Humanities')
  })

  it('explains that not sure was counted as yes', () => {
    const summary = buildCheckpoint({
      project: project({
        involvesIndigenousResearch: true,
        routingNote: 'Flagged as research involving Indigenous Peoples.',
      }),
      answers: { ...TRIAGE_ANSWERS, 'triage.indigenous_research': 'unsure' },
    })!

    expect(summary.notes.join(' ')).toContain('Not sure is treated as yes')
    expect(summary.notes.join(' ')).toContain('Flagged as research involving Indigenous Peoples.')
  })

  it('will not move on while a required opening question is unanswered', () => {
    const summary = buildCheckpoint({ project: project(), answers: {} })!
    expect(summary.blockers.length).toBeGreaterThan(0)
  })
})

describe('the intake checkpoint', () => {
  it('counts the answers section by section', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'intake' }),
      answers: TRIAGE_ANSWERS,
    })!

    expect(summary.captured.length).toBeGreaterThan(0)
    expect(summary.captured[0].detail).toMatch(/^\d+ of \d+ answered$/)
  })

  it('blocks on a required question with no answer, and says which section', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'intake' }),
      answers: TRIAGE_ANSWERS,
    })!

    expect(summary.blockers.length).toBeGreaterThan(0)
    expect(summary.blockers[0]).toContain('Section 2.2')
  })

  it('says what a yes to future use turned on', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'intake' }),
      answers: { ...TRIAGE_ANSWERS, 'intake.2_5.future_use': 'yes' },
    })!

    expect(summary.notes.join(' ')).toContain('section 2.8')
  })
})

describe('the method check checkpoint', () => {
  it('reads back each reading and what the researcher said to it', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'method_check' }),
      answers: TRIAGE_ANSWERS,
      interpretations: [interpretation()],
    })!

    expect(summary.captured[0].label).toBe('Confirmed')
    expect(summary.blockers).toEqual([])
  })

  it('will not move on while a reading is unanswered', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'method_check' }),
      answers: TRIAGE_ANSWERS,
      interpretations: [interpretation({ response: 'pending', respondedBy: null })],
    })!

    expect(summary.blockers.length).toBe(1)
  })

  it('will not move forward on a rejected reading', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'method_check' }),
      answers: TRIAGE_ANSWERS,
      interpretations: [
        interpretation({ response: 'rejected', researcherCorrection: 'It is a survey.' }),
      ],
    })!

    expect(summary.blockers.join(' ')).toContain('back to intake')
  })

  it('says that a correction does not change the answers drafting works from', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'method_check' }),
      answers: TRIAGE_ANSWERS,
      interpretations: [
        interpretation({ response: 'altered', researcherCorrection: 'Two interviews, not one.' }),
      ],
    })!

    expect(summary.notes.join(' ')).toContain('drafting works from your intake answers')
    expect(summary.captured[0].note).toContain('Two interviews, not one.')
  })
})

describe('the drafting checkpoint', () => {
  it('separates what a model wrote from what the researcher wrote', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'draft' }),
      answers: TRIAGE_ANSWERS,
      drafts: [draft(), draft({ id: 'd2', formSection: '2.3', aiGenerated: false, editedByHuman: true })],
    })!

    const ai = summary.captured.find((item) => item.label === 'Drafted with AI assistance')
    const human = summary.captured.find((item) => item.label === 'Written or edited by you')

    expect(ai?.detail).toContain('2.2')
    expect(human?.detail).toContain('2.3')
  })

  it('raises a section over the word limit without calling it a problem', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'draft' }),
      answers: TRIAGE_ANSWERS,
      drafts: [draft({ formSection: '2.1', wordCount: 900, wordLimit: 500 })],
    })!

    expect(summary.notes.join(' ')).toContain('over the word limit')
  })

  it('never blocks, because drafting is the researcher’s to judge', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'draft' }),
      answers: TRIAGE_ANSWERS,
      drafts: [],
    })!

    expect(summary.blockers).toEqual([])
  })
})

describe('the last checkpoint', () => {
  it('counts the findings and blocks on none of them', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'gap_analysis' }),
      answers: TRIAGE_ANSWERS,
    })!

    expect(summary.captured.map((item) => item.label)).toContain('Sections not complete')
    expect(summary.blockers).toEqual([])
  })

  it('says plainly that finishing is not submitting', () => {
    const summary = buildCheckpoint({
      project: project({ state: 'gap_analysis' }),
      answers: TRIAGE_ANSWERS,
    })!

    expect(summary.notes.join(' ')).toContain('does not submit it')
  })
})

/**
 * The smaller checkpoint, between two sections of intake.
 */
describe('a section checkpoint', () => {
  const INTAKE: AnswerMap = {
    ...TRIAGE_ANSWERS,
    'intake.2_4.third_party': 'yes',
    'intake.2_4.how': 'Posters in community centres and an invitation from two energy co-operatives.',
    'intake.2_4.screening': 'People decide for themselves whether they are eligible.',
  }

  it('reads every question in the section back, answered or not', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: INTAKE,
      formSection: '2.4',
    })!

    expect(summary.title).toBe('Recruitment')
    expect(summary.captured).toHaveLength(4)
    expect(summary.captured.some((item) => item.detail === 'Left blank')).toBe(true)
  })

  it('shows a choice in the words the researcher chose from', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: INTAKE,
      formSection: '2.4',
    })!

    expect(summary.captured[0].detail).toBe('Yes')
  })

  it('says what the answer commits them to, at the point they gave it', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: INTAKE,
      formSection: '2.4',
    })!

    expect(summary.notes.join(' ')).toContain('written agreement appended')
  })

  it('surfaces a contradiction here rather than three stages later', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: {
        ...INTAKE,
        'intake.2_6.recording': 'yes',
        'intake.2_7.identifiability': 'anonymous',
        'intake.2_7.storage': 'On an encrypted university drive.',
        'intake.2_7.retention': 'Five years, then deleted.',
        'intake.2_7.outside_canada': 'no',
        'intake.2_7.health_information': 'no',
      },
      formSection: '2.7',
    })!

    expect(summary.notes.join(' ')).toContain('A voice or video recording is identifiable')
  })

  it('names the section it goes to next', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: INTAKE,
      formSection: '2.4',
    })!

    expect(summary.next?.formSection).toBe('2.5')
  })

  it('has no next section at the end of intake', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: INTAKE,
      formSection: '2.12',
    })!

    expect(summary.next).toBeNull()
  })

  it('blocks while a required question in the section is unanswered', () => {
    const summary = buildSectionCheckpoint({
      project: project({ state: 'intake' }),
      answers: TRIAGE_ANSWERS,
      formSection: '2.2',
    })!

    expect(summary.blockers).toHaveLength(1)
  })

  it('builds nothing for a section this application does not have', () => {
    expect(
      buildSectionCheckpoint({
        project: project({ state: 'intake' }),
        answers: INTAKE,
        // Only shown when the research involves an intervention.
        formSection: '2.14',
      }),
    ).toBeNull()
  })
})

describe('no checkpoint at the end', () => {

  it('builds nothing for a completed project', () => {
    expect(buildCheckpoint({ project: project({ state: 'complete' }), answers: {} })).toBeNull()
  })
})

/** Typed exhaustively so a new state cannot be added without deciding this. */
const EVERY_ID: CheckpointId[] = ['triage', 'intake', 'method_check', 'draft', 'gap_analysis']

describe('the set of checkpoints', () => {
  it('has one for every state except the last', () => {
    const states: ProjectState[] = PROJECT_STATES.filter((state) => state !== 'complete')
    expect(EVERY_ID).toEqual(states)
  })
})
