import { redirect } from 'next/navigation'

import { AuthLinks, AuthPage, Field, SubmitButton } from '@/components/auth-page'
import { signInMessage } from '@/lib/auth/messages'
import { getSession } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'

import { signInAsTestResearcher, signInWithPassword } from '../actions'

export const metadata = {
  title: 'Sign in | Research Ethics Board Assistant',
}

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const search = await props.searchParams

  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }

  const error = signInMessage(readOne(search.error))
  const confirmed = search.confirmed === '1'
  const usePlaceholder = env.app.usePlaceholderAuth && !isSupabaseConfigured
  const signInUnavailable = !usePlaceholder && !isSupabaseConfigured

  if (signInUnavailable) {
    return (
      <AuthPage error={error}>
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          <p className="font-medium text-ink">Sign-In Is Not Available Yet</p>
          <p className="mt-1 leading-relaxed">
            This is an early build. Accounts are created once the database is connected.
          </p>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage error={error}>
      {confirmed ? (
        <p className="mb-6 rounded-lg border border-olive/60 bg-lime-soft/40 px-4 py-3 text-sm leading-relaxed text-ink">
          Your email is confirmed. Sign in below.
        </p>
      ) : null}

      {usePlaceholder ? (
        <div className="mb-6 rounded-lg border border-olive/60 bg-lime-soft/40 p-4 text-sm text-ink">
          <p className="font-medium">Placeholder sign-in</p>
          <p className="mt-1 leading-relaxed">
            Local build only, with no database connected. Email and password replaces this once
            Supabase is configured.
          </p>
        </div>
      ) : null}

      <form
        action={usePlaceholder ? signInAsTestResearcher : signInWithPassword}
        className="space-y-4"
      >
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          placeholder="you@dal.ca"
          defaultValue={usePlaceholder ? 'test.researcher@dal.ca' : undefined}
        />
        {usePlaceholder ? null : (
          <Field
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
          />
        )}
        <SubmitButton>{usePlaceholder ? 'Continue' : 'Sign In'}</SubmitButton>
      </form>

      {usePlaceholder ? null : (
        <AuthLinks>
          <a href="/forgot-password" className="underline underline-offset-4 hover:text-ink">
            Forgot your password?
          </a>
          <a href="/register" className="underline underline-offset-4 hover:text-ink">
            Create an account
          </a>
        </AuthLinks>
      )}
    </AuthPage>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
