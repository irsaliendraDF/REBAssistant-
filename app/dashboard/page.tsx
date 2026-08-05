import Link from 'next/link'

import { WorkflowProgress } from '@/components/workflow-progress'
import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { STATE_DEFINITIONS } from '@/lib/workflow/states'

import { createProject } from './actions'

export const metadata = {
  title: 'Your applications | Research Ethics Board Assistant',
}

export default async function DashboardPage() {
  const session = await getSession()
  const store = getStore()
  const projects = session ? await store.listProjects(session.userId) : []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Your applications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Each application moves through a fixed sequence. You advance it yourself at every step,
            and nothing moves forward on its own.
          </p>
        </div>

        <form action={createProject}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Start a new application
          </button>
        </form>
      </div>

      <WorkflowProgress />

      {store.isEphemeral ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <span className="font-medium">Nothing here is saved permanently yet.</span> The database
          is not connected, so applications live in the server's memory and disappear when it
          restarts. The schema is written and ready in <code>supabase/migrations</code>.
        </p>
      ) : null}

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-900">No applications yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Starting one opens a few questions about the shape of your research. It takes a couple
            of minutes, and you can leave and come back at any point.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/project/${project.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-400"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{project.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {STATE_DEFINITIONS[project.state].label}
                    {project.involvesIndigenousResearch ||
                    project.involvesCommunityEngagedResearch ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        Some sections routed to a person
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="text-xs text-slate-400">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500">
        Research Ethics Board Assistant helps you prepare an application. It does not review,
        approve or exempt research. Every ethics determination is made by the Research Ethics Board.
      </p>
    </div>
  )
}
