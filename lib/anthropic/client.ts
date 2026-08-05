import 'server-only'

import { NotConfiguredError, env, isAnthropicConfigured } from '@/lib/env'
import { type RedactionHit, redactAll } from './redaction'

/**
 * The single chokepoint for model calls.
 *
 * Guardrail 1: no code path may reach the Anthropic API without passing through
 * the redaction gate. This module is the only place in the codebase permitted to
 * construct an Anthropic request, and `callModel` runs `redactAll` before it does
 * anything else. Do not add a second caller. If a new feature needs the model,
 * it calls this function.
 *
 * `import 'server-only'` makes the boundary a build error rather than a code
 * review question: importing this from a client component fails the build, so
 * the API key cannot reach the browser.
 *
 * The Anthropic SDK is intentionally not installed yet. The key arrives in week
 * three, and until then this function refuses cleanly rather than pretending.
 */

export interface ModelCallInput {
  /** What this call is for, recorded in the redaction audit, e.g. 'draft:2.4'. */
  purpose: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  /** Known-legitimate strings that should survive the gate, e.g. the researcher's own email. */
  allow?: string[]
}

export type ModelCallResult =
  | {
      ok: true
      text: string
      modelVersion: string
      redaction: { outcome: 'clean' | 'redacted'; hits: RedactionHit[] }
    }
  | {
      ok: false
      reason: 'refused_by_redaction_gate'
      /** Plain-language message, safe to show the researcher. */
      message: string
      redaction: { outcome: 'refused'; hits: RedactionHit[] }
    }

export async function callModel(input: ModelCallInput): Promise<ModelCallResult> {
  // The gate runs first, before any configuration check, so that a missing API
  // key can never become a route that skips redaction.
  const gate = redactAll(
    [input.system, ...input.messages.map((message) => message.content)],
    { allow: input.allow },
  )

  if (gate.outcome === 'refused') {
    return {
      ok: false,
      reason: 'refused_by_redaction_gate',
      message: gate.refusalReason ?? 'This request was not sent.',
      redaction: { outcome: 'refused', hits: gate.hits },
    }
  }

  if (!isAnthropicConfigured) {
    throw new NotConfiguredError('The Anthropic API', ['ANTHROPIC_API_KEY'])
  }

  // TODO (week 3, hosted switch): install @anthropic-ai/sdk and issue the request
  // here using `gate.texts`, never `input`. The redacted copies are the only
  // strings that may leave this process.
  throw new NotConfiguredError('The Anthropic API client', ['ANTHROPIC_API_KEY'])
}

export { env as anthropicEnv }
