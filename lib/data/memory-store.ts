import 'server-only'

import { randomUUID } from 'node:crypto'

import { connection } from 'next/server'

import type {
  AnswerMap,
  ConsentRecord,
  DataStore,
  Draft,
  MethodInterpretation,
  Profile,
  Project,
} from './types'

/**
 * In-memory store, for the stretch before the hosted database exists.
 *
 * It makes the whole flow walkable today: create an application, answer triage
 * and intake, watch the progress track fill. What it does not do is remember any
 * of that beyond the life of the server process. A restart, a redeploy, or a
 * second serverless instance picking up the next request all lose the answers.
 *
 * That limitation is surfaced rather than hidden. `isEphemeral` is true, and the
 * interface says so on every project screen, because a tool that quietly drops
 * an hour of a researcher's work is worse than one that admits it cannot save
 * yet.
 *
 * Held on globalThis so the dev server's hot reload does not wipe state on every
 * file change, which would make the flow untestable while building it.
 *
 * The reads call `connection()` first. Without it these resolve synchronously
 * during prerendering, so the dashboard was baked at build time with an empty
 * project list and never updated. The Supabase store does not need this: it
 * reads session cookies, which already opts those pages into request-time
 * rendering.
 */

interface MemoryDatabase {
  projects: Map<string, Project>
  answers: Map<string, AnswerMap>
  interpretations: Map<string, MethodInterpretation[]>
  drafts: Map<string, Draft[]>
  profiles: Map<string, Profile>
  consents: ConsentRecord[]
}

const globalForStore = globalThis as unknown as { __rebMemoryDatabase?: MemoryDatabase }

function db(): MemoryDatabase {
  // Each collection is checked individually rather than the object as a whole.
  // An all-or-nothing initialiser only runs when the global is absent, so a
  // process that survived a hot reload from before a collection existed keeps
  // the old shape, and the new field reads as undefined. That is not only a
  // development annoyance: any long-lived process across a deploy would hit it.
  const database = (globalForStore.__rebMemoryDatabase ??= {} as MemoryDatabase)
  database.projects ??= new Map()
  database.answers ??= new Map()
  database.interpretations ??= new Map()
  database.drafts ??= new Map()
  database.profiles ??= new Map()
  database.consents ??= []
  return database
}

function assertOwned(project: Project | undefined, ownerId: string): Project | null {
  if (!project) return null
  // Same ownership rule the row level security policies apply in Postgres, so
  // behaviour does not change when the store swaps.
  return project.ownerId === ownerId ? project : null
}

export const memoryStore: DataStore = {
  isEphemeral: true,
  name: 'in-memory',

  async getProfile(userId) {
    await connection()
    return db().profiles.get(userId) ?? null
  },

  async upsertProfile(userId, input) {
    const existing = db().profiles.get(userId)
    const profile: Profile = {
      id: userId,
      fullName: null,
      email: null,
      role: null,
      department: null,
      institution: 'Dalhousie University',
      coreCertificateStatus: null,
      coreCertificateDate: null,
      phone: null,
      bannerNumber: null,
      romeoRegistered: false,
      affiliation: null,
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    }
    db().profiles.set(userId, profile)
    return profile
  },

  async hasConsent(projectId, kind) {
    await connection()
    return db().consents.some(
      (record) => record.projectId === projectId && record.kind === kind,
    )
  },

  async hasUserConsent(userId, kind) {
    await connection()
    return db().consents.some(
      (record) => record.userId === userId && record.kind === kind,
    )
  },

  async recordConsent(record) {
    // Append only, matching the table. Nothing here updates or removes an
    // earlier record: a consent record that can be rewritten is not a record.
    db().consents.push({ ...record })
  },

  async listProjects(ownerId) {
    await connection()
    return [...db().projects.values()]
      .filter((project) => project.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  async getProject(id, ownerId) {
    await connection()
    return assertOwned(db().projects.get(id), ownerId)
  },

  async createProject({ ownerId, title }) {
    const now = new Date().toISOString()
    const project: Project = {
      id: randomUUID(),
      ownerId,
      title,
      plainLanguageSummary: null,
      institution: 'Dalhousie University',
      state: 'triage',
      involvesIndigenousResearch: false,
      involvesCommunityEngagedResearch: false,
      routingNote: null,
      createdAt: now,
      updatedAt: now,
    }
    db().projects.set(project.id, project)
    return project
  },

  async updateProject(id, ownerId, patch) {
    const existing = assertOwned(db().projects.get(id), ownerId)
    if (!existing) {
      throw new Error('Project not found')
    }
    const updated: Project = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    db().projects.set(id, updated)
    return updated
  },

  async getAnswers(projectId) {
    await connection()
    return { ...(db().answers.get(projectId) ?? {}) }
  },

  async saveAnswers({ projectId, answers }) {
    const existing = db().answers.get(projectId) ?? {}
    db().answers.set(projectId, { ...existing, ...answers })
  },

  async listDrafts(projectId) {
    await connection()
    return (db().drafts.get(projectId) ?? []).filter((draft) => draft.isCurrent)
  },

  async saveDraft(projectId, input) {
    const existing = db().drafts.get(projectId) ?? []

    // Version per section, not per project: section 2.4 reaching version 3 says
    // nothing about 2.9.
    const priorForSection = existing.filter((draft) => draft.formSection === input.formSection)
    const version = priorForSection.reduce((max, draft) => Math.max(max, draft.version), 0) + 1

    for (const draft of priorForSection) {
      draft.isCurrent = false
    }

    const saved: Draft = {
      id: `${projectId}:${input.formSection}:${version}`,
      projectId,
      formSection: input.formSection,
      sectionTitle: input.sectionTitle ?? null,
      content: input.content,
      version,
      isCurrent: true,
      aiGenerated: input.aiGenerated,
      modelVersion: input.modelVersion,
      editedByHuman: input.editedByHuman ?? false,
      wordCount: input.wordCount ?? null,
      wordLimit: input.wordLimit ?? null,
      createdAt: new Date().toISOString(),
    }

    db().drafts.set(projectId, [...existing, saved])
    return saved
  },

  async listInterpretations(projectId) {
    await connection()
    return [...(db().interpretations.get(projectId) ?? [])]
  },

  async replaceInterpretations(projectId, items) {
    const now = new Date().toISOString()
    db().interpretations.set(
      projectId,
      items.map((item, index) => ({
        id: `${projectId}:${index}`,
        projectId,
        formSection: item.formSection,
        interpretation: item.interpretation,
        response: 'pending',
        researcherCorrection: null,
        respondedBy: null,
        respondedAt: null,
        modelVersion: item.modelVersion,
        createdAt: now,
      })),
    )
  },

  async respondToInterpretation({ id, projectId, response, correction, respondedBy }) {
    const list = db().interpretations.get(projectId) ?? []
    const existing = list.find((item) => item.id === id)
    if (!existing) {
      throw new Error('Interpretation not found')
    }

    // The same constraints Postgres enforces, applied here so behaviour does not
    // change when the store swaps. An altered or rejected reading without a
    // correction is not a review, it is a shrug.
    if ((response === 'altered' || response === 'rejected') && !correction?.trim()) {
      throw new Error('A correction is required when altering or rejecting an interpretation')
    }

    Object.assign(existing, {
      response,
      researcherCorrection: correction?.trim() || null,
      respondedBy,
      respondedAt: new Date().toISOString(),
    })
  },

  async recordTransition({ projectId, from, to, actorId }) {
    // The audit trail is a real table in Postgres. Here it is a log line, which
    // is enough to see the sequence while developing and honest about being no
    // more than that.
    console.info(`[workflow] ${projectId}: ${from} -> ${to} by ${actorId}`)
  },
}
