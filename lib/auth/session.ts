import 'server-only'

import { cookies } from 'next/headers'

import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * The auth boundary.
 *
 * PLACEHOLDER for the local phase. Until the hosted Supabase project exists
 * there is no user store, so a signed cookie stands in for a session. It is
 * deliberately crude: a single local test identity, no password, no persistence
 * beyond the cookie.
 *
 * When Supabase arrives, `NEXT_PUBLIC_USE_PLACEHOLDER_AUTH=false` switches this
 * to the real magic link session and nothing above this module changes. That is
 * the whole point of routing every caller through `getSession()` rather than
 * reading cookies or Supabase directly in pages.
 *
 * Auth is email magic link, not Dalhousie SSO (build plan Section 9,
 * assumption 1). Institutional SSO needs Dal IT involvement and a formal
 * integration request, which will not happen by September 1.
 */

export const PLACEHOLDER_COOKIE = 'reb_placeholder_session'

export interface Session {
  userId: string
  email: string
  displayName: string
  /** True while the placeholder stands in for real authentication. */
  isPlaceholder: boolean
}

export async function getSession(): Promise<Session | null> {
  if (!env.app.usePlaceholderAuth) {
    const supabase = await createClient()
    if (!supabase) return null

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    return {
      userId: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Researcher',
      isPlaceholder: false,
    }
  }

  const cookieStore = await cookies()
  const value = cookieStore.get(PLACEHOLDER_COOKIE)?.value
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { userId: string; email: string }
    if (!parsed.userId || !parsed.email) return null
    return {
      userId: parsed.userId,
      email: parsed.email,
      displayName: parsed.email,
      isPlaceholder: true,
    }
  } catch {
    return null
  }
}
