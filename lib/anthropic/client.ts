import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

import { NotConfiguredError, env, isAnthropicConfigured } from '@/lib/env'
import { logRedactionEvent } from './audit'
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
 * Only the redacted copies are sent. The original strings never leave this
 * process, which is the whole point of the gate running first.
 */

/** Reused across requests so connection pooling and retries work as designed. */
let cached: Anthropic | null = null

function anthropic(): Anthropic {
  if (!isAnthropicConfigured) {
    throw new NotConfiguredError('The Anthropic API', ['ANTHROPIC_API_KEY'])
  }
  cached ??= new Anthropic({ apiKey: env.anthropic.apiKey })
  return cached
}

export type ModelEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ModelCallInput {
  /** What this call is for, recorded in the redaction audit, e.g. 'draft:2.4'. */
  purpose: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  /**
   * Reasoning depth. Drafting a Research Ethics Board section is
   * intelligence-sensitive, so the default is high rather than the API's own.
   */
  effort?: ModelEffort
  /** JSON Schema. When set, the reply is constrained to match it. */
  jsonSchema?: Record<string, unknown>
  /** Known-legitimate strings that should survive the gate, e.g. the researcher's own email. */
  allow?: string[]
  /** Recorded against the audit event so a refusal can be traced to a project. */
  projectId?: string
  userId?: string
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
  | {
      ok: false
      reason: 'declined_by_model'
      message: string
      /** The policy category, where the API supplies one. */
      category: string | null
    }

export async function callModel(input: ModelCallInput): Promise<ModelCallResult> {
  // The gate runs first, before any configuration check, so that a missing API
  // key can never become a route that skips redaction.
  const gate = redactAll(
    [input.system, ...input.messages.map((message) => message.content)],
    { allow: input.allow },
  )

  // Audited before the call is attempted, so a refusal is recorded even though
  // nothing was ever sent. Awaited but non-throwing: see lib/anthropic/audit.ts.
  await logRedactionEvent({
    callPurpose: input.purpose,
    outcome: gate.outcome,
    hits: gate.hits,
    projectId: input.projectId,
    userId: input.userId,
    modelVersion: env.anthropic.model,
  })

  if (gate.outcome === 'refused') {
    return {
      ok: false,
      reason: 'refused_by_redaction_gate',
      message: gate.refusalReason ?? 'This request was not sent.',
      redaction: { outcome: 'refused', hits: gate.hits },
    }
  }

  const [system, ...contents] = gate.texts

  const response = await anthropic().beta.messages.create({
    model: env.anthropic.model,
    max_tokens: input.maxTokens ?? 8000,
    // Thinking is on by default on this model. Left unset deliberately rather
    // than disabled: disabling it is capped at `high` effort and, on drafting
    // work, produces worse text for no saving worth having here.
    output_config: {
      effort: input.effort ?? 'high',
      ...(input.jsonSchema
        ? { format: { type: 'json_schema' as const, schema: input.jsonSchema } }
        : {}),
    },
    // Safety classifiers can decline a request. Research ethics applications
    // discuss risk, harm and vulnerable participants in ways that sit close to
    // the boundary, so a decline is a realistic outcome for legitimate work.
    // Rather than surface that to a researcher as a dead end, the request is
    // re-served by the recommended fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: input.messages.map((message, index) => ({
      role: message.role,
      content: contents[index],
    })),
  })

  // Checked before reading content. On a decline `content` is empty or partial,
  // and indexing into it would throw or return a truncated draft as if it were
  // finished.
  if (response.stop_reason === 'refusal') {
    return {
      ok: false,
      reason: 'declined_by_model',
      category: response.stop_details?.category ?? null,
      message:
        'The AI model declined to draft this section. That can happen with legitimate research that discusses risk or harm to participants. ' +
        'Please write this section yourself, or rephrase the underlying answers and try again.',
    }
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  return {
    ok: true,
    text,
    // The model that actually produced the text, which is not necessarily the
    // one requested once fallbacks are in play. Recorded on the draft, so the
    // disclosure to the Board names the right model.
    modelVersion: response.model,
    redaction: { outcome: gate.outcome, hits: gate.hits },
  }
}

export { env as anthropicEnv }
