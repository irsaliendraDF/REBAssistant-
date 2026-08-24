import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session refresh.
 *
 * A Supabase access token lasts an hour. After that the client refreshes it
 * using the refresh token, and Supabase rotates the refresh token as it does so:
 * the old one stops working, and the new one has to be written back to the
 * researcher's cookies or the session is gone.
 *
 * A Server Component cannot write cookies. `lib/supabase/server.ts` therefore
 * swallows those writes, with a comment saying refresh is handled in middleware
 * instead. That file did not exist. So the refreshed token was thrown away on
 * every page load, and an hour after signing in the session stopped working with
 * no way back except a new sign-in email. That is the bug Shakara hit.
 *
 * This runs before every request, where cookies *can* be written, and does the
 * one thing that matters: calls `getUser()`, which refreshes an expired token,
 * and persists whatever comes back.
 *
 * In Next.js 16 this file is `proxy.ts`. `middleware.ts` is the same thing under
 * its old name and is deprecated, which is worth knowing when comparing this
 * against the Supabase documentation, which still says middleware.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function proxy(request: NextRequest) {
  // Local and review builds have no Supabase, and no session to refresh.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Both halves matter: the request copy so anything downstream in this
        // same request reads the refreshed token, and the response so the
        // browser keeps it for the next one.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  try {
    await supabase.auth.getUser()
  } catch {
    // A refresh that fails must not take the page down with it. The request
    // carries on unauthenticated, `getSession()` returns null, and the
    // researcher is asked to sign in, which is a recoverable state. Throwing
    // here would make an expired token a 500 on every route at once.
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. The sign-in and callback routes are
     * deliberately included: they set cookies of their own, and excluding them
     * would leave a stale token in place for exactly the request that is trying
     * to replace it.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
