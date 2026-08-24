import { NextResponse } from 'next/server'

import {
  exchangeFailureReason,
  readCallbackParams,
  signInUrl,
} from '@/lib/auth/callback'
import { createClient } from '@/lib/supabase/server'

/**
 * Magic link callback.
 *
 * Two shapes of link arrive here, and both are accepted:
 *
 *   `?code=...`        the flow Supabase uses by default, which completes only
 *                      in the browser that asked for the link, because the
 *                      matching verifier is a cookie in that browser.
 *   `?token_hash=...`  a link that carries its own proof, so it also works when
 *                      the email is read on a phone or a second machine.
 *
 * Supabase also redirects here with `error` and `error_code` when a link is dead
 * on arrival. Those used to fall through to "that link was incomplete", which
 * told the researcher nothing they could act on.
 *
 * A route handler is one of the places cookies can be written, which is why the
 * session set here sticks. Keeping it refreshed afterwards is `proxy.ts`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const outcome = readCallbackParams(searchParams)

  if (outcome.kind === 'failed') {
    return NextResponse.redirect(signInUrl(origin, outcome.reason))
  }

  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.redirect(signInUrl(origin, 'auth_not_configured'))
  }

  const { error } =
    outcome.kind === 'token_hash'
      ? await supabase.auth.verifyOtp({
          type: outcome.type,
          token_hash: outcome.tokenHash,
        })
      : await supabase.auth.exchangeCodeForSession(outcome.code)

  if (error) {
    return NextResponse.redirect(signInUrl(origin, exchangeFailureReason(error.message)))
  }

  return NextResponse.redirect(`${origin}${outcome.next}`)
}
