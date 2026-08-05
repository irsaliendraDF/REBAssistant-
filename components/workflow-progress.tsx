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
 */
export function WorkflowProgress({ current }: { current?: ProjectState }) {
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
          className="absolute left-[8.333%] right-[8.333%] top-3.5 h-0.5 rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-slate-900 transition-[width] duration-500"
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
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : isCurrent
                      ? 'border-slate-900 bg-white text-slate-900 ring-4 ring-slate-900/10'
                      : 'border-slate-300 bg-white text-slate-400',
                ].join(' ')}
              >
                {isComplete ? (
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
                  isComplete || isCurrent ? 'font-medium text-slate-900' : 'text-slate-500',
                ].join(' ')}
              >
                {definition.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
