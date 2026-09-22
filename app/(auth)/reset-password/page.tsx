import { AuthLinks, AuthPage, Field, SubmitButton } from '@/components/auth-page'
import { signInMessage } from '@/lib/auth/messages'
import { getSession } from '@/lib/auth/session'

import { setNewPassword } from '../actions'

export const metadata = {
  title: 'Set a new password | Research Ethics Board Assistant',
}

/**
 * Reached from the emailed reset link, which signs the person in first. That
 * session is what makes `updateUser` possible, so there is no token on this
 * screen and nothing to copy across.
 *
 * Arriving here without one means the link was never used, or has expired, or
 * was opened somewhere else. Saying so beats an empty form that fails on submit.
 */
export default async function ResetPasswordPage(props: PageProps<'/reset-password'>) {
  const search = await props.searchParams
  const error = signInMessage(readOne(search.error))

  const session = await getSession()

  if (!session) {
    return (
      <AuthPage error={error}>
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">This Link Is No Longer Active</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Reset links last an hour and work once, and they have to be opened in the browser that
            asked for them. Ask for a fresh one and open it on this device.
          </p>
          <div className="mt-5 border-t border-line pt-4">
            <a href="/forgot-password" className="text-sm text-muted underline underline-offset-4">
              Send a new link
            </a>
          </div>
        </div>
      </AuthPage>
    )
  }

  return (
    <AuthPage error={error}>
      <div className="mb-6">
        <p className="text-sm font-medium text-ink">Choose A New Password</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You are setting the password for{' '}
          <span className="font-medium text-ink">{session.email}</span>.
        </p>
      </div>

      <form action={setNewPassword} className="space-y-4">
        <Field
          id="password"
          name="password"
          type="password"
          label="New password"
          hint="At least six characters. Longer is better."
          autoComplete="new-password"
        />
        <SubmitButton>Save Password</SubmitButton>
      </form>

      {/* There used to be a "skip and go to your applications" link here. It was
          true, in that the recovery link has already signed them in, and it was
          the worst possible advice: most people reaching this screen are setting
          a password for the first time, and skipping leaves them with no
          password and locked out again on their next visit. The way out is the
          sign-in screen, not the dashboard. */}
      <AuthLinks>
        <a href="/sign-in" className="underline underline-offset-4 hover:text-ink">
          Back to sign in
        </a>
        <a href="/forgot-password" className="underline underline-offset-4 hover:text-ink">
          Send a new link
        </a>
      </AuthLinks>
    </AuthPage>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
