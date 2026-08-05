import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { NotConfiguredError, env, isSupabaseConfigured } from '@/lib/env'

/**
 * Server client, scoped to the request's session cookies. Still the anon key,
 * so row level security applies. Use this for anything acting on behalf of the
 * signed-in researcher.
 */
export async function createClient() {
  if (!isSupabaseConfigured) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(env.supabase.url!, env.supabase.anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component, where cookies are read only. Session
          // refresh is handled in middleware instead, so this is safe to ignore.
        }
      },
    },
  })
}

export async function requireClient() {
  const client = await createClient()
  if (!client) {
    throw new NotConfiguredError('Supabase', [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ])
  }
  return client
}
