import { redirect } from 'next/navigation'

import { signInMessage } from '@/lib/auth/messages'
import { getSession } from '@/lib/auth/session'
import { env, isSupabaseConfigured } from '@/lib/env'

import { clearSession, signInAsTestResearcher, signInWithCode, signInWithMagicLink } from '../actions'

export const metadata = {
  title: 'Sign in | Research Ethics Board Assistant',
}


export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const search = await props.searchParams

  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }

  const sentTo = readOne(search.sent)
  const error = signInMessage(readOne(search.error))
  const cleared = search.cleared === '1'
  // Offered only where it is the likely fix: a session this browser is holding
  // that the server will not accept. On a clean sign-in screen it is noise.
  const offersReset = Boolean(error) || cleared
  const usePlaceholder = env.app.usePlaceholderAuth && !isSupabaseConfigured
  const signInUnavailable = !usePlaceholder && !isSupabaseConfigured

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-ink">
          Research Ethics Board Assistant
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Prepare a Research Ethics Board application, section by section. Research Ethics Board
          Assistant helps you draft and spot gaps. It does not decide whether your application will
          be approved.
        </p>
      </div>

      {error ? (
        <p className="mb-6 rounded-lg border border-alert/40 bg-alert-soft px-4 py-3 text-sm leading-relaxed text-alert">
          {error}
        </p>
      ) : null}

      {cleared ? (
        <p className="mb-6 rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
          The sign-in data held in this browser has been cleared. Ask for a link below and start
          again.
        </p>
      ) : null}

      {sentTo ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">Check Your Email</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A sign-in link is on its way to <span className="font-medium">{sentTo}</span>. It is
            good for one use. If it does not arrive within a couple of minutes, check your junk
            folder before requesting another.
          </p>

          {/* The link has to be opened in this browser, and a university mail
              system may have opened it already by the time it arrives. The code
              in the same email has neither problem, so it is offered here rather
              than buried as a fallback for people who already gave up. */}
          <form action={signInWithCode} className="mt-5 border-t border-line pt-5">
            <input type="hidden" name="email" value={sentTo} />
            <label htmlFor="code" className="block text-sm font-medium text-ink">
              Or enter the six-digit code from that email
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Use this if the link does not work, or if you are reading the email on a different
              device from the one you are signing in on.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={7}
                placeholder="123456"
                className="w-32 rounded-md border border-line px-3 py-2 font-mono text-sm tracking-widest text-ink outline-none focus:border-forest"
              />
              <button
                type="submit"
                className="rounded-md bg-forest px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-dark"
              >
                Sign In
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
            <a href="/sign-in" className="text-sm text-muted underline underline-offset-4">
              Use a different email
            </a>
            <form action={signInWithMagicLink}>
              <input type="hidden" name="email" value={sentTo} />
              <button
                type="submit"
                className="text-sm text-muted underline underline-offset-4 hover:text-ink"
              >
                Send another link
              </button>
            </form>
          </div>
        </div>
      ) : signInUnavailable ? (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
          <p className="font-medium text-ink">Sign-In Is Not Available Yet</p>
          <p className="mt-1 leading-relaxed">
            This is an early build. Accounts are created once the database is connected.
          </p>
        </div>
      ) : (
        <>
          {usePlaceholder ? (
            <div className="mb-6 rounded-lg border border-olive/60 bg-lime-soft/40 p-4 text-sm text-ink">
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
              <label htmlFor="email" className="block text-sm font-medium text-muted">
                Email
              </label>
              {!usePlaceholder ? (
                <p className="mt-1 text-xs text-muted">
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
                className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-forest"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
            >
              {usePlaceholder ? 'Continue' : 'Email Me a Sign-In Link'}
            </button>
          </form>
        </>
      )}

      {offersReset && !usePlaceholder && isSupabaseConfigured ? (
        <form action={clearSession} className="mt-8 border-t border-line pt-5">
          <p className="text-xs leading-relaxed text-muted">
            Still stuck on a computer where this used to work? Clearing the sign-in data held in
            this browser resolves a session it can no longer use. It signs you out here and nowhere
            else, and deletes none of your work.
          </p>
          <button
            type="submit"
            className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            Clear sign-in data on this device
          </button>
        </form>
      ) : null}
    </main>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
