import { describe, expect, it, vi } from 'vitest'

import type { AnswerMap, Project } from '@/lib/data/types'

/**
 * The method check is the step guardrail 3 rests on, so what is tested here is
 * not the quality of the reading, it is that the researcher is never left
 * without one and that `modelVersion` always tells the truth about where it came
 * from. A reading recorded as model-reasoned when a rule produced it would make
 * the audit trail worse than having none.
 */

const callModel = vi.hoisted(() => vi.fn())
const configured = vi.hoisted(() => ({ value: true }))

vi.mock('@/lib/anthropic/client', () => ({ callModel }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/env', () => ({
  get isAnthropicConfigured() {
    return configured.value
  },
}))

const { interpretMethodology } = await import('./interpret-ai')

const NOW = '2026-08-05T12:00:00.000Z'

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: 'What stops rural homeowners from going ahead with retrofits.',
    institution: 'Dalhousie University',
    state: 'method_check',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const ANSWERS: AnswerMap = {
  'intake.2_3.who': 'Homeowners in rural Nova Scotia who own their own home.',
  'intake.2_4.how': 'Posters in community centres and a notice in each municipal newsletter.',
  'intake.2_4.third_party': 'no',
}

function mockReadings(readings: { formSection: string; reading: string }[]) {
  callModel.mockResolvedValueOnce({
    ok: true,
    text: JSON.stringify({ readings }),
    modelVersion: 'claude-opus-5',
    redaction: { outcome: 'clean', hits: [] },
  })
}

describe('interpretMethodology', () => {
  it('returns model readings and records the model that produced them', async () => {
    configured.value = true
    mockReadings([
      { formSection: '2.3', reading: 'You are approaching people who own the home they live in.' },
      { formSection: '2.4', reading: 'You are recruiting passively, through public notices.' },
    ])

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(result).toHaveLength(2)
    expect(result[0].modelVersion).toBe('claude-opus-5')
    expect(result[0].interpretation).toContain('own the home')
  })

  it('records the model that answered, not the one requested', async () => {
    configured.value = true
    callModel.mockResolvedValueOnce({
      ok: true,
      text: JSON.stringify({ readings: [{ formSection: '2.3', reading: 'You are...' }] }),
      // After a server-side fallback this is not the model that was asked for.
      modelVersion: 'claude-sonnet-5',
      redaction: { outcome: 'clean', hits: [] },
    })

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(result[0].modelVersion).toBe('claude-sonnet-5')
  })

  it('does not call the model when it is not configured', async () => {
    configured.value = false
    callModel.mockClear()

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(callModel).not.toHaveBeenCalled()
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((item) => item.modelVersion === null)).toBe(true)
  })

  // A refusal at this step must not strand the researcher. The redaction gate's
  // message reaches them at drafting, where they can act on it.
  it('falls back to the rule-derived reading when the call is refused', async () => {
    configured.value = true
    callModel.mockResolvedValueOnce({
      ok: false,
      reason: 'refused_by_redaction_gate',
      message: 'Refused.',
    })

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((item) => item.modelVersion === null)).toBe(true)
  })

  it('falls back when the response cannot be parsed', async () => {
    configured.value = true
    callModel.mockResolvedValueOnce({
      ok: true,
      text: 'not json',
      modelVersion: 'claude-opus-5',
      redaction: { outcome: 'clean', hits: [] },
    })

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(result.every((item) => item.modelVersion === null)).toBe(true)
  })

  it('falls back when the model returns an empty reading', async () => {
    configured.value = true
    mockReadings([{ formSection: '2.3', reading: '   ' }])

    const result = await interpretMethodology({ project: project(), answers: ANSWERS })

    expect(result.every((item) => item.modelVersion === null)).toBe(true)
  })

  it('does not call the model when there is nothing to read', async () => {
    configured.value = true
    callModel.mockClear()

    const result = await interpretMethodology({ project: project(), answers: {} })

    expect(callModel).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  // Guardrail 6. The prompt is what enforces it at this step, since a reading is
  // free text, so the instruction has to be present and unambiguous.
  it('forbids ethics determinations in the system prompt', async () => {
    configured.value = true
    mockReadings([{ formSection: '2.3', reading: 'You are approaching homeowners.' }])

    await interpretMethodology({ project: project(), answers: ANSWERS })

    const system = String(callModel.mock.calls.at(-1)![0].system).replace(/\s+/g, ' ')
    expect(system).toMatch(/never state or imply that the research is approved/i)
    expect(system).toMatch(/not the Research Ethics Board/i)
    expect(system).toMatch(/never suggest a change/i)
  })

  it('sends only the answers, and asks for every section that has them', async () => {
    configured.value = true
    mockReadings([{ formSection: '2.3', reading: 'You are approaching homeowners.' }])

    await interpretMethodology({ project: project(), answers: ANSWERS })

    const message = String(callModel.mock.calls.at(-1)![0].messages[0].content)
    expect(message).toContain('rural Nova Scotia')
    expect(message).toContain('2.3')
    expect(message).toContain('2.4')
    // Sections with no answers are not asked about at all.
    expect(message).not.toContain('Section 2.7')
  })
})
