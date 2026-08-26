'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getRequestOrigin } from '@/lib/app-url'
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
 *
 * The same email carries a six-digit code, and `signInWithCode` below accepts
 * it. That is not a nicety. A link is a single-use URL sitting in a university
 * mailbox: Microsoft 365, which Dalhousie runs, opens links in mail to check
 * them, and a link that has been opened once is spent. A typed code cannot be
 * spent by something that reads the message, and it works on a phone when the
 * link was asked for on a laptop, which the link itself cannot.
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

  // Derived from the request rather than from a variable, so a production email
  // can never point at localhost. See lib/app-url.ts.
  const origin = await getRequestOrigin()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    // Rate limiting is worth naming: it is the one failure where trying again
    // immediately is exactly the wrong move.
    if (/rate|limit|too many/i.test(error.message)) {
      redirect('/sign-in?error=rate_limited')
    }

    // Everything else lands on the same screen as a success, with a caveat.
    //
    // We do not know that the email was not sent. Supabase reports a failure
    // when it does not get a timely answer from the mail server, and Gmail's
    // handshake is regularly slower than that window, so the message goes out
    // and arrives while the app is saying it could not be sent. That happened
    // in testing on 26 August 2026.
    //
    // Claiming it failed is worse than useless here. It is wrong, and it hides
    // the six-digit code box, which only appears on the sent screen. So the
    // researcher would receive a working email and be looking at a page that
    // offered them no way to use it.
    redirect(`/sign-in?sent=${encodeURIComponent(email)}&unconfirmed=1`)
  }

  redirect(`/sign-in?sent=${encodeURIComponent(email)}`)
}

/**
 * The six-digit code from the same email, typed in.
 *
 * Two types are tried. A researcher signing in for the first time gets the
 * confirm-signup email, whose code Supabase types as `signup`; everyone else
 * gets the magic link email, typed `email`. Which one an address is on is not
 * something the sign-in screen knows, and asking would be a strange question, so
 * the wrong guess is simply retried. A failed verification does not spend the
 * code.
 */
export async function signInWithCode(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const code = String(formData.get('code') ?? '').replace(/[\s-]/g, '')

  const back = `/sign-in?sent=${encodeURIComponent(email)}`

  if (!email.includes('@')) {
    redirect('/sign-in?error=invalid_email')
  }
  if (!/^\d{6}$/.test(code)) {
    redirect(`${back}&error=invalid_code`)
  }

  const supabase = await createClient()
  if (!supabase) {
    redirect('/sign-in?error=auth_not_configured')
  }

  for (const type of ['email', 'signup'] as const) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type })
    if (!error) {
      redirect('/dashboard')
    }
  }

  redirect(`${back}&error=code_failed`)
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
    try {
      await supabase.auth.signOut()
    } catch {
      // Signing out of a session the server has already forgotten fails, and
      // failing to sign out is not a reason to stay signed in. The cookies go
      // either way.
    }
  }

  await clearAuthCookies()
  redirect('/sign-in')
}

/**
 * The way out of a stuck sign-in.
 *
 * A browser holding a session cookie the server will no longer accept is in a
 * state nothing on the sign-in screen fixes, because signing out needs a session
 * to sign out of. This deletes what is there and asks for nothing. It is the
 * first thing to try when someone says they cannot get in on a computer where
 * they used to be able to.
 */
export async function clearSession() {
  await clearAuthCookies()
  redirect('/sign-in?cleared=1')
}

/**
 * Everything this app or Supabase may have set. Supabase splits a large session
 * across several numbered cookies, so this matches on the prefix rather than
 * naming them: missing one leaves a half-session behind, which reads to the
 * client library as a corrupt one.
 */
async function clearAuthCookies() {
  const cookieStore = await cookies()

  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name)
    }
  }

  cookieStore.delete(PLACEHOLDER_COOKIE)
}
