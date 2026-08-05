import Link from 'next/link'
import { notFound } from 'next/navigation'

import { DraftStep } from '@/components/draft-step'
import { GapAnalysisStep } from '@/components/gap-analysis-step'
import { IntakeStep } from '@/components/intake-step'
import { MethodCheckStep } from '@/components/method-check-step'
import { TriageStep } from '@/components/triage-step'
import { WorkflowProgress } from '@/components/workflow-progress'
import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { assembleDraft } from '@/lib/draft/assemble'
import { isAnthropicConfigured } from '@/lib/env'
import { analyseGaps } from '@/lib/gaps/analyse'
import { visibleSections } from '@/lib/intake/questions'
import { STATE_DEFINITIONS } from '@/lib/workflow/states'

export const metadata = {
  title: 'Application | Research Ethics Board Assistant',
}

export default async function ProjectPage(props: PageProps<'/project/[id]'>) {
  const { id } = await props.params
  const search = await props.searchParams

  const session = await getSession()
  if (!session) notFound()

  const store = getStore()
  const project = await store.getProject(id, session.userId)
  if (!project) notFound()

  const answers = await store.getAnswers(id)
  const interpretations =
    project.state === 'method_check' ? await store.listInterpretations(id) : []
  const missing = readList(search.missing)
  const saved = search.saved === '1'
  const rejected = search.rejected === '1'

  const sections = visibleSections(answers)
  const requested = readOne(search.section)
  const current =
    sections.find((section) => section.formSection === requested) ?? sections[0]

  const definition = STATE_DEFINITIONS[project.state]

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-muted underline-offset-4 hover:underline"
        >
          ← All applications
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{project.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {definition.description}
            </p>
          </div>

          {/* Available from intake onwards. A partial document that shows the
              real structure is the fastest way to find out whether the structure
              is right. */}
          {project.state !== 'triage' ? (
            <a
              href={`/project/${project.id}/export`}
              className="shrink-0 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
            >
              Download draft (.docx)
            </a>
          ) : null}
        </div>
      </div>

      <WorkflowProgress current={project.state} />

      {store.isEphemeral ? (
        <p className="rounded-md border border-olive/60 bg-lime-soft/40 px-4 py-3 text-xs leading-relaxed text-ink">
          <span className="font-medium">Answers are not being saved permanently.</span> The database
          is not connected yet, so what you enter here lives in the server's memory and will be lost
          when it restarts. Fine for walking through the flow, not for real work.
        </p>
      ) : null}

      {rejected ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          You have been brought back to intake, because the reading of your methodology was wrong.
          Correct the answers behind it and continue again when you are ready. Your correction has
          been recorded.
        </p>
      ) : null}

      {saved ? (
        <p className="rounded-md border border-line bg-white px-4 py-3 text-xs text-muted">
          Saved. You can close this and come back to it.
        </p>
      ) : null}

      {missing.length > 0 ? (
        <p className="rounded-md border border-alert/40 bg-alert-soft px-4 py-3 text-xs leading-relaxed text-alert">
          {missing.length === 1
            ? 'One question still needs an answer before you can move on. It is marked below.'
            : `${missing.length} questions still need answers before you can move on. They are marked below.`}
        </p>
      ) : null}

      {project.routingNote ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-medium text-ink">Some sections go to a person, not the tool</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{project.routingNote}</p>
        </div>
      ) : null}

      {project.state === 'triage' ? (
        <TriageStep projectId={project.id} answers={answers} missing={missing} />
      ) : project.state === 'method_check' ? (
        <MethodCheckStep
          projectId={project.id}
          interpretations={interpretations}
          correctionNeededFor={readOne(search.correctionNeeded)}
          unresolved={search.unresolved === '1'}
        />
      ) : project.state === 'intake' && current ? (
        <IntakeStep
          projectId={project.id}
          sections={sections}
          current={current}
          answers={answers}
          missing={missing}
        />
      ) : project.state === 'draft' ? (
        <DraftStep
          projectId={project.id}
          draft={assembleDraft({ project, answers })}
          modelConnected={isAnthropicConfigured}
        />
      ) : project.state === 'gap_analysis' ? (
        <GapAnalysisStep
          projectId={project.id}
          findings={analyseGaps(project, answers)}
          modelConnected={isAnthropicConfigured}
        />
      ) : (
        <div className="rounded-lg border border-line bg-white p-10 text-center">
          <p className="text-sm font-medium text-ink">Ready for you to review</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Download the document, check it, complete anything the tool left to you, and submit it
            yourself. Research Ethics Board Assistant does not submit applications and does not
            decide whether research is approved.
          </p>
          <a
            href={`/project/${project.id}/export`}
            className="mt-6 inline-block rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
          >
            Download draft (.docx)
          </a>
        </div>
      )}

      <p className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
        Research Ethics Board Assistant helps you prepare an application. It does not review,
        approve or exempt research. Every ethics determination is made by the Research Ethics Board.
      </p>
    </div>
  )
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function readList(value: string | string[] | undefined): string[] {
  const raw = readOne(value)
  return raw ? raw.split(',').filter(Boolean) : []
}
