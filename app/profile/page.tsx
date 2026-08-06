import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { BackLink } from '@/components/back-link'
import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { TOMBSTONE_FIELDS } from '@/lib/profile/tombstone'

import { saveProfile } from './actions'

export const metadata = {
  title: 'Your details | Research Ethics Board Assistant',
}

export default async function ProfilePage(props: PageProps<'/profile'>) {
  const search = await props.searchParams

  const session = await getSession()
  if (!session) redirect('/sign-in')

  const store = getStore()
  const profile = await store.getProfile(session.userId)
  const saved = readOne(search.saved) === '1'

  return (
    <AppShell session={session} profileName={profile?.fullName}>
      <div className="max-w-2xl space-y-8">
        <div>
          <BackLink />
          <h1 className="mt-4 text-2xl font-semibold text-ink">Your Details</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Entered once, and offered on every new application so you are not retyping them. You
            are asked before they are carried into a new application, and you can change them here
            at any time.
          </p>
        </div>

        <p className="rounded-md border border-sky-soft bg-sky-soft/40 px-4 py-3 text-xs leading-relaxed text-ink">
          These are your own details as a researcher. Research Ethics Board Assistant does not store
          information about the people who take part in your research, here or anywhere else.
        </p>

        {saved ? (
          <p className="flex items-center gap-2 rounded-md border border-forest/30 bg-lime-soft/40 px-4 py-3 text-xs font-medium text-forest">
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 8.5 6.5 12 13 4.5" />
            </svg>
            Your details have been saved.
          </p>
        ) : null}

        <form action={saveProfile} className="space-y-6 rounded-lg border border-line bg-white p-6">
          {TOMBSTONE_FIELDS.map((field) => {
            const value = profile?.[field.key]
            return (
              <div key={String(field.key)}>
                <label
                  htmlFor={String(field.key)}
                  className="block text-sm font-medium text-ink"
                >
                  {field.label}
                </label>
                {field.help ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted">{field.help}</p>
                ) : null}
                <input
                  id={String(field.key)}
                  name={String(field.key)}
                  type={field.type}
                  defaultValue={typeof value === 'string' ? value : ''}
                  className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-forest"
                />
              </div>
            )
          })}

          <div>
            <p className="text-sm font-medium text-ink">Email</p>
            <p className="mt-1 text-sm text-muted">{session.email}</p>
            <p className="mt-1 text-xs text-muted">
              Taken from the address you sign in with, and not editable here.
            </p>
          </div>

          <button
            type="submit"
            className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
          >
            Save Details
          </button>
        </form>
      </div>
    </AppShell>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
