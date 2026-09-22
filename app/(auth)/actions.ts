'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getRequestOrigin } from '@/lib/app-url'
import {
  isServiceUnavailable,
  readRegisterOutcome,
  readSignInOutcome,
} from '@/lib/auth/send-outcome'
import { PLACEHOLDER_COOKIE } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign-in: email and password.
 *
 * Replaced the magic link on 21 September 2026, by Irene's decision. The link
 * had accumulated a remedy for each of its failure modes: a six-digit code
 * because Microsoft 365, which Dalhousie runs, spends single-use links by
 * scanning them; a browser reset because a link opened in the wrong browser
 * cannot complete; four separate messages for four ways a link dies. Each was a
 * correct fix for a real failure, and together they were a sign-in screen that
 * needed explaining. A password has none of those failures.
 *
 * Email has not disappeared. It moved from every sign-in to twice in an
 * account's life: confirming it, and resetting a forgotten password. Confirmation
 * stays on deliberately, because without it anyone could register an address they
 * do not own.
 *
 * No institutional single sign-on and no social sign-in, unchanged. See
 * `docs/decisions.md` and `docs/sign-in-spec-2.md`.
 */
export async function signInWithPassword(formData: FormData) {
  const email = readEmail(formData)
  const password = String(formData.get('password') ?? '')

  if (!email) redirect('/sign-in?error=invalid_email')
  if (!password) redirect('/sign-in?error=missing_password')

  const supabase = await createClient()
  if (!supabase) redirect('/sign-in?error=auth_not_configured')

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // Read from the error's shape, never from its wording. See
  // lib/auth/send-outcome.ts for why that distinction has its own module.
  switch (readSignInOutcome(error)) {
    case 'signed_in':
      redirect('/dashboard')
    case 'service_unavailable':
      // Must never surface as a rejected password. A researcher told their
      // password is wrong will retype a password they know is right until they
      // conclude they are locked out.
      redirect('/sign-in?error=service_unavailable')
    case 'email_not_confirmed':
      redirect('/sign-in?error=email_not_confirmed')
    case 'rate_limited':
      redirect('/sign-in?error=rate_limited')
    case 'invalid_credentials':
    case 'failed':
      redirect('/sign-in?error=invalid_credentials')
  }
}

/**
 * Creating an account, which is a deliberate act and never a side effect.
 *
 * The magic link used to create an account for any address typed into the
 * sign-in box, silently, which is how one researcher reached this product under
 * three addresses with work under two of them. Nothing failed when it happened:
 * they signed in successfully, to an empty dashboard.
 *
 * Under a password that cannot recur, because signing in with an unknown address
 * simply fails. **This is the only screen left that can catch someone opening a
 * second account for themselves**, so it says plainly when the address already
 * has one, rather than quietly doing nothing.
 */
export async function register(formData: FormData) {
  const email = readEmail(formData)
  const password = String(formData.get('password') ?? '')

  if (!email) redirect('/register?error=invalid_email')
  if (!password) redirect('/register?error=missing_password')

  const supabase = await createClient()
  if (!supabase) redirect('/register?error=auth_not_configured')

  // Derived from the request rather than from a variable, so a production email
  // can never point at localhost. See lib/app-url.ts.
  const origin = await getRequestOrigin()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/callback` },
  })

  switch (readRegisterOutcome(error, data?.user)) {
    case 'confirm_email':
      redirect(`/register?sent=${encodeURIComponent(email)}`)
    case 'already_registered':
      redirect(`/register?error=already_registered`)
    case 'weak_password':
      redirect('/register?error=weak_password')
    case 'rate_limited':
      redirect('/register?error=rate_limited')
    case 'service_unavailable':
      redirect('/register?error=service_unavailable')
    case 'failed':
      redirect('/register?error=invalid_credentials')
  }
}

/**
 * Asking for a reset link.
 *
 * This is the path the four accounts that predate passwords use to set one for
 * the first time, which is why it is built properly rather than as an
 * afterthought. It is also the path this product's own usage pattern guarantees
 * will be used: researchers work hard for a week and come back months later,
 * which is exactly when a password has been forgotten.
 *
 * The screen says the same thing whether or not the address has an account,
 * because Supabase reports success either way and saying more would turn this
 * form into a way of discovering who has an account.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = readEmail(formData)
  if (!email) redirect('/forgot-password?error=invalid_email')

  const supabase = await createClient()
  if (!supabase) redirect('/forgot-password?error=auth_not_configured')

  const origin = await getRequestOrigin()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/callback?next=/reset-password`,
  })

  if (isServiceUnavailable(error)) {
    redirect('/forgot-password?error=service_unavailable')
  }
  if (error?.status === 429) {
    redirect('/forgot-password?error=rate_limited')
  }

  redirect(`/forgot-password?sent=${encodeURIComponent(email)}`)
}

/**
 * The six-digit code from the reset email, typed in.
 *
 * Not a nicety, and the reason it exists is written down twice already in this
 * repository. A reset link is a single-use URL sitting in a university mailbox:
 * Microsoft 365, which Dalhousie runs, follows links in mail to check them, and
 * a link that has been followed once is spent before anyone clicks it. The link
 * also completes only in the browser that asked for it, so reading the email on
 * a phone after asking on a laptop cannot work.
 *
 * Both of those killed the magic link. Moving to a password moved them onto the
 * reset path rather than removing them, and the reset path shipped on
 * 21 September without this. A typed code has neither problem.
 */
export async function verifyResetCode(formData: FormData) {
  const email = readEmail(formData)
  const code = String(formData.get('code') ?? '').replace(/[\s-]/g, '')

  if (!email) redirect('/forgot-password?error=invalid_email')

  const back = `/forgot-password?sent=${encodeURIComponent(email)}`
  if (!/^\d{6}$/.test(code)) redirect(`${back}&error=invalid_code`)

  const supabase = await createClient()
  if (!supabase) redirect('/forgot-password?error=auth_not_configured')

  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })

  if (error) {
    if (isServiceUnavailable(error)) redirect(`${back}&error=service_unavailable`)
    redirect(`${back}&error=code_failed`)
  }

  // Verified, so there is now a session, which is what lets the next screen
  // change the password.
  redirect('/reset-password')
}

/**
 * Setting a new password, from the session the reset link established.
 *
 * `updateUser` needs a session, which is why this only works having arrived
 * through the link. Someone who opens `/reset-password` cold has no session and
 * is sent to ask for a link.
 */
export async function setNewPassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  if (!password) redirect('/reset-password?error=missing_password')

  const supabase = await createClient()
  if (!supabase) redirect('/reset-password?error=auth_not_configured')

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (isServiceUnavailable(error)) redirect('/reset-password?error=service_unavailable')
    if (error.code === 'weak_password') redirect('/reset-password?error=weak_password')
    redirect('/reset-password?error=reset_failed')
  }

  redirect('/dashboard')
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
    throw new Error('Placeholder sign-in is disabled. Use the email and password flow.')
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

function readEmail(formData: FormData): string | null {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  return email.includes('@') ? email : null
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
