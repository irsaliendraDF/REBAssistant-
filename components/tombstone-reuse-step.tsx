import Link from 'next/link'

import { respondToReuse } from '@/app/project/[id]/actions'
import type { Profile } from '@/lib/data/types'
import { filledFields } from '@/lib/profile/tombstone'

/**
 * Guardrail 7, at the one moment it applies: a saved profile being pulled into a
 * new application.
 *
 * The researcher sees exactly what would be carried over, item by item, and
 * chooses. Neither answer is presented as the correct one, and declining is a
 * real option rather than a discouraging link, because a consent step whose
 * refusal path is hidden is not a consent step.
 *
 * Both answers are recorded. A declined reuse is as much a decision as an
 * accepted one, and a record that only ever says yes cannot be evidence of
 * anything.
 */
export function TombstoneReuseStep({
  projectId,
  profile,
}: {
  projectId: string
  profile: Profile
}) {
  const fields = filledFields(profile)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">
          Carry your saved details into this application?
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          You entered these before. They can be filled in for you so you are not retyping them.
        </p>

        <dl className="mt-5 divide-y divide-line border-y border-line">
          {fields.map((field) => (
            <div key={field.label} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
              <dt className="w-56 shrink-0 text-xs text-muted">{field.label}</dt>
              <dd className="text-sm text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted">
          These are your own details as a researcher. No participant information is stored by this
          tool or carried between applications. Your decision is recorded against this application,
          and you can change your saved details at any time on{' '}
          <Link href="/profile" className="underline underline-offset-4">
            your details
          </Link>
          .
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <form action={respondToReuse}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="intent" value="accept" />
            <button
              type="submit"
              className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
            >
              Yes, use these details
            </button>
          </form>

          <form action={respondToReuse}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="intent" value="decline" />
            <button
              type="submit"
              className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
            >
              No, start this one blank
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
