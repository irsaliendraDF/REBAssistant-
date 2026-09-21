import { redirect } from 'next/navigation'

import { AuthLinks, AuthPage, Field, SubmitButton } from '@/components/auth-page'
import { signInMessage } from '@/lib/auth/messages'
import { getSession } from '@/lib/auth/session'
import { isSupabaseConfigured } from '@/lib/env'

import { register } from '../actions'

export const metadata = {
  title: 'Create an account | Research Ethics Board Assistant',
}

export default async function RegisterPage(props: PageProps<'/register'>) {
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
          <p className="text-sm font-medium text-ink">Confirm Your Email</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A confirmation link is on its way to <span className="font-medium">{sentTo}</span>. Open
            it once and you can sign in. If it does not arrive within a couple of minutes, check
            your junk folder.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            This is the only email sign-in needs. After this, your password is enough.
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
      <form action={register} className="space-y-4">
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          hint="Use the address you will come back to. Applications stay with the address they were started under, and there is no way to move them."
          autoComplete="email"
          placeholder="you@dal.ca"
        />
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          hint="At least eight characters."
          autoComplete="new-password"
        />
        <SubmitButton>Create Account</SubmitButton>
      </form>

      <AuthLinks>
        <a href="/sign-in" className="underline underline-offset-4 hover:text-ink">
          Already have an account? Sign in
        </a>
      </AuthLinks>
    </AuthPage>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
