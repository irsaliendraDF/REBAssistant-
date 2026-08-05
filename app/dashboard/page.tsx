import { isSupabaseConfigured } from '@/lib/env'
import { PROJECT_STATES, STATE_DEFINITIONS } from '@/lib/workflow/states'

export const metadata = {
  title: 'Your applications | REB Assistant',
}

/**
 * Project list. Empty by design at this stage: the schema exists as migrations
 * but no database is connected yet, so there is nothing to read. The empty state
 * says so plainly rather than showing a spinner that never resolves.
 */
export default async function DashboardPage() {
  const projects: { id: string; title: string; state: string }[] = []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your applications</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Each application moves through a fixed sequence. You advance it yourself at every step,
          and nothing moves forward on its own.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {PROJECT_STATES.map((state, index) => (
          <li
            key={state}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
            title={STATE_DEFINITIONS[state].description}
          >
            <span className="font-mono text-[10px] text-slate-400">{index + 1}</span>
            {STATE_DEFINITIONS[state].label}
          </li>
        ))}
      </ol>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">No applications yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            {isSupabaseConfigured
              ? 'Start a new application to begin with triage.'
              : 'The database is not connected yet, so applications cannot be created or saved. The schema is written and ready in supabase/migrations.'}
          </p>
        </div>
      ) : null}

      <p className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
        REB Assistant helps you prepare an application. It does not review, approve or exempt
        research. Every ethics determination is made by the Research Ethics Board.
      </p>
    </div>
  )
}
