import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'

import { signInAsTestResearcher, signInWithMagicLink } from '../actions'

export const metadata = {
  title: 'Sign in | Research Ethics Board Assistant',
}

const ERRORS: Record<string, string> = {
  invalid_email: 'That does not look like an email address. Please check it and try again.',
  auth_not_configured: 'Sign-in is not connected yet. Please try again shortly.',
  rate_limited:
    'Too many sign-in emails have been sent recently. Please wait a few minutes and try again.',
  send_failed: 'The sign-in email could not be sent. Please try again in a moment.',
  missing_code: 'That sign-in link was incomplete. Please request a new one.',
  exchange_failed: 'That sign-in link has expired or has already been used. Please request a new one.',
}

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const search = await props.searchParams

  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }

  const sentTo = readOne(search.sent)
  const error = ERRORS[readOne(search.error) ?? '']
  const usePlaceholder = env.app.usePlaceholderAuth && !isSupabaseConfigured
  const signInUnavailable = !usePlaceholder && !isSupabaseConfigured

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-slate-900">
          Research Ethics Board Assistant
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Prepare a Research Ethics Board application, section by section. Research Ethics Board
          Assistant helps you draft and spot gaps. It does not decide whether your application will
          be approved.
        </p>
      </div>

      {error ? (
        <p className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
          {error}
        </p>
      ) : null}

      {sentTo ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-900">Check your email</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            A sign-in link is on its way to <span className="font-medium">{sentTo}</span>. It is
            good for one use. If it does not arrive within a couple of minutes, check your junk
            folder before requesting another.
          </p>
          <a
            href="/sign-in"
            className="mt-4 inline-block text-sm text-slate-600 underline underline-offset-4"
          >
            Use a different email
          </a>
        </div>
      ) : signInUnavailable ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Sign-in is not available yet</p>
          <p className="mt-1 leading-relaxed">
            This is an early build. Accounts are created once the database is connected.
          </p>
        </div>
      ) : (
        <>
          {usePlaceholder ? (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Placeholder sign-in</p>
              <p className="mt-1 leading-relaxed">
                Local build only, with no database connected. The email link replaces this once
                Supabase is configured.
              </p>
            </div>
          ) : null}

          <form
            action={usePlaceholder ? signInAsTestResearcher : signInWithMagicLink}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              {!usePlaceholder ? (
                <p className="mt-1 text-xs text-slate-500">
                  We send a link that signs you in. There is no password to remember.
                </p>
              ) : null}
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={usePlaceholder ? 'test.researcher@dal.ca' : undefined}
                placeholder="you@dal.ca"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {usePlaceholder ? 'Continue' : 'Email me a sign-in link'}
            </button>
          </form>
        </>
      )}
    </main>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
