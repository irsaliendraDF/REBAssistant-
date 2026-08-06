import { describe, expect, it, vi } from 'vitest'

import type { AnswerMap, Project } from '@/lib/data/types'

/**
 * These tests assert the guards that run *before* a request can be built.
 *
 * The model is mocked, and deliberately so: the point is not what the model
 * writes, it is that a blocked section never reaches it. Guardrail 4 is only a
 * guarantee if there is no path from a flagged project to a constructed request,
 * and that is a property of this module, testable without an API key.
 */

const callModel = vi.hoisted(() => vi.fn())

vi.mock('@/lib/anthropic/client', () => ({ callModel }))
vi.mock('server-only', () => ({}))

const { draftSection, sourcesFor } = await import('./generate')

const NOW = '2026-08-05T12:00:00.000Z'

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: null,
    institution: 'Dalhousie University',
    state: 'draft',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const ANSWERS: AnswerMap = {
  'intake.2_4.third_party': 'no',
  'intake.2_4.how': 'Posters in community centres and a notice in each municipal newsletter.',
  'intake.2_9.risks': 'Discomfort discussing household finances with a stranger.',
  'intake.2_9.mitigation': 'Any question can be skipped, and this is said in advance.',
  'intake.2_9.others': 'Participating municipalities could be identifiable in reporting.',
}

function mockSuccess(text: string) {
  callModel.mockResolvedValueOnce({
    ok: true,
    text,
    modelVersion: 'claude-opus-5',
    redaction: { outcome: 'clean', hits: [] },
  })
}

describe('guardrail 4: blocked sections never reach the model', () => {
  it('refuses the always-routed section, and builds no request', async () => {
    callModel.mockClear()
    const result = await draftSection({
      project: project(),
      answers: ANSWERS,
      formSection: '2.13',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('blocked_by_guardrail')
    expect(callModel).not.toHaveBeenCalled()
  })

  it.each([
    ['Indigenous research', { involvesIndigenousResearch: true }],
    ['community-engaged research', { involvesCommunityEngagedResearch: true }],
  ])('refuses recruitment when triage flagged %s', async (_label, flags) => {
    callModel.mockClear()
    const result = await draftSection({
      project: project(flags),
      answers: ANSWERS,
      formSection: '2.4',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('blocked_by_guardrail')
    expect(callModel).not.toHaveBeenCalled()
  })

  it('drafts the same section when nothing was flagged', async () => {
    callModel.mockClear()
    mockSuccess('Participants will be recruited through posters in community centres.')

    const result = await draftSection({
      project: project(),
      answers: ANSWERS,
      formSection: '2.4',
    })

    expect(result.ok).toBe(true)
    expect(callModel).toHaveBeenCalledOnce()
  })

  it('refuses a from-record section rather than inventing team details', async () => {
    callModel.mockClear()
    const result = await draftSection({ project: project(), answers: ANSWERS, formSection: '1' })

    expect(result.ok).toBe(false)
    expect(callModel).not.toHaveBeenCalled()
  })
})

describe('source material', () => {
  it('does not call the model when the section has no answers', async () => {
    callModel.mockClear()
    const result = await draftSection({ project: project(), answers: {}, formSection: '2.4' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no_source_material')
    expect(callModel).not.toHaveBeenCalled()
  })

  it('sends only the answers belonging to the requested section', async () => {
    callModel.mockClear()
    mockSuccess('draft text')

    await draftSection({ project: project(), answers: ANSWERS, formSection: '2.9' })

    const sent = callModel.mock.calls[0][0].messages[0].content as string
    expect(sent).toContain('Discomfort discussing household finances')
    expect(sent).not.toContain('Posters in community centres')
  })

  it('turns stored choice values back into the wording the researcher saw', () => {
    const sources = sourcesFor('2.4', ANSWERS)
    expect(sources.map((source) => source.answer)).toContain('No')
  })
})

describe('word limits are reported, never enforced by truncation', () => {
  it('flags a lay summary over the 500-word cap without cutting it', async () => {
    callModel.mockClear()
    const long = Array.from({ length: 600 }, (_, index) => `word${index}`).join(' ')
    mockSuccess(long)

    const result = await draftSection({
      project: project(),
      answers: { 'triage.plain_summary': 'What stops rural homeowners from retrofitting.' },
      formSection: '2.1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.wordLimit).toBe(500)
      expect(result.overWordLimit).toBe(true)
      // Truncating would silently remove content the researcher is responsible
      // for signing off on.
      expect(result.content.split(/\s+/)).toHaveLength(600)
    }
  })

  it('tells the model about the cap', async () => {
    callModel.mockClear()
    mockSuccess('short summary')

    await draftSection({
      project: project(),
      answers: { 'triage.plain_summary': 'A study of retrofit uptake.' },
      formSection: '2.1',
    })

    expect(callModel.mock.calls[0][0].messages[0].content).toContain('500 words')
  })
})

describe('the request itself', () => {
  it('carries the project and purpose so a refusal is traceable', async () => {
    callModel.mockClear()
    mockSuccess('draft')

    await draftSection({
      project: project(),
      answers: ANSWERS,
      formSection: '2.4',
      userId: 'u1',
    })

    const call = callModel.mock.calls[0][0]
    expect(call.purpose).toBe('draft:2.4')
    expect(call.projectId).toBe('p1')
    expect(call.userId).toBe('u1')
  })

  it('forbids ethics determinations in the system prompt', async () => {
    callModel.mockClear()
    mockSuccess('draft')

    await draftSection({ project: project(), answers: ANSWERS, formSection: '2.4' })

    // Guardrail 6. The code cannot enforce this the way it enforces guardrail 4,
    // so the instruction has to be present and explicit.
    // Whitespace-tolerant: the prompt is hard-wrapped for readability, so
    // phrases straddle line breaks.
    const system = (callModel.mock.calls[0][0].system as string).replace(/\s+/g, ' ')
    expect(system).toMatch(/never state or imply/i)
    expect(system).toMatch(/cannot make an ethics determination/i)
    expect(system).toMatch(/never write a participant's name/i)
  })

  it('passes a redaction-gate refusal through as itself', async () => {
    callModel.mockClear()
    callModel.mockResolvedValueOnce({
      ok: false,
      reason: 'refused_by_redaction_gate',
      message: 'This request was not sent.',
      redaction: { outcome: 'refused', hits: [] },
    })

    const result = await draftSection({
      project: project(),
      answers: ANSWERS,
      formSection: '2.4',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('refused_by_redaction_gate')
  })

  it('reports a model decline as its own outcome, not as a failed draft', async () => {
    callModel.mockClear()
    callModel.mockResolvedValueOnce({
      ok: false,
      reason: 'declined_by_model',
      message: 'The AI model declined to draft this section.',
      category: 'bio',
    })

    const result = await draftSection({
      project: project(),
      answers: ANSWERS,
      formSection: '2.9',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('declined_by_model')
  })
})
