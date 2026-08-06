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
export function AppShell({
  session,
  profileName,
  children,
}: {
  session: Session
  /** From the saved profile. Preferred over the sign-in address once set. */
  profileName?: string | null
  children: ReactNode
}) {
  const name = profileName?.trim() || session.displayName

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
            <p className="text-xs text-muted">Phase 1, Work in Progress</p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/profile"
              title="Your details"
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <PersonIcon />
              <span>{name}</span>
            </a>

            {/* Nothing to sign out of in review mode, so no button to offer. */}
            {session.isReview ? null : (
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2"
                >
                  Sign Out
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

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="10" cy="6.5" r="3.25" />
      <path d="M3.75 16.5a6.25 6.25 0 0 1 12.5 0" />
    </svg>
  )
}
