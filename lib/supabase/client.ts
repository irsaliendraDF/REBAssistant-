import { createBrowserClient } from '@supabase/ssr'

import { NotConfiguredError, env, isSupabaseConfigured } from '@/lib/env'

/**
 * Browser client. Anon key only, and every table is behind row level security,
 * so this client can only ever see the signed-in researcher's own rows.
 *
 * Returns null rather than throwing while the hosted project is still pending,
 * so UI can render a "not connected yet" state during the local phase.
 */
export function createClient() {
  if (!isSupabaseConfigured) {
    return null
  }
  return createBrowserClient(env.supabase.url!, env.supabase.anonKey!)
}

export function requireClient() {
  const client = createClient()
  if (!client) {
    throw new NotConfiguredError('Supabase', [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ])
  }
  return client
}
