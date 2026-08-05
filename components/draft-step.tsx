import { advanceWorkflow } from '@/app/project/[id]/actions'
import type { DraftPackage, DraftSection } from '@/lib/draft/assemble'

/**
 * Step 4. What the assembled application looks like, section by section.
 *
 * The point of this screen is that a researcher can see, before downloading
 * anything, which sections have substance behind them and which do not. A
 * document that looks finished and is not is the failure mode worth designing
 * against here.
 */
export function DraftStep({
  projectId,
  draft,
  modelConnected,
}: {
  projectId: string
  draft: DraftPackage
  modelConnected: boolean
}) {
  return (
    <div className="space-y-6">
      {!modelConnected ? (
        <p className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700">
          <span className="font-medium">No section has been written by the tool yet.</span> The AI
          model is not connected, so the document below carries your own answers under each section
          rather than drafted prose. The structure, the numbering and the disclosure are real. The
          writing is still yours to do, or the tool’s once the model is connected.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-200">
          {draft.sections.map((section) => (
            <li key={section.number} className="flex items-start gap-4 px-5 py-3">
              <span className="w-10 shrink-0 font-mono text-xs text-slate-400">
                {section.number}
              </span>
              <span className="flex-1 text-sm text-slate-800">
                {section.title}
                {section.note ? (
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {section.note}
                  </span>
                ) : null}
              </span>
              <StatusBadge status={section.status} />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/project/${projectId}/export`}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Download draft (.docx)
        </a>

        <form action={advanceWorkflow}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="to" value="gap_analysis" />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Continue to gap analysis
          </button>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: DraftSection['status'] }) {
  const styles: Record<DraftSection['status'], string> = {
    from_record: 'bg-slate-100 text-slate-700',
    ai_drafted: 'bg-slate-900 text-white',
    awaiting_drafting: 'bg-amber-100 text-amber-900',
    routed: 'bg-slate-200 text-slate-800',
    no_answers_yet: 'bg-red-100 text-red-800',
  }

  const labels: Record<DraftSection['status'], string> = {
    from_record: 'From your details',
    ai_drafted: 'AI-assisted',
    awaiting_drafting: 'Your answers only',
    routed: 'Goes to a person',
    no_answers_yet: 'Nothing yet',
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}
