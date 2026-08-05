'use server'

import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import {
  TRIAGE_QUESTIONS,
  TRIAGE_SUMMARY_KEY,
  TRIAGE_TITLE_KEY,
  missingRequired,
  sectionMap,
  triageFlags,
  visibleSections,
} from '@/lib/intake/questions'
import { allResolved, deriveInterpretations, hasRejection } from '@/lib/method/interpret'
import { assertValidTransition } from '@/lib/workflow/states'
import type { AnswerMap } from '@/lib/data/types'

/**
 * Saving and advancing.
 *
 * Guardrail 3 shapes both actions: saving never advances, and advancing is a
 * separate button the researcher presses. There is no path here where answering
 * the last question moves the project on by itself.
 *
 * Every advance goes through `assertValidTransition`, which requires an actor,
 * and is written to the transition log before the state changes.
 */

function collectAnswers(formData: FormData, keys: string[]): AnswerMap {
  const answers: AnswerMap = {}
  for (const key of keys) {
    const value = formData.get(key)
    // A key absent from the post is a control that was not rendered, which is
    // different from one the researcher cleared. Only the latter is saved.
    if (value === null) continue
    answers[key] = String(value).trim()
  }
  return answers
}

export async function saveTriage(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const intent = String(formData.get('intent') ?? 'save')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  const keys = TRIAGE_QUESTIONS.map((question) => question.key)
  const answers = collectAnswers(formData, keys)

  await store.saveAnswers({
    projectId,
    answeredBy: session.userId,
    answers,
    sections: sectionMap(TRIAGE_QUESTIONS),
  })

  const flags = triageFlags(answers)

  await store.updateProject(projectId, session.userId, {
    title: answers[TRIAGE_TITLE_KEY] || project.title,
    plainLanguageSummary: answers[TRIAGE_SUMMARY_KEY] ?? project.plainLanguageSummary,
    involvesIndigenousResearch: flags.indigenous,
    involvesCommunityEngagedResearch: flags.communityEngaged,
    routingNote: buildRoutingNote(flags),
  })

  if (intent !== 'advance') {
    redirect(`/project/${projectId}?saved=1`)
  }

  const missing = missingRequired(TRIAGE_QUESTIONS, answers)
  if (missing.length > 0) {
    redirect(`/project/${projectId}?missing=${encodeURIComponent(missing.join(','))}`)
  }

  assertValidTransition({
    projectId,
    from: project.state,
    to: 'intake',
    actorId: session.userId,
    reason: 'Triage completed by researcher',
  })

  await store.recordTransition({
    projectId,
    from: project.state,
    to: 'intake',
    actorId: session.userId,
    reason: 'Triage completed by researcher',
  })
  await store.updateProject(projectId, session.userId, { state: 'intake' })

  redirect(`/project/${projectId}`)
}

export async function saveIntakeSection(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const intent = String(formData.get('intent') ?? 'save')
  const formSection = String(formData.get('formSection') ?? '')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  const existing = await store.getAnswers(projectId)
  const sections = visibleSections(existing)
  const index = sections.findIndex((section) => section.formSection === formSection)
  const section = sections[index]
  if (!section) redirect(`/project/${projectId}`)

  const answers = collectAnswers(
    formData,
    section.questions.map((question) => question.key),
  )

  await store.saveAnswers({
    projectId,
    answeredBy: session.userId,
    answers,
    sections: sectionMap(section.questions),
  })

  const here = `/project/${projectId}?section=${encodeURIComponent(section.formSection)}`

  if (intent !== 'advance') {
    redirect(`${here}&saved=1`)
  }

  const missing = missingRequired(section.questions, { ...existing, ...answers })
  if (missing.length > 0) {
    redirect(`${here}&missing=${encodeURIComponent(missing.join(','))}`)
  }

  // Answering this section may have revealed or hidden a later one, for example
  // the clinical trials section, so the list is recomputed rather than reused.
  const updated = visibleSections({ ...existing, ...answers })
  const position = updated.findIndex((entry) => entry.formSection === section.formSection)
  const next = updated[position + 1]

  if (next) {
    redirect(`/project/${projectId}?section=${encodeURIComponent(next.formSection)}`)
  }

  assertValidTransition({
    projectId,
    from: project.state,
    to: 'method_check',
    actorId: session.userId,
    reason: 'Intake completed by researcher',
  })

  // Built from the answers as they now stand, replacing any set from a previous
  // round that the researcher sent back.
  await store.replaceInterpretations(
    projectId,
    deriveInterpretations({ ...existing, ...answers }),
  )

  await store.recordTransition({
    projectId,
    from: project.state,
    to: 'method_check',
    actorId: session.userId,
    reason: 'Intake completed by researcher',
  })
  await store.updateProject(projectId, session.userId, { state: 'method_check' })

  redirect(`/project/${projectId}`)
}

/**
 * One response to one reading. Guardrail 3 in its most literal form: the app
 * states its understanding, and cannot move until a person answers.
 *
 * A rejection acts immediately and sends the project back to intake, rather than
 * being collected up with the others. Rejecting means the tool has the research
 * wrong, and there is nothing useful to do with the remaining readings until
 * that is fixed.
 */
export async function respondToInterpretation(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const interpretationId = String(formData.get('interpretationId') ?? '')
  const intent = String(formData.get('intent') ?? '')
  const correction = String(formData.get('correction') ?? '').trim()

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  const response =
    intent === 'confirm' ? 'confirmed' : intent === 'alter' ? 'altered' : 'rejected'

  if (response !== 'confirmed' && correction.length === 0) {
    redirect(
      `/project/${projectId}?correctionNeeded=${encodeURIComponent(interpretationId)}`,
    )
  }

  await store.respondToInterpretation({
    id: interpretationId,
    projectId,
    response,
    correction: response === 'confirmed' ? null : correction,
    respondedBy: session.userId,
  })

  if (response !== 'rejected') {
    redirect(`/project/${projectId}`)
  }

  assertValidTransition({
    projectId,
    from: project.state,
    to: 'intake',
    actorId: session.userId,
    reason: 'Researcher rejected the tool’s reading of the methodology',
  })

  await store.recordTransition({
    projectId,
    from: project.state,
    to: 'intake',
    actorId: session.userId,
    reason: 'Researcher rejected the tool’s reading of the methodology',
  })
  await store.updateProject(projectId, session.userId, { state: 'intake' })

  redirect(`/project/${projectId}?rejected=1`)
}

/** Leaves the method check for drafting. Only once every reading is resolved. */
export async function advanceToDraft(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  const interpretations = await store.listInterpretations(projectId)

  if (hasRejection(interpretations) || !allResolved(interpretations)) {
    redirect(`/project/${projectId}?unresolved=1`)
  }

  assertValidTransition({
    projectId,
    from: project.state,
    to: 'draft',
    actorId: session.userId,
    reason: 'Researcher confirmed the reading of the methodology',
  })

  await store.recordTransition({
    projectId,
    from: project.state,
    to: 'draft',
    actorId: session.userId,
    reason: 'Researcher confirmed the reading of the methodology',
  })
  await store.updateProject(projectId, session.userId, { state: 'draft' })

  redirect(`/project/${projectId}`)
}

function buildRoutingNote(flags: { indigenous: boolean; communityEngaged: boolean }): string | null {
  if (!flags.indigenous && !flags.communityEngaged) return null

  const reasons: string[] = []
  if (flags.indigenous) reasons.push('research involving Indigenous Peoples')
  if (flags.communityEngaged) reasons.push('community-engaged research')

  return (
    `Flagged as ${reasons.join(' and ')}. Those sections are not drafted by this tool. ` +
    'Please speak with the Research Ethics Office, and with the community, before submitting.'
  )
}
