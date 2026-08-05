/**
 * The workflow state machine.
 *
 *   triage -> intake -> method_check -> draft -> gap_analysis -> complete
 *
 * Guardrail 3: each transition requires an explicit user action. Nothing
 * advances automatically. There is no timer, no "if complete then advance", and
 * no server job that moves a project forward.
 *
 * `method_check` is the load-bearing gate. The app states its plain-language
 * interpretation of the methodology, and the researcher confirms, alters or
 * rejects it. Rejection sends the flow backwards, to `intake`, not through.
 */

export const PROJECT_STATES = [
  'triage',
  'intake',
  'method_check',
  'draft',
  'gap_analysis',
  'complete',
] as const

export type ProjectState = (typeof PROJECT_STATES)[number]

export interface StateDefinition {
  state: ProjectState
  label: string
  /** Shown to the researcher. Advisory language only, per guardrail 6. */
  description: string
  /** States this one may move to. Every move needs a user action. */
  allowedNext: ProjectState[]
}

export const STATE_DEFINITIONS: Record<ProjectState, StateDefinition> = {
  triage: {
    state: 'triage',
    label: 'Triage',
    description:
      'A few opening questions about the shape of the research, including whether it involves Indigenous or community-engaged research.',
    allowedNext: ['intake'],
  },
  intake: {
    state: 'intake',
    label: 'Intake',
    description:
      'The guided question sequence that gathers what the application needs, section by section.',
    allowedNext: ['method_check'],
  },
  method_check: {
    state: 'method_check',
    label: 'Method check',
    description:
      'Research Ethics Board Assistant states how it has understood your methodology. You confirm it, correct it, or reject it. Rejecting sends the project back to intake.',
    // Rejection goes backwards. This is the only state with a backward move.
    allowedNext: ['draft', 'intake'],
  },
  draft: {
    state: 'draft',
    label: 'Draft',
    description:
      'A first draft of the application, assembled against the form structure for you to review and edit.',
    allowedNext: ['gap_analysis'],
  },
  gap_analysis: {
    state: 'gap_analysis',
    label: 'Gap analysis',
    description:
      'What looks missing or thin, with the relevant TCPS2 guidance. These are observations for you to consider, not decisions.',
    allowedNext: ['complete'],
  },
  complete: {
    state: 'complete',
    label: 'Ready to review',
    description:
      'Your draft package is ready to download, review and submit yourself. Research Ethics Board Assistant does not submit it, and does not decide whether it will be approved.',
    allowedNext: [],
  },
}

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return STATE_DEFINITIONS[from].allowedNext.includes(to)
}

/**
 * Every transition needs an actor. The signature has no default and no optional
 * actor precisely so that an accidental automatic advance does not typecheck.
 */
export interface TransitionRequest {
  projectId: string
  from: ProjectState
  to: ProjectState
  actorId: string
  reason?: string
}

export function assertValidTransition(request: TransitionRequest): void {
  if (!canTransition(request.from, request.to)) {
    throw new Error(
      `Invalid workflow transition: ${request.from} -> ${request.to}. ` +
        `Allowed from ${request.from}: ${STATE_DEFINITIONS[request.from].allowedNext.join(', ') || 'none'}.`,
    )
  }
  if (!request.actorId) {
    throw new Error(
      'A workflow transition requires an actor. Projects never advance without an explicit user action.',
    )
  }
}

export function stateIndex(state: ProjectState): number {
  return PROJECT_STATES.indexOf(state)
}

/**
 * How far along the track to fill, as a percentage.
 *
 * The fill reaches a step's marker when the project has entered that step, not
 * when it has finished it, so a project in `triage` shows an empty track rather
 * than a sixth of one. No project at all is also empty.
 */
export function progressPercent(current?: ProjectState): number {
  if (!current) return 0
  const index = stateIndex(current)
  if (index <= 0) return 0
  return (index / (PROJECT_STATES.length - 1)) * 100
}
