'use server'

import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { draftSection } from '@/lib/draft/generate'
import { SECTIONS_BY_NUMBER, countWords, wordLimitFor } from '@/lib/form/dalhousie-sections'
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
import {
  TOMBSTONE_CONSENT_VERSION,
  filledFields,
  reuseDisclosure,
} from '@/lib/profile/tombstone'
import { assertValidStepBack, assertValidTransition, previousState } from '@/lib/workflow/states'
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

/**
 * Guardrail 7. Records the researcher's decision about reusing their saved
 * details in this application, once per project.
 *
 * Both answers are recorded, and the exact wording they were shown is stored on
 * the record rather than a version number alone, so the decision can be
 * reconstructed later even after this text changes.
 */
export async function respondToReuse(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const granted = String(formData.get('intent') ?? '') === 'accept'

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  // Asked once per project. A second answer would fail the unique index on the
  // table anyway, and re-asking would be its own bug.
  if (await store.hasConsent(projectId, 'tombstone_reuse')) {
    redirect(`/project/${projectId}`)
  }

  const profile = await store.getProfile(session.userId)

  await store.recordConsent({
    userId: session.userId,
    projectId,
    kind: 'tombstone_reuse',
    granted,
    disclosureText: reuseDisclosure(profile),
    scope: granted
      ? Object.fromEntries(filledFields(profile).map((field) => [field.label, field.value]))
      : null,
    consentVersion: TOMBSTONE_CONSENT_VERSION,
  })

  redirect(`/project/${projectId}`)
}

/**
 * Goes back one step, at the researcher's request.
 *
 * Answers are kept. Going back re-opens a step rather than clearing it, because
 * the reason people go back is almost always to change one answer, and a
 * workflow that punishes that is one they work around by starting again.
 *
 * Returning to intake clears the method check readings, for the same reason a
 * rejection does: they describe answers that are about to change, and a stale
 * reading confirmed by accident is worse than no reading.
 */
export async function stepBack(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  const target = previousState(project.state)
  if (!target) redirect(`/project/${projectId}`)

  assertValidStepBack({
    projectId,
    from: project.state,
    to: target,
    actorId: session.userId,
    reason: 'Researcher stepped back',
  })

  if (target === 'intake') {
    await store.replaceInterpretations(projectId, [])
  }

  await store.recordTransition({
    projectId,
    from: project.state,
    to: target,
    actorId: session.userId,
    reason: 'Researcher stepped back',
  })
  await store.updateProject(projectId, session.userId, { state: target })

  redirect(`/project/${projectId}`)
}

/**
 * The remaining forward steps. Each is a separate button the researcher presses,
 * for the same reason as every other transition in this file.
 */
export async function advanceWorkflow(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const to = String(formData.get('to') ?? '')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  if (to !== 'gap_analysis' && to !== 'complete') {
    // Every other transition has its own action with its own preconditions.
    // Routing them through a generic one would be a way around those checks.
    redirect(`/project/${projectId}`)
  }

  const reason =
    to === 'gap_analysis'
      ? 'Researcher moved to gap analysis'
      : 'Researcher marked the draft ready to review'

  assertValidTransition({
    projectId,
    from: project.state,
    to,
    actorId: session.userId,
    reason,
  })

  await store.recordTransition({
    projectId,
    from: project.state,
    to,
    actorId: session.userId,
    reason,
  })
  await store.updateProject(projectId, session.userId, { state: to })

  redirect(`/project/${projectId}`)
}

/**
 * Guardrail 3 and guardrail 5, in one action.
 *
 * Nothing drafts itself. This runs because the researcher pressed the button for
 * one named section, and what comes back is saved with `aiGenerated` set and the
 * model that actually produced it recorded, before the text reaches the screen.
 * A draft that could be displayed without that record is a draft the disclosure
 * to the Board cannot account for.
 *
 * Guardrail 4 is not re-checked here. `draftSection` refuses a blocked section
 * in code before a prompt exists, and duplicating the rule in the caller is how
 * the two copies eventually disagree.
 */
export async function draftSectionWithAi(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const formSection = String(formData.get('formSection') ?? '')

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')

  // Drafting belongs to the drafting step. Reached from an earlier one it would
  // be writing up a study the researcher has not finished describing.
  if (project.state !== 'draft') redirect(`/project/${projectId}`)

  const answers = await store.getAnswers(projectId)
  const result = await draftSection({
    project,
    answers,
    formSection,
    userId: session.userId,
  })

  if (!result.ok) {
    // The reason travels as a code, not as prose. The refusal text belongs in
    // the interface, where it can be written once and read the same every time.
    redirect(
      `/project/${projectId}?draftFailed=${encodeURIComponent(formSection)}&reason=${result.reason}`,
    )
  }

  await store.saveDraft(projectId, {
    formSection,
    sectionTitle: SECTIONS_BY_NUMBER[formSection]?.title ?? null,
    content: result.content,
    aiGenerated: true,
    modelVersion: result.modelVersion,
    wordCount: result.wordCount,
    wordLimit: result.wordLimit ?? null,
    createdBy: session.userId,
  })

  redirect(`/project/${projectId}?drafted=${encodeURIComponent(formSection)}`)
}

/**
 * A researcher's edit to a drafted section.
 *
 * Saved as a new version rather than over the old one, and the AI provenance is
 * carried forward: a section a model drafted stays recorded as model-drafted
 * after a person rewrites a sentence in it. Editing is not a way to launder the
 * disclosure, and `editedByHuman` is what separates the two cases for the Board.
 */
export async function saveSectionEdit(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const projectId = String(formData.get('projectId') ?? '')
  const formSection = String(formData.get('formSection') ?? '')
  const content = String(formData.get('content') ?? '').trim()

  const store = getStore()
  const project = await store.getProject(projectId, session.userId)
  if (!project) redirect('/dashboard')
  if (project.state !== 'draft') redirect(`/project/${projectId}`)

  if (content.length === 0) {
    // Saving nothing would supersede a real draft with a blank one. Silently.
    redirect(`/project/${projectId}?draftFailed=${encodeURIComponent(formSection)}&reason=empty_edit`)
  }

  const drafts = await store.listDrafts(projectId)
  const prior = drafts.find((draft) => draft.formSection === formSection)

  await store.saveDraft(projectId, {
    formSection,
    sectionTitle: SECTIONS_BY_NUMBER[formSection]?.title ?? null,
    content,
    aiGenerated: prior?.aiGenerated ?? false,
    modelVersion: prior?.modelVersion ?? null,
    editedByHuman: true,
    wordCount: countWords(content),
    wordLimit: wordLimitFor(formSection) ?? null,
    createdBy: session.userId,
  })

  redirect(`/project/${projectId}?drafted=${encodeURIComponent(formSection)}`)
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
