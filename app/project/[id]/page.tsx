import { notFound } from 'next/navigation'

import { BackButton, BackLink } from '@/components/back-link'
import { CheckpointStep } from '@/components/checkpoint-step'
import { CompleteStep } from '@/components/complete-step'
import { DraftStep } from '@/components/draft-step'
import { GapAnalysisStep } from '@/components/gap-analysis-step'
import { IntakeStep } from '@/components/intake-step'
import { MethodCheckStep } from '@/components/method-check-step'
import { ParticipantDisclosure } from '@/components/participant-disclosure'
import { TombstoneReuseStep } from '@/components/tombstone-reuse-step'
import { TriageStep } from '@/components/triage-step'
import { WorkflowProgress } from '@/components/workflow-progress'
import { hasAnythingToReuse } from '@/lib/profile/tombstone'
import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import {
  suggestCompanionDocuments,
  templatesReferenced,
} from '@/lib/documents/companions'
import { templateAvailability, type TemplateAvailability } from '@/lib/documents/templates'
import { assembleDraft } from '@/lib/draft/assemble'
import { isAnthropicConfigured } from '@/lib/env'
import { analyseGaps, type GapSeverity } from '@/lib/gaps/analyse'
import { visibleSections } from '@/lib/intake/questions'
import { displayTitle } from '@/lib/text'
import { buildCheckpoint, isCheckpointFor } from '@/lib/workflow/checkpoints'
import { STATE_DEFINITIONS, canGoBack, previousState } from '@/lib/workflow/states'

import { stepBack } from './actions'

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
  const drafts = project.state === 'draft' ? await store.listDrafts(id) : []

  // Guardrail 8, surface (b). Shown from drafting onwards, which is the first
  // point at which there is a document for the researcher to carry it into.
  const showsParticipantDisclosure =
    project.state === 'draft' || project.state === 'gap_analysis' || project.state === 'complete'
  const disclosureAcknowledged = showsParticipantDisclosure
    ? await store.hasConsent(id, 'ai_disclosure_ack')
    : false

  // Guardrail 7. Asked once per project, before any of the researcher's saved
  // details could be used, and only when there is something to reuse.
  const profile = project.state === 'triage' ? await store.getProfile(session.userId) : null
  const needsReuseDecision =
    project.state === 'triage' &&
    hasAnythingToReuse(profile) &&
    !(await store.hasConsent(id, 'tombstone_reuse'))
  const missing = readList(search.missing)
  const saved = search.saved === '1'
  const rejected = search.rejected === '1'
  const drafted = readOne(search.drafted)
  const draftFailed = readOne(search.draftFailed)

  const sections = visibleSections(answers)
  const requested = readOne(search.section)
  const current =
    sections.find((section) => section.formSection === requested) ?? sections[0]

  const definition = STATE_DEFINITIONS[project.state]

  // A checkpoint sits between two stages, so it is a view of the state the
  // project is in rather than a state of its own. The parameter asks for it; the
  // project's own state decides whether that is the checkpoint it is at.
  const checkpoint =
    isCheckpointFor(project.state, readOne(search.checkpoint)) && !needsReuseDecision
      ? buildCheckpoint({ project, answers, interpretations, drafts })
      : null

  // Only at the end, where there is enough on record to name the documents
  // specifically rather than reprinting the form's own appendix list.
  const companions =
    project.state === 'complete' ? suggestCompanionDocuments(project, answers) : []
  const templates: Record<string, TemplateAvailability> =
    companions.length > 0
      ? Object.fromEntries(
          await templateAvailability(
            templatesReferenced(companions).map((template) => template.filename),
          ),
        )
      : {}

  return (
    <div className="space-y-8">
      <div>
        <BackLink />
        {/* The download lives in the step that offers it, not here as well.
            Two identical buttons on one screen read as two different actions. */}
        <h1 className="mt-4 text-2xl font-semibold text-ink">{displayTitle(project.title)}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {definition.description}
        </p>
      </div>

      <WorkflowProgress current={project.state} />

      {/* One consistent place on every step, rather than a different affordance
          per screen. Hidden during the reuse decision, which has to be answered
          before the application has a step to return to. */}
      {canGoBack(project.state) && !needsReuseDecision && !checkpoint ? (
        <form action={stepBack}>
          <input type="hidden" name="projectId" value={project.id} />
          <BackButton>
            Back to {STATE_DEFINITIONS[previousState(project.state)!].label}
          </BackButton>
        </form>
      ) : null}

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

      {drafted ? (
        <p className="rounded-md border border-forest/40 bg-lime-soft/40 px-4 py-3 text-xs leading-relaxed text-ink">
          Section {drafted} saved. Open it below to read it. It is a draft, not a finished section:
          check every detail against what you actually intend to do.
        </p>
      ) : null}

      {draftFailed ? (
        <p className="rounded-md border border-alert/40 bg-alert-soft px-4 py-3 text-xs leading-relaxed text-alert">
          Section {draftFailed} was not drafted. {draftRefusalMessage(readOne(search.reason))}
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
          <p className="text-sm font-medium text-ink">Some Sections Go to a Person, Not the Tool</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{project.routingNote}</p>
        </div>
      ) : null}

      {needsReuseDecision && profile ? (
        <TombstoneReuseStep projectId={project.id} profile={profile} />
      ) : checkpoint ? (
        <CheckpointStep projectId={project.id} summary={checkpoint} />
      ) : project.state === 'triage' ? (
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
          draft={assembleDraft({ project, answers, drafts })}
          modelConnected={isAnthropicConfigured}
        />
      ) : project.state === 'gap_analysis' ? (
        <GapAnalysisStep
          projectId={project.id}
          findings={analyseGaps(project, answers)}
          activeSeverity={readSeverity(search.severity)}
          modelConnected={isAnthropicConfigured}
        />
      ) : (
        <CompleteStep projectId={project.id} documents={companions} availability={templates} />
      )}

      {showsParticipantDisclosure ? (
        <ParticipantDisclosure projectId={project.id} acknowledged={disclosureAcknowledged} />
      ) : null}

      <p className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
        Research Ethics Board Assistant helps you prepare an application. It does not review,
        approve or exempt research. Every ethics determination is made by the Research Ethics Board.
      </p>
    </div>
  )
}

/**
 * Why a section was not drafted, in words rather than a code.
 *
 * Each of these is a real outcome the researcher needs to be able to act on, so
 * none of them says "something went wrong". The redaction refusal in particular
 * has to name what the researcher should do, since it fires on their own text.
 */
function draftRefusalMessage(reason: string | undefined): string {
  switch (reason) {
    case 'blocked_by_guardrail':
      return 'This section is not drafted by the tool. It is yours to write, with the Research Ethics Office and, where relevant, the community.'
    case 'no_source_material':
      return 'There are no answers behind it yet, so there is nothing to draft from. Go back to intake and answer the questions for this section.'
    case 'refused_by_redaction_gate':
      return 'Your answers appear to contain information that must never be sent to an AI model, such as a health card number, Social Insurance Number or date of birth. Remove it from your answers and try again. Nothing was sent.'
    case 'declined_by_model':
      return 'The model declined to write it. If the section is unusual or sensitive, write it yourself and speak with the Research Ethics Office.'
    case 'empty_edit':
      return 'The edit was empty, so the existing draft has been left as it was.'
    default:
      return 'Please try again, and tell the Research Ethics Office if it keeps happening.'
  }
}

/** An unrecognised filter shows everything, rather than an empty list. */
function readSeverity(value: string | string[] | undefined): GapSeverity | undefined {
  const raw = readOne(value)
  return raw === 'missing' || raw === 'worth_reviewing' || raw === 'thin' ? raw : undefined
}

function readOne(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function readList(value: string | string[] | undefined): string[] {
  const raw = readOne(value)
  return raw ? raw.split(',').filter(Boolean) : []
}
