import Link from 'next/link'

import { confirmCheckpoint } from '@/app/project/[id]/actions'
import { checkpointStageLabels, type CheckpointSummary } from '@/lib/workflow/checkpoints'

/**
 * The stop between two stages.
 *
 * Everything on this screen is a read-back. There is no field to fill in and
 * nothing to answer, because a checkpoint that asked a question would become
 * another form to get through rather than a moment to look at what has been
 * captured.
 *
 * Two ways out, and they are deliberately not weighted against each other: go on
 * to the next stage, or go back into the one behind and change something.
 * Nothing here is a verdict on the work, so the "back" route is a plain link
 * rather than a warning.
 *
 * `blockers` is the one thing that stops the button working, and it never
 * carries a matter of judgement: a required question with no answer, a reading
 * of the methodology nobody has responded to. The same conditions are checked
 * again on the server, because a disabled button is an interface, not a rule.
 */
export function CheckpointStep({
  projectId,
  summary,
}: {
  projectId: string
  summary: CheckpointSummary
}) {
  const { definition, captured, notes, blockers } = summary
  const stages = checkpointStageLabels(definition)
  const blocked = blockers.length > 0

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-forest/40 bg-lime-soft/30 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-forest">
          {stages.from} to {stages.to}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-ink">{definition.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{definition.intro}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <ul className="divide-y divide-line">
          {captured.map((item, index) => (
            <li key={index} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
              <div className="sm:w-64 sm:shrink-0">
                {item.formSection ? (
                  <Link
                    href={`/project/${projectId}?section=${encodeURIComponent(item.formSection)}`}
                    className="text-sm font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-ink">{item.label}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-muted">{item.detail}</p>
                {item.note ? (
                  <p className="mt-1 text-xs leading-relaxed text-faint">{item.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {notes.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-sm font-medium text-ink">Worth Knowing Before You Continue</p>
          <ul className="mt-3 space-y-2">
            {notes.map((note, index) => (
              <li key={index} className="text-sm leading-relaxed text-muted">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {blocked ? (
        <div className="rounded-lg border border-alert/40 bg-alert-soft p-5">
          <p className="text-sm font-medium text-alert">Not Ready to Move On Yet</p>
          <ul className="mt-3 space-y-2">
            {blockers.map((blocker, index) => (
              <li key={index} className="text-sm leading-relaxed text-alert">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-line pt-6">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">What happens next.</span> {definition.next}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <form action={confirmCheckpoint}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="checkpoint" value={definition.id} />
            <button
              type="submit"
              disabled={blocked}
              className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint"
            >
              {definition.confirmLabel}
            </button>
          </form>

          <Link
            href={`/project/${projectId}`}
            className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
          >
            {definition.backLabel}
          </Link>
        </div>

        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">
          Nothing moves until you press the button. Going back keeps every answer you have given.
        </p>
      </div>
    </div>
  )
}
