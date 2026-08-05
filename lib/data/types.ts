import type { ProjectState } from '@/lib/workflow/states'

/**
 * The data access boundary.
 *
 * Everything above this file talks to a `DataStore`, never to Supabase and never
 * to a Map. That is what lets the app run today, with answers held in memory,
 * and switch to the hosted database by changing which implementation is
 * returned, with no change to a single page or action.
 *
 * The shapes below mirror the migrations in `supabase/migrations`. Where a name
 * differs it is only camelCase against snake_case.
 *
 * Note what is absent, deliberately: there is no participant type, and no field
 * anywhere for a participant's name, contact details or identifiers. Guardrail 2
 * is enforced by the schema, and this interface does not offer a way around it.
 */

export interface Project {
  id: string
  ownerId: string
  title: string
  plainLanguageSummary: string | null
  institution: string
  state: ProjectState

  /** Guardrail 4. Set during triage. Blocks generation of the affected sections. */
  involvesIndigenousResearch: boolean
  involvesCommunityEngagedResearch: boolean
  routingNote: string | null

  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  ownerId: string
  title: string
}

export interface ProjectPatch {
  title?: string
  plainLanguageSummary?: string | null
  state?: ProjectState
  involvesIndigenousResearch?: boolean
  involvesCommunityEngagedResearch?: boolean
  routingNote?: string | null
}

/** Answers keyed by question key. One value per question, per project. */
export type AnswerMap = Record<string, string>

export interface SaveAnswersInput {
  projectId: string
  answeredBy: string
  /** Question key to answer text. Keys absent from this map are left alone. */
  answers: AnswerMap
  /** Question key to the form section it feeds, e.g. '2.3'. */
  sections: Record<string, string | undefined>
}

export interface TransitionInput {
  projectId: string
  from: ProjectState
  to: ProjectState
  actorId: string
  reason?: string
}

export interface DataStore {
  /**
   * True when answers do not survive a restart. The interface exposes this so
   * the interface can tell the researcher, rather than losing their work
   * silently.
   */
  readonly isEphemeral: boolean
  readonly name: string

  listProjects(ownerId: string): Promise<Project[]>
  getProject(id: string, ownerId: string): Promise<Project | null>
  createProject(input: CreateProjectInput): Promise<Project>
  updateProject(id: string, ownerId: string, patch: ProjectPatch): Promise<Project>

  getAnswers(projectId: string): Promise<AnswerMap>
  saveAnswers(input: SaveAnswersInput): Promise<void>

  recordTransition(input: TransitionInput): Promise<void>
}
