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

/**
 * Tombstone data: the researcher details that persist across projects and get
 * reused on the next application. One row per user.
 *
 * Researcher details only. There is no participant equivalent of this type and
 * there must never be one.
 */
export interface Profile {
  id: string
  fullName: string | null
  email: string | null
  role: string | null
  department: string | null
  institution: string
  coreCertificateStatus: string | null
  coreCertificateDate: string | null
  phone: string | null
  updatedAt: string
}

export type ProfileInput = Partial<Omit<Profile, 'id' | 'updatedAt'>>

/** Guardrail 7. Append only: recorded, never edited, never deleted. */
export type ConsentKind = 'tombstone_reuse' | 'app_terms' | 'ai_disclosure_ack'

export interface ConsentRecord {
  userId: string
  projectId: string | null
  kind: ConsentKind
  granted: boolean
  /** Exactly what was shown at the moment of confirming, stored verbatim. */
  disclosureText: string
  /** What was carried over, so the record can be reconstructed later. */
  scope: Record<string, unknown> | null
  consentVersion: string
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

/**
 * The verification loop, and the proof that a human reviewed every reasoning
 * step. Mirrors `method_interpretations`, including its constraints: a
 * correction is required when altering or rejecting, and a resolved response
 * must record who resolved it and when.
 */
export type InterpretationResponse = 'pending' | 'confirmed' | 'altered' | 'rejected'

export interface MethodInterpretation {
  id: string
  projectId: string
  formSection: string | null
  interpretation: string
  response: InterpretationResponse
  researcherCorrection: string | null
  respondedBy: string | null
  respondedAt: string | null
  /** Null when the interpretation was derived by rule rather than by a model. */
  modelVersion: string | null
  createdAt: string
}

export interface NewInterpretation {
  formSection: string | null
  interpretation: string
  modelVersion: string | null
}

export interface RespondInput {
  id: string
  projectId: string
  response: Exclude<InterpretationResponse, 'pending'>
  correction: string | null
  respondedBy: string
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

  getProfile(userId: string): Promise<Profile | null>
  upsertProfile(userId: string, input: ProfileInput): Promise<Profile>

  /**
   * Whether this consent has already been recorded for this project. Checked
   * before asking, so the researcher is asked once per project rather than on
   * every visit, which is the interaction the agreement's Section 9 settles on.
   */
  hasConsent(projectId: string, kind: ConsentKind): Promise<boolean>
  recordConsent(record: ConsentRecord): Promise<void>

  listProjects(ownerId: string): Promise<Project[]>
  getProject(id: string, ownerId: string): Promise<Project | null>
  createProject(input: CreateProjectInput): Promise<Project>
  updateProject(id: string, ownerId: string, patch: ProjectPatch): Promise<Project>

  getAnswers(projectId: string): Promise<AnswerMap>
  saveAnswers(input: SaveAnswersInput): Promise<void>

  listInterpretations(projectId: string): Promise<MethodInterpretation[]>
  /**
   * Replaces the set for a project. Used when it enters method check, so a
   * project sent back to intake and returned gets interpretations built from the
   * answers as they now stand, rather than stale ones the researcher already
   * rejected.
   */
  replaceInterpretations(projectId: string, items: NewInterpretation[]): Promise<void>
  respondToInterpretation(input: RespondInput): Promise<void>

  recordTransition(input: TransitionInput): Promise<void>
}
