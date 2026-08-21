import {
  PROJECT_STATES,
  STATE_DEFINITIONS,
  progressPercent,
  stateIndex,
  type ProjectState,
} from '@/lib/workflow/states'

/**
 * The workflow, as a progress track.
 *
 * Takes `current` so the same component serves the dashboard, where there is no
 * project yet and nothing is filled, and a project page, where it shows how far
 * along that application is. Keeping one component means the sequence can never
 * drift between the two places a researcher sees it.
 *
 * The fill reaches a step's marker when the project has entered that step, not
 * when it has finished it. `complete` is the last state, so a completed
 * application fills the track.
 *
 * A checkpoint is not a seventh step and does not get a marker. It is drawn as a
 * pause on the step being left, because that is what it is: the project is still
 * in that state until the researcher confirms.
 */
export function WorkflowProgress({
  current,
  atCheckpoint,
}: {
  current?: ProjectState
  /** True while the researcher is at a checkpoint on the way out of `current`. */
  atCheckpoint?: boolean
}) {
  const currentIndex = current ? stateIndex(current) : -1
  const fillPercent = progressPercent(current)

  return (
    // Six labelled steps do not fit a phone screen legibly. Scrolling the track
    // keeps every label readable rather than shrinking them all until none are.
    <div className="overflow-x-auto pb-2">
      <ol
        className="relative flex min-w-[600px] items-start"
        aria-label="Application progress"
      >
        {/* The track sits behind the markers, spanning first centre to last. */}
        <div
          aria-hidden
          className="absolute left-[8.333%] right-[8.333%] top-3.5 h-0.5 rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-500"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {PROJECT_STATES.map((state, index) => {
          const definition = STATE_DEFINITIONS[state]
          const isComplete = currentIndex > index
          const isCurrent = currentIndex === index

          return (
            // The description sits on the list item, not on the label. On the
            // label its title attribute became the accessible name, so assistive
            // technology announced the whole explanation in place of the step
            // name. Here it is a tooltip over the entire step instead, which is
            // also a larger hover target than a two-word label.
            <li
              key={state}
              title={definition.description}
              className="relative flex flex-1 flex-col items-center gap-2 px-1 text-center"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium',
                  isComplete
                    ? 'border-forest bg-forest text-white'
                    : isCurrent
                      ? 'border-forest bg-white text-ink ring-4 ring-olive/40'
                      : 'border-line bg-white text-faint',
                ].join(' ')}
              >
                {isCurrent && atCheckpoint ? (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="currentColor"
                    role="img"
                    aria-label="At a checkpoint"
                  >
                    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
                    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
                  </svg>
                ) : isComplete ? (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>

              <span
                className={[
                  'text-xs leading-snug',
                  isComplete || isCurrent ? 'font-medium text-ink' : 'text-muted',
                ].join(' ')}
              >
                {definition.label}
              </span>

              {isCurrent && atCheckpoint ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-forest">
                  Checkpoint
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
