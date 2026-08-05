import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'

import { signOut } from '../(auth)/actions'

/**
 * The auth boundary. Everything under /dashboard requires a session, checked on
 * the server before any child renders.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Research Ethics Board Assistant</p>
            <p className="text-xs text-slate-500">Dalhousie University</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">{session.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {session.isPlaceholder ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto w-full max-w-5xl px-6 py-2 text-xs text-amber-900">
            Local build. Placeholder sign-in and no database connected yet.
          </p>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}
