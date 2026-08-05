import 'server-only'

import { isSupabaseConfigured } from '@/lib/env'

import { memoryStore } from './memory-store'
import { supabaseStore } from './supabase-store'
import type { DataStore } from './types'

/**
 * Picks the store. This one function is the entire cost of the switch from
 * in-memory to hosted: set the Supabase variables and every page and action
 * starts persisting, unchanged.
 */
export function getStore(): DataStore {
  return isSupabaseConfigured ? supabaseStore : memoryStore
}

export type {
  AnswerMap,
  CreateProjectInput,
  DataStore,
  Project,
  ProjectPatch,
  SaveAnswersInput,
  TransitionInput,
} from './types'
