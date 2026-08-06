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
    label: 'Getting Started',
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
    label: 'Method Check',
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
    label: 'Gap Analysis',
    description:
      'What looks missing or thin, with the relevant TCPS2 guidance. These are observations for you to consider, not decisions.',
    allowedNext: ['complete'],
  },
  complete: {
    state: 'complete',
    label: 'Ready to Review',
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
 * Stepping back.
 *
 * `allowedNext` describes the forward path, plus the one backward move that a
 * rejected method check forces. Going back voluntarily is a different thing and
 * is kept separate on purpose, so that a backward move can never be mistaken for
 * a forward one by a caller reading `allowedNext`.
 *
 * Guardrail 3 is about the app never advancing on its own. It has nothing to say
 * against a researcher returning to a step to change an answer, and a workflow
 * that only moves forward is one people work around by starting again. Answers
 * are kept: going back re-opens a step, it does not clear it.
 */
export function previousState(state: ProjectState): ProjectState | null {
  const index = stateIndex(state)
  return index > 0 ? PROJECT_STATES[index - 1] : null
}

export function canGoBack(state: ProjectState): boolean {
  return previousState(state) !== null
}

export function assertValidStepBack(request: TransitionRequest): void {
  const expected = previousState(request.from)

  if (expected === null) {
    throw new Error(`There is no step before ${request.from}.`)
  }
  if (request.to !== expected) {
    throw new Error(
      `A step back from ${request.from} goes to ${expected}, not to ${request.to}. ` +
        'Stepping back moves one step at a time.',
    )
  }
  if (!request.actorId) {
    throw new Error('A workflow transition requires an actor.')
  }
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
