import { advanceToDraft, respondToInterpretation } from '@/app/project/[id]/actions'
import type { MethodInterpretation } from '@/lib/data/types'
import { allResolved, hasRejection } from '@/lib/method/interpret'

/**
 * Step 3. The load-bearing gate.
 *
 * The tool states how it has understood the methodology and the researcher
 * confirms, alters or rejects it. Rejection sends the project backwards, to
 * intake, not forwards.
 *
 * Three deliberate choices in this screen. Confirm is not the default and
 * nothing is preselected, because a preselected confirm is a rubber stamp with
 * extra steps. Altering or rejecting requires writing what is wrong, which the
 * database enforces too. And "Continue to Drafting" stays disabled until every
 * reading has an answer, so the gate cannot be walked past.
 */
export function MethodCheckStep({
  projectId,
  interpretations,
  correctionNeededFor,
  unresolved,
}: {
  projectId: string
  interpretations: MethodInterpretation[]
  correctionNeededFor?: string
  unresolved?: boolean
}) {
  const resolved = allResolved(interpretations)
  const rejected = hasRejection(interpretations)
  const ruleDerived = interpretations.some((item) => item.modelVersion === null)

  if (interpretations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
        <p className="text-sm font-medium text-ink">Nothing to Check Yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          There are no methodology answers to read back to you. Go back to intake and complete the
          study population, recruitment, consent and methods sections.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {ruleDerived ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-medium">These readings are summaries, not interpretations.</span>{' '}
          The AI model is not connected yet, so what follows restates your answers under each
          section rather than reasoning about them. Check that everything is filed where you meant
          it to be. Once the model is connected, this step becomes a genuine check on whether the
          tool has understood your methodology.
        </p>
      ) : (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-medium">These are readings, not summaries.</span> Each one says what
          the tool understood you to be doing, which means it can be wrong. Read them as a
          stranger's account of your study and correct anything that is not right. Nothing is
          drafted from a reading you have not answered, and rejecting one sends you back to intake
          to fix the answers behind it.
        </p>
      )}

      {unresolved ? (
        <p className="rounded-md border border-alert/40 bg-alert-soft px-4 py-3 text-xs text-alert">
          Every reading below needs a response before drafting can start.
        </p>
      ) : null}

      {interpretations.map((item) => {
        const needsCorrection = correctionNeededFor === item.id
        const answered = item.response !== 'pending'

        return (
          <form
            key={item.id}
            action={respondToInterpretation}
            className={[
              'space-y-4 rounded-lg border bg-white p-6',
              // An unreviewed reading carries the accent edge, so what still
              // needs attention is visible while scrolling a long list.
              answered ? 'border-line' : 'border-olive',
            ].join(' ')}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="interpretationId" value={item.id} />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="font-mono text-xs text-faint">
                Section {item.formSection ?? '—'}
              </p>
              <ResponseBadge response={item.response} />
            </div>

            <div className="space-y-1 text-sm leading-relaxed text-ink">
              {item.interpretation.split('\n').map((line, index) =>
                line.trim().length === 0 ? (
                  <div key={index} className="h-2" />
                ) : (
                  <p key={index}>{line}</p>
                ),
              )}
            </div>

            {item.researcherCorrection ? (
              <div className="rounded-md border-l-2 border-faint bg-surface px-4 py-3">
                <p className="text-xs font-medium text-muted">Your correction</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {item.researcherCorrection}
                </p>
              </div>
            ) : null}

            <div>
              <label
                htmlFor={`correction-${item.id}`}
                className="block text-sm font-medium text-ink"
              >
                What Have We Got Wrong?
              </label>
              <p className="mt-1 text-xs text-muted">
                Needed if you are correcting or rejecting this reading. Leave blank to confirm it.
              </p>
              {needsCorrection ? (
                <p className="mt-1 text-xs font-medium text-alert">
                  Say what is wrong before correcting or rejecting.
                </p>
              ) : null}
              <textarea
                id={`correction-${item.id}`}
                name="correction"
                rows={3}
                defaultValue={item.researcherCorrection ?? ''}
                className={[
                  'mt-2 w-full rounded-md border px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-forest',
                  needsCorrection ? 'border-alert' : 'border-line',
                ].join(' ')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                name="intent"
                value="confirm"
                className="rounded-md bg-forest px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-dark"
              >
                This Is Right
              </button>
              <button
                type="submit"
                name="intent"
                value="alter"
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface-2"
              >
                Mostly Right, With a Correction
              </button>
              <button
                type="submit"
                name="intent"
                value="reject"
                className="rounded-md border border-alert/40 px-4 py-2 text-sm font-medium text-alert transition hover:bg-alert-soft"
              >
                This Is Wrong, Take Me Back
              </button>
            </div>
          </form>
        )
      })}

      <form action={advanceToDraft} className="border-t border-line pt-6">
        <input type="hidden" name="projectId" value={projectId} />
        <button
          type="submit"
          disabled={!resolved || rejected}
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark disabled:cursor-not-allowed disabled:bg-line"
        >
          Continue to Drafting
        </button>
        <p className="mt-2 text-xs text-muted">
          {resolved && !rejected
            ? 'Every reading has been reviewed.'
            : `${interpretations.filter((item) => item.response === 'pending').length} of ${interpretations.length} still to review.`}
        </p>
      </form>
    </div>
  )
}

function ResponseBadge({ response }: { response: MethodInterpretation['response'] }) {
  const styles: Record<MethodInterpretation['response'], string> = {
    pending: 'bg-surface-2 text-muted',
    confirmed: 'bg-forest text-white',
    altered: 'bg-lime-soft text-ink',
    rejected: 'bg-alert-soft text-alert',
  }

  const labels: Record<MethodInterpretation['response'], string> = {
    pending: 'Not reviewed yet',
    confirmed: 'Confirmed',
    altered: 'Corrected',
    rejected: 'Rejected',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${styles[response]}`}>
      {labels[response]}
    </span>
  )
}
