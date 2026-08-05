import 'server-only'

import { requireClient } from '@/lib/supabase/server'

import type {
  AnswerMap,
  CreateProjectInput,
  DataStore,
  Project,
  ProjectPatch,
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
