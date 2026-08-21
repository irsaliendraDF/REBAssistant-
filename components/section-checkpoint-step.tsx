import Link from 'next/link'

import { confirmSectionCheckpoint } from '@/app/project/[id]/actions'
import { IntakeSectionNav } from '@/components/intake-section-nav'
import type { AnswerMap } from '@/lib/data/types'
import type { IntakeSection } from '@/lib/intake/questions'
import type { SectionCheckpointSummary } from '@/lib/workflow/checkpoints'

/**
 * The checkpoint between one intake section and the next.
 *
 * Lighter than the checkpoint between stages, and in the same layout as the
 * section it follows: the list of sections stays on the left, so this reads as a
 * pause inside intake rather than as having been taken somewhere else.
 *
 * The answers are shown as they were given, in full. Reading your own words back
 * is the whole mechanism, and a truncated answer is one nobody checks.
 */
export function SectionCheckpointStep({
  projectId,
  sections,
  answers,
  summary,
}: {
  projectId: string
  sections: IntakeSection[]
  answers: AnswerMap
  summary: SectionCheckpointSummary
}) {
  const blocked = summary.blockers.length > 0

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <IntakeSectionNav
        projectId={projectId}
        sections={sections}
        current={summary.formSection}
        answers={answers}
      />

      <div className="space-y-6">
        <div className="rounded-lg border border-forest/40 bg-lime-soft/30 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-forest">
            Section {summary.formSection} checkpoint
          </p>
          <h2 className="mt-2 text-lg font-semibold text-ink">
            What You Said About {summary.title.toLowerCase()}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Read it back before moving on. This is the section as it will reach the draft, and the
            Board.
          </p>
        </div>

        <dl className="overflow-hidden rounded-lg border border-line bg-white">
          {summary.captured.map((item, index) => (
            <div key={index} className="border-b border-line px-5 py-4 last:border-b-0">
              <dt className="text-sm font-medium leading-relaxed text-ink">{item.label}</dt>
              <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
                {item.detail}
              </dd>
              {item.note ? <p className="mt-1 text-xs text-faint">{item.note}</p> : null}
            </div>
          ))}
        </dl>

        {summary.notes.length > 0 ? (
          <div className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm font-medium text-ink">What These Answers Mean Further On</p>
            <ul className="mt-3 space-y-2">
              {summary.notes.map((note, index) => (
                <li key={index} className="text-sm leading-relaxed text-muted">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {blocked ? (
          <div className="rounded-lg border border-alert/40 bg-alert-soft p-5">
            <ul className="space-y-2">
              {summary.blockers.map((blocker, index) => (
                <li key={index} className="text-sm leading-relaxed text-alert">
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <form action={confirmSectionCheckpoint}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="formSection" value={summary.formSection} />
            <button
              type="submit"
              disabled={blocked}
              className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint"
            >
              {summary.next
                ? `Continue to Section ${summary.next.formSection}`
                : 'Finish Intake and Review'}
            </button>
          </form>

          <Link
            href={`/project/${projectId}?section=${encodeURIComponent(summary.formSection)}`}
            className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
          >
            Go Back and Change an Answer
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          {summary.next
            ? `Next: section ${summary.next.formSection}, ${summary.next.title.toLowerCase()}. You can also jump to any section from the list.`
            : 'This is the last section. Confirming takes you to the checkpoint at the end of intake.'}
        </p>
      </div>
    </div>
  )
}
