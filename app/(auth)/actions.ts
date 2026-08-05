'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { PLACEHOLDER_COOKIE } from '@/lib/auth/session'
import { env } from '@/lib/env'

/**
 * Placeholder sign-in for the local phase.
 *
 * Replaced by a Supabase magic link when the hosted project is provisioned. It
 * refuses to run once placeholder auth is switched off, so it cannot linger into
 * a deployed environment by accident.
 */
export async function signInAsTestResearcher(formData: FormData) {
  if (!env.app.usePlaceholderAuth) {
    throw new Error(
      'Placeholder sign-in is disabled. Use the magic link flow once Supabase auth is configured.',
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
  const cookieStore = await cookies()
  cookieStore.delete(PLACEHOLDER_COOKIE)
  redirect('/sign-in')
}
