'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { PLACEHOLDER_COOKIE } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign-in.
 *
 * Email magic link, not institutional single sign-on (build plan Section 9,
 * assumption 1). No Google or other social sign-in: one identity per researcher,
 * so their saved details are reused rather than fragmented across two accounts
 * they did not realise were different.
 */
export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  if (!email || !email.includes('@')) {
    redirect('/sign-in?error=invalid_email')
  }

  const supabase = await createClient()
  if (!supabase) {
    redirect('/sign-in?error=auth_not_configured')
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.app.url}/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    // Rate limiting is the likely cause during testing, since the built-in
    // sender allows only a few messages an hour. Say so rather than showing a
    // generic failure the researcher cannot act on.
    const reason = /rate|limit|too many/i.test(error.message) ? 'rate_limited' : 'send_failed'
    redirect(`/sign-in?error=${reason}`)
  }

  redirect(`/sign-in?sent=${encodeURIComponent(email)}`)
}

/**
 * Placeholder sign-in for the local phase, before the database exists.
 *
 * Refuses to run once placeholder auth is switched off, so it cannot linger into
 * a real environment. Note that it stops being usable the moment Supabase is
 * connected regardless: its synthetic user id does not exist in auth.users, and
 * row level security would reject every write it attempted.
 */
export async function signInAsTestResearcher(formData: FormData) {
  if (!env.app.usePlaceholderAuth) {
    throw new Error(
      'Placeholder sign-in is disabled. Use the magic link flow now that Supabase auth is configured.',
    )
  }

  if (isSupabaseConfigured) {
    throw new Error(
      'Placeholder sign-in cannot be used against a real database. Its user id does not exist in auth.users, so row level security would reject every write.',
    )
  }

  const email = String(formData.get('email') ?? '').trim() || 'test.researcher@dal.ca'

  const cookieStore = await cookies()
  cookieStore.set(
    PLACEHOLDER_COOKIE,
    encodeURIComponent(
      JSON.stringify({
        // Stable id so tombstone reuse can be exercised across projects locally.
        userId: '00000000-0000-4000-8000-000000000001',
        email,
      }),
    ),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    },
  )

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  if (supabase) {
    await supabase.auth.signOut()
  }

  const cookieStore = await cookies()
  cookieStore.delete(PLACEHOLDER_COOKIE)
  redirect('/sign-in')
}
