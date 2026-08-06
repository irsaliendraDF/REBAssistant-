import 'server-only'

import { requireClient } from '@/lib/supabase/server'

import type {
  AnswerMap,
  ConsentRecord,
  CreateProjectInput,
  DataStore,
  Draft,
  NewDraft,
  Profile,
  ProfileInput,
  InterpretationResponse,
  MethodInterpretation,
  NewInterpretation,
  Project,
  ProjectPatch,
  RespondInput,
  SaveAnswersInput,
  TransitionInput,
} from './types'

/**
 * Supabase-backed store.
 *
 * Written now, against the migrations, so connecting the hosted project is a
 * credentials change rather than a build. It is unreachable until
 * NEXT_PUBLIC_SUPABASE_URL and the anon key are set, at which point
 * `lib/data/index.ts` returns this instead of the in-memory store.
 *
 * Uses the request-scoped client, not the service role, so every query runs
 * under row level security and a researcher can only ever reach their own rows.
 * The ownerId arguments are therefore belt and braces rather than the only
 * defence.
 */

interface ProjectRow {
  id: string
  owner_id: string
  title: string
  plain_language_summary: string | null
  institution: string
  state: Project['state']
  involves_indigenous_research: boolean
  involves_community_engaged_research: boolean
  routing_note: string | null
  created_at: string
  updated_at: string
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  department: string | null
  institution: string
  core_certificate_status: string | null
  core_certificate_date: string | null
  phone: string | null
  banner_number: string | null
  romeo_registered: boolean | null
  affiliation: string | null
  updated_at: string
}

interface DraftRow {
  id: string
  project_id: string
  form_section: string
  section_title: string | null
  content: string | null
  version: number
  is_current: boolean
  ai_generated: boolean
  model_version: string | null
  edited_by_human: boolean
  word_count: number | null
  word_limit: number | null
  created_at: string
}

function toDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    projectId: row.project_id,
    formSection: row.form_section,
    sectionTitle: row.section_title,
    content: row.content ?? '',
    version: row.version,
    isCurrent: row.is_current,
    aiGenerated: row.ai_generated,
    modelVersion: row.model_version,
    editedByHuman: row.edited_by_human,
    wordCount: row.word_count,
    wordLimit: row.word_limit,
    createdAt: row.created_at,
  }
}

interface InterpretationRow {
  id: string
  project_id: string
  form_section: string | null
  interpretation: string
  response: InterpretationResponse
  researcher_correction: string | null
  responded_by: string | null
  responded_at: string | null
  model_version: string | null
  created_at: string
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    plainLanguageSummary: row.plain_language_summary,
    institution: row.institution,
    state: row.state,
    involvesIndigenousResearch: row.involves_indigenous_research,
    involvesCommunityEngagedResearch: row.involves_community_engaged_research,
    routingNote: row.routing_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const supabaseStore: DataStore = {
  isEphemeral: false,
  name: 'supabase',

  async getProfile(userId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(`Could not load your details: ${error.message}`)
    if (!data) return null

    const row = data as ProfileRow
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      department: row.department,
      institution: row.institution,
      coreCertificateStatus: row.core_certificate_status,
      coreCertificateDate: row.core_certificate_date,
      phone: row.phone,
      bannerNumber: row.banner_number,
      romeoRegistered: row.romeo_registered ?? false,
      affiliation: row.affiliation,
      updatedAt: row.updated_at,
    }
  },

  async upsertProfile(userId, input: ProfileInput) {
    const supabase = await requireClient()
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.institution !== undefined ? { institution: input.institution } : {}),
        ...(input.coreCertificateStatus !== undefined
          ? { core_certificate_status: input.coreCertificateStatus }
          : {}),
        ...(input.coreCertificateDate !== undefined
          ? { core_certificate_date: input.coreCertificateDate }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.bannerNumber !== undefined ? { banner_number: input.bannerNumber } : {}),
        ...(input.romeoRegistered !== undefined
          ? { romeo_registered: input.romeoRegistered }
          : {}),
        ...(input.affiliation !== undefined ? { affiliation: input.affiliation } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (error) throw new Error(`Could not save your details: ${error.message}`)

    const profile = await supabaseStore.getProfile(userId)
    if (!profile) throw new Error('Could not save your details.')
    return profile
  },

  async hasConsent(projectId, kind) {
    const supabase = await requireClient()
    const { count, error } = await supabase
      .from('consent_events')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('kind', kind)

    if (error) throw new Error(`Could not check the consent record: ${error.message}`)
    return (count ?? 0) > 0
  },

  async hasUserConsent(userId, kind) {
    const supabase = await requireClient()
    const { count, error } = await supabase
      .from('consent_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind)

    if (error) throw new Error(`Could not check the consent record: ${error.message}`)
    return (count ?? 0) > 0
  },

  async recordConsent(record: ConsentRecord) {
    const supabase = await requireClient()
    const { error } = await supabase.from('consent_events').insert({
      user_id: record.userId,
      project_id: record.projectId,
      kind: record.kind,
      granted: record.granted,
      disclosure_text: record.disclosureText,
      scope: record.scope,
      consent_version: record.consentVersion,
    })

    // A unique index allows one tombstone reuse record per project. Hitting it
    // means the researcher was asked twice, which is a bug worth surfacing
    // rather than swallowing.
    if (error) throw new Error(`Could not record your decision: ${error.message}`)
  },

  async listProjects(ownerId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })

    if (error) throw new Error(`Could not load applications: ${error.message}`)
    return (data as ProjectRow[]).map(toProject)
  },

  async getProject(id, ownerId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .maybeSingle()

    if (error) throw new Error(`Could not load this application: ${error.message}`)
    return data ? toProject(data as ProjectRow) : null
  },

  async createProject({ ownerId, title }: CreateProjectInput) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('projects')
      .insert({ owner_id: ownerId, title, state: 'triage' })
      .select('*')
      .single()

    if (error) throw new Error(`Could not create the application: ${error.message}`)
    return toProject(data as ProjectRow)
  },

  async updateProject(id, ownerId, patch: ProjectPatch) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.plainLanguageSummary !== undefined
          ? { plain_language_summary: patch.plainLanguageSummary }
          : {}),
        ...(patch.state !== undefined ? { state: patch.state } : {}),
        ...(patch.involvesIndigenousResearch !== undefined
          ? { involves_indigenous_research: patch.involvesIndigenousResearch }
          : {}),
        ...(patch.involvesCommunityEngagedResearch !== undefined
          ? { involves_community_engaged_research: patch.involvesCommunityEngagedResearch }
          : {}),
        ...(patch.routingNote !== undefined ? { routing_note: patch.routingNote } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', ownerId)
      .select('*')
      .single()

    if (error) throw new Error(`Could not save this application: ${error.message}`)
    return toProject(data as ProjectRow)
  },

  async getAnswers(projectId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('intake_answers')
      .select('question_key, answer')
      .eq('project_id', projectId)

    if (error) throw new Error(`Could not load your answers: ${error.message}`)

    const answers: AnswerMap = {}
    for (const row of (data ?? []) as { question_key: string; answer: string | null }[]) {
      answers[row.question_key] = row.answer ?? ''
    }
    return answers
  },

  async saveAnswers({ projectId, answeredBy, answers, sections }: SaveAnswersInput) {
    const rows = Object.entries(answers).map(([questionKey, answer]) => ({
      project_id: projectId,
      question_key: questionKey,
      form_section: sections[questionKey] ?? null,
      answer,
      answered_by: answeredBy,
      updated_at: new Date().toISOString(),
    }))

    if (rows.length === 0) return

    const supabase = await requireClient()
    // The table has a unique constraint on (project_id, question_key), so
    // re-answering a question updates it rather than accumulating duplicates.
    const { error } = await supabase
      .from('intake_answers')
      .upsert(rows, { onConflict: 'project_id,question_key' })

    if (error) throw new Error(`Could not save your answers: ${error.message}`)
  },

  async listDrafts(projectId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('drafts')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_current', true)
      .order('form_section', { ascending: true })

    if (error) throw new Error(`Could not load your drafts: ${error.message}`)
    return (data ?? []).map(toDraft)
  },

  async saveDraft(projectId, input: NewDraft) {
    const supabase = await requireClient()

    const { data: prior, error: priorError } = await supabase
      .from('drafts')
      .select('version')
      .eq('project_id', projectId)
      .eq('form_section', input.formSection)
      .order('version', { ascending: false })
      .limit(1)

    if (priorError) throw new Error(`Could not save the draft: ${priorError.message}`)

    // Version per section, not per project: section 2.4 reaching version 3 says
    // nothing about 2.9.
    const version = ((prior?.[0] as { version: number } | undefined)?.version ?? 0) + 1

    if (version > 1) {
      const { error: supersedeError } = await supabase
        .from('drafts')
        .update({ is_current: false })
        .eq('project_id', projectId)
        .eq('form_section', input.formSection)
        .eq('is_current', true)

      if (supersedeError) {
        throw new Error(`Could not supersede the previous draft: ${supersedeError.message}`)
      }
    }

    const { data, error } = await supabase
      .from('drafts')
      .insert({
        project_id: projectId,
        form_section: input.formSection,
        section_title: input.sectionTitle ?? null,
        content: input.content,
        version,
        is_current: true,
        // Guardrail 5. The table also refuses a row claiming AI authorship with
        // no model version, so a bug here fails loudly rather than producing a
        // draft nobody can attribute.
        ai_generated: input.aiGenerated,
        model_version: input.modelVersion,
        edited_by_human: input.editedByHuman ?? false,
        word_count: input.wordCount ?? null,
        word_limit: input.wordLimit ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Could not save the draft: ${error.message}`)
    return toDraft(data as DraftRow)
  },

  async listInterpretations(projectId) {
    const supabase = await requireClient()
    const { data, error } = await supabase
      .from('method_interpretations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Could not load the method check: ${error.message}`)

    return (data ?? []).map(
      (row: InterpretationRow): MethodInterpretation => ({
        id: row.id,
        projectId: row.project_id,
        formSection: row.form_section,
        interpretation: row.interpretation,
        response: row.response,
        researcherCorrection: row.researcher_correction,
        respondedBy: row.responded_by,
        respondedAt: row.responded_at,
        modelVersion: row.model_version,
        createdAt: row.created_at,
      }),
    )
  },

  async replaceInterpretations(projectId, items: NewInterpretation[]) {
    const supabase = await requireClient()

    // Deleting the old set loses the previous round's responses. That is the
    // intent: a project sent back to intake and returned must be reviewed
    // against the answers as they now stand, and the transition log already
    // records that the round happened.
    const { error: deleteError } = await supabase
      .from('method_interpretations')
      .delete()
      .eq('project_id', projectId)

    if (deleteError) throw new Error(`Could not reset the method check: ${deleteError.message}`)
    if (items.length === 0) return

    const { error } = await supabase.from('method_interpretations').insert(
      items.map((item) => ({
        project_id: projectId,
        form_section: item.formSection,
        interpretation: item.interpretation,
        model_version: item.modelVersion,
        response: 'pending',
      })),
    )

    if (error) throw new Error(`Could not prepare the method check: ${error.message}`)
  },

  async respondToInterpretation({ id, projectId, response, correction, respondedBy }: RespondInput) {
    const supabase = await requireClient()
    const { error } = await supabase
      .from('method_interpretations')
      .update({
        response,
        researcher_correction: correction?.trim() || null,
        responded_by: respondedBy,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('project_id', projectId)

    // The table's check constraints reject an altered or rejected response with
    // no correction, so a bug in the caller surfaces here rather than writing a
    // review that never happened.
    if (error) throw new Error(`Could not record your response: ${error.message}`)
  },

  async recordTransition({ projectId, from, to, actorId, reason }: TransitionInput) {
    const supabase = await requireClient()
    const { error } = await supabase.from('project_state_transitions').insert({
      project_id: projectId,
      from_state: from,
      to_state: to,
      actor_id: actorId,
      reason: reason ?? null,
    })

    // Guardrail 3 depends on this trail existing, so a failure here is loud.
    if (error) throw new Error(`Could not record the step change: ${error.message}`)
  },
}
