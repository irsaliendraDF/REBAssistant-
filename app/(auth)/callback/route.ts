import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Magic link callback.
 *
 * Wired now so the auth shape is settled, but inert until Supabase is
 * provisioned: with no client configured it redirects to sign-in with a clear
 * reason rather than failing obscurely.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_not_configured`)
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
