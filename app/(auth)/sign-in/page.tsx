import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'

import { signInAsTestResearcher } from '../actions'

export const metadata = {
  title: 'Sign in | Research Ethics Board Assistant',
}

export default async function SignInPage() {
  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }

  // Placeholder sign-in is off and real authentication is not connected yet.
  // Rather than show a form that throws on submit, say what the state is.
  const signInUnavailable = !env.app.usePlaceholderAuth && !isSupabaseConfigured

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
          Dalhousie University
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Research Ethics Board Assistant
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Prepare a Research Ethics Board application, section by section. Research Ethics Board
          Assistant helps you draft and spot gaps. It does not decide whether your application will
          be approved.
        </p>
      </div>

      {signInUnavailable ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Sign-in is not available yet</p>
          <p className="mt-1 leading-relaxed">
            This is an early build. Accounts are created once the database is connected, which is
            scheduled before the internal test on August 10.
          </p>
        </div>
      ) : (
        <>
          {env.app.usePlaceholderAuth ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Placeholder sign-in</p>
              <p className="mt-1 leading-relaxed">
                Local build only. Email magic link replaces this when the hosted project is
                connected.
              </p>
            </div>
          ) : null}

          <form action={signInAsTestResearcher} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="test.researcher@dal.ca"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Continue
            </button>
          </form>
        </>
      )}
    </main>
  )
}
