import type { ReactNode } from 'react'

import { signOut } from '@/app/(auth)/actions'
import type { Session } from '@/lib/auth/session'

/**
 * The signed-in chrome, shared by every section behind the auth boundary.
 *
 * The boundary itself stays in each section's layout, where it is visible in the
 * file that owns the route, rather than being buried in a shared component that
 * a new route could forget to use.
 */
export function AppShell({ session, children }: { session: Session; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      {/* A single brand rule across the top. The rest of the interface stays
          quiet: this is a form people work through, not a landing page. */}
      <div aria-hidden className="h-1 bg-forest" />
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-forest">
              Research Ethics Board Assistant
            </p>
            <p className="text-xs text-muted">Phase 1, work in progress</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted">{session.displayName}</span>
            {/* Nothing to sign out of in review mode, so no button to offer. */}
            {session.isReview ? null : (
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {session.isReview ? (
        <div className="border-b border-olive/50 bg-lime-soft/40">
          <p className="mx-auto w-full max-w-5xl px-6 py-2 text-xs text-ink">
            <span className="font-medium">Review build.</span> Sign-in is switched off so this can
            be looked at without an account, and no database is connected. Both change before the
            internal test.
          </p>
        </div>
      ) : session.isPlaceholder ? (
        <div className="border-b border-olive/50 bg-lime-soft/40">
          <p className="mx-auto w-full max-w-5xl px-6 py-2 text-xs text-ink">
            Local build. Placeholder sign-in and no database connected yet.
          </p>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
