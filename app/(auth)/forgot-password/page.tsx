import { redirect } from 'next/navigation'

import { AuthLinks, AuthPage, Field, SubmitButton } from '@/components/auth-page'
import { signInMessage } from '@/lib/auth/messages'
import { getSession } from '@/lib/auth/session'
import { isSupabaseConfigured } from '@/lib/env'

import { requestPasswordReset } from '../actions'

export const metadata = {
  title: 'Reset your password | Research Ethics Board Assistant',
}

export default async function ForgotPasswordPage(props: PageProps<'/forgot-password'>) {
  const search = await props.searchParams

  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }
  if (!isSupabaseConfigured) {
    redirect('/sign-in')
  }

  const sentTo = readOne(search.sent)
  const error = signInMessage(readOne(search.error))

  if (sentTo) {
    return (
      <AuthPage>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">Check Your Email</p>
          {/* Says the same thing whether or not the address has an account.
              Supabase reports success either way, on purpose, and saying more
              would turn this form into a way of finding out who has an account. */}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            If there is an account for <span className="font-medium">{sentTo}</span>, a link to set
            a new password is on its way. It is good for an hour and for one use. Check your junk
            folder before asking for another.
          </p>
          <div className="mt-5 border-t border-line pt-4">
            <a href="/sign-in" className="text-sm text-muted underline underline-offset-4">
              Back to sign in
            </a>
          </div>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage error={error}>
      <div className="mb-6">
        <p className="text-sm font-medium text-ink">Set Or Reset Your Password</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We will email you a link. Use this to set a password for the first time as well, if you
          used this tool before passwords existed.
        </p>
      </div>

      <form action={requestPasswordReset} className="space-y-4">
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          placeholder="you@dal.ca"
        />
        <SubmitButton>Email Me A Link</SubmitButton>
      </form>

      <AuthLinks>
        <a href="/sign-in" className="underline underline-offset-4 hover:text-ink">
          Back to sign in
        </a>
        <a href="/register" className="underline underline-offset-4 hover:text-ink">
          Create an account
        </a>
      </AuthLinks>
    </AuthPage>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
