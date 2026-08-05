import 'server-only'

import { randomUUID } from 'node:crypto'

import { connection } from 'next/server'

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
}

const globalForStore = globalThis as unknown as { __rebMemoryDatabase?: MemoryDatabase }

function db(): MemoryDatabase {
  if (!globalForStore.__rebMemoryDatabase) {
    globalForStore.__rebMemoryDatabase = { projects: new Map(), answers: new Map() }
  }
  return globalForStore.__rebMemoryDatabase
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

  async recordTransition({ projectId, from, to, actorId }) {
    // The audit trail is a real table in Postgres. Here it is a log line, which
    // is enough to see the sequence while developing and honest about being no
    // more than that.
    console.info(`[workflow] ${projectId}: ${from} -> ${to} by ${actorId}`)
  },
}
