import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { NotConfiguredError, env, isSupabaseAdminConfigured } from '@/lib/env'

/**
 * Service role client. Bypasses row level security, so it is restricted to work
 * that genuinely cannot run as the user: knowledge base ingestion, and writing
 * redaction audit records (which must not depend on client permissions).
 *
 * `import 'server-only'` makes an accidental client import a build error. The
 * service role key is never committed and never reaches the browser.
 */
export function createAdminClient() {
  if (!isSupabaseAdminConfigured) {
    throw new NotConfiguredError('The Supabase service role client', [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ])
  }

  return createSupabaseClient(env.supabase.url!, env.supabase.serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
