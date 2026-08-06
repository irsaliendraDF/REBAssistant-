import { advanceWorkflow, draftSectionWithAi, saveSectionEdit } from '@/app/project/[id]/actions'
import type { DraftPackage, DraftSection } from '@/lib/draft/assemble'

/**
 * Step 4. What the assembled application looks like, section by section.
 *
 * The point of this screen is that a researcher can see, before downloading
 * anything, which sections have substance behind them and which do not. A
 * document that looks finished and is not is the failure mode worth designing
 * against here.
 *
 * Guardrail 3 is why drafting is a button per section rather than one button
 * that writes the application. Each section is drafted because someone asked for
 * that section, and every drafted section opens onto the text itself, editable,
 * rather than a claim that it was written.
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
  const drafted = draft.sections.filter((section) => section.status === 'ai_drafted').length

  return (
    <div className="space-y-6">
      {!modelConnected ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-medium">No section has been written by the tool yet.</span> The AI
          model is not connected, so the document below carries your own answers under each section
          rather than drafted prose. The structure, the numbering and the disclosure are real. The
          writing is still yours to do, or the tool’s once the model is connected.
        </p>
      ) : (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-medium">Draft one section at a time.</span> Open a section to see
          your answers, ask the tool to draft it, and edit what comes back. Nothing is drafted until
          you ask for it, and every section a model helped write is recorded as such in the
          disclosure that goes to the Board.
          {drafted > 0 ? ` ${drafted} of ${draft.sections.length} drafted so far.` : ''}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <ul className="divide-y divide-line">
          {draft.sections.map((section) => (
            <li key={section.number}>
              <SectionRow
                projectId={projectId}
                section={section}
                modelConnected={modelConnected}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`/project/${projectId}/export`}
          className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
        >
          Download Draft (.docx)
        </a>

        <form action={advanceWorkflow}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="to" value="gap_analysis" />
          <button
            type="submit"
            className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
          >
            Continue to Gap Analysis
          </button>
        </form>
      </div>
    </div>
  )
}

function SectionRow({
  projectId,
  section,
  modelConnected,
}: {
  projectId: string
  section: DraftSection
  modelConnected: boolean
}) {
  // Drafting is offered where there is something to draft from and nothing
  // stopping it. A blocked section never shows the button: guardrail 4 is
  // enforced in `draftSection` regardless, but a button that only ever refuses
  // is its own kind of dishonesty.
  const canDraft =
    modelConnected &&
    !section.blockedFromDrafting &&
    (section.status === 'awaiting_drafting' || section.status === 'ai_drafted')

  const hasContent = section.content.trim().length > 0

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-3 transition hover:bg-surface-2">
        <span className="w-10 shrink-0 font-mono text-xs leading-5 text-faint">
          {section.number}
        </span>
        <span className="flex-1 text-sm text-ink">
          {section.title}
          {section.note ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">{section.note}</span>
          ) : null}
        </span>
        <StatusBadge status={section.status} />
        <span
          aria-hidden
          className="shrink-0 text-xs text-faint transition group-open:rotate-90"
        >
          ▸
        </span>
      </summary>

      <div className="space-y-4 border-t border-line bg-surface px-5 py-4 pl-[3.75rem]">
        {section.sources.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-ink">Your Answers Behind This Section</p>
            <dl className="mt-2 space-y-2">
              {section.sources.map((source) => (
                <div key={source.question}>
                  <dt className="text-xs text-faint">{source.question}</dt>
                  <dd className="text-xs leading-relaxed whitespace-pre-wrap text-muted">
                    {source.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            No answers were captured for this section.
          </p>
        )}

        {hasContent ? (
          <form action={saveSectionEdit} className="space-y-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="formSection" value={section.number} />
            <label
              htmlFor={`draft-${section.number}`}
              className="block text-xs font-medium text-ink"
            >
              The Draft. Edit It Freely: What You Submit Is Yours.
            </label>
            <textarea
              id={`draft-${section.number}`}
              name="content"
              defaultValue={section.content}
              rows={Math.min(24, Math.max(6, Math.ceil(section.content.length / 90)))}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm leading-relaxed text-ink"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2"
              >
                Save Edit
              </button>
              <span className="text-xs text-faint">
                {section.wordCount} {section.wordCount === 1 ? 'word' : 'words'}
                {section.wordLimit ? ` of ${section.wordLimit} allowed` : ''}
              </span>
              {section.overWordLimit ? (
                <span className="text-xs font-medium text-alert">
                  Over the form’s limit. Shorten it before you submit.
                </span>
              ) : null}
            </div>
          </form>
        ) : null}

        {canDraft ? (
          <form action={draftSectionWithAi}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="formSection" value={section.number} />
            <button
              type="submit"
              className="rounded-md bg-forest px-3 py-2 text-xs font-medium text-white transition hover:bg-forest-dark"
            >
              {hasContent ? 'Draft This Section Again' : 'Draft This Section With AI'}
            </button>
          </form>
        ) : null}
      </div>
    </details>
  )
}

function StatusBadge({ status }: { status: DraftSection['status'] }) {
  const styles: Record<DraftSection['status'], string> = {
    from_record: 'bg-surface-2 text-muted',
    ai_drafted: 'bg-forest text-white',
    awaiting_drafting: 'bg-lime-soft text-ink',
    routed: 'bg-surface-2 text-ink',
    no_answers_yet: 'bg-alert-soft text-alert',
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
