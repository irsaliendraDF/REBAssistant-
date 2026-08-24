import 'server-only'

import { cookies } from 'next/headers'

import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * The auth boundary.
 *
 * Three modes, in priority order.
 *
 * **Review mode.** Sign-in is skipped entirely and everyone is the reviewer.
 * For looking at work in progress before there is anything to protect. Every
 * screen says so. Off the moment a database is connected.
 *
 * **Placeholder.** A cookie stands in for a session while there is no user
 * store. Deliberately crude: one local test identity, no password, no
 * persistence beyond the cookie.
 *
 * **Real.** Supabase magic link, once the hosted project exists.
 *
 * Callers never read cookies or Supabase directly. They call `getSession()`,
 * which is why moving between these three modes changes nothing above this file.
 *
 * Auth is email magic link, not institutional single sign-on (build plan
 * Section 9, assumption 1). Institutional single sign-on needs university IT
 * involvement and a formal integration request, which will not happen by
 * September 1.
 */

export const PLACEHOLDER_COOKIE = 'reb_placeholder_session'

/** Stable id so tombstone reuse can be exercised across projects in review builds. */
const REVIEW_USER_ID = '00000000-0000-4000-8000-000000000002'

export interface Session {
  userId: string
  email: string
  displayName: string
  /** True while a stand-in stands in for real authentication. */
  isPlaceholder: boolean
  /** True when sign-in was skipped entirely, rather than merely faked. */
  isReview: boolean
}

export async function getSession(): Promise<Session | null> {
  if (env.app.reviewMode) {
    return {
      userId: REVIEW_USER_ID,
      email: 'Reviewer',
      displayName: 'Reviewer',
      isPlaceholder: true,
      isReview: true,
    }
  }

  if (!env.app.usePlaceholderAuth) {
    const supabase = await createClient()
    if (!supabase) return null

    // A refresh token Supabase will not accept, or Supabase being briefly
    // unreachable, throws here. Neither is a reason to return a 500 from every
    // page at once: no session is a state the app already handles, and it ends
    // at the sign-in screen, which is where someone in this position needs to
    // be. `proxy.ts` is what keeps a live session from reaching this branch.
    let user
    try {
      const result = await supabase.auth.getUser()
      user = result.data.user
    } catch {
      return null
    }
    if (!user) return null

    return {
      userId: user.id,
      email: user.email ?? '',
      displayName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Researcher',
      isPlaceholder: false,
      isReview: false,
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
      isReview: false,
    }
  } catch {
    return null
  }
}
