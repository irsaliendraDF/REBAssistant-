import 'server-only'

import { isSupabaseAdminConfigured } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

import type { RedactionHit, RedactionOutcome } from './redaction'

/**
 * The redaction audit trail.
 *
 * Guardrail 1 says the gate runs on every call. This is how that claim becomes
 * checkable after the fact rather than merely asserted: every pass through the
 * gate writes a row saying what it did.
 *
 * Two rules shape this file.
 *
 * **It records categories and counts, never the matched text.** Writing flagged
 * content into the database to prove we caught it would breach guardrail 2 in
 * the act of enforcing guardrail 1.
 *
 * **It never throws.** A failed audit write must not become a reason the gate
 * did not run, and must not surface to the researcher as a broken feature. It
 * logs to the server console and returns. The alternative, where a database
 * hiccup blocks drafting, would push people toward working outside the tool.
 *
 * Writes go through the service role client, because the audit record must not
 * depend on the signed-in user's permissions.
 */

export interface RedactionEvent {
  /** What the call was for, e.g. 'method_interpretation' or 'draft:2.4'. */
  callPurpose: string
  outcome: RedactionOutcome
  hits: RedactionHit[]
  projectId?: string
  userId?: string
  modelVersion?: string
}

export async function logRedactionEvent(event: RedactionEvent): Promise<void> {
  if (!isSupabaseAdminConfigured) {
    // Expected during the local phase, before the hosted project exists. Say so
    // once per call rather than silently dropping the record, so the gap is
    // visible in the dev server output.
    console.info(
      `[redaction] ${event.outcome} for ${event.callPurpose} ` +
        `(${describeHits(event.hits)}). Not recorded: Supabase is not configured yet.`,
    )
    return
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('redaction_events').insert({
      project_id: event.projectId ?? null,
      user_id: event.userId ?? null,
      call_purpose: event.callPurpose,
      outcome: event.outcome,
      detector_hits: event.hits,
      model_version: event.modelVersion ?? null,
    })

    if (error) {
      console.error(`[redaction] Failed to record audit event: ${error.message}`)
    }
  } catch (cause) {
    console.error('[redaction] Failed to record audit event', cause)
  }
}

function describeHits(hits: RedactionHit[]): string {
  if (hits.length === 0) return 'no detections'
  return hits.map((hit) => `${hit.category} x${hit.count}`).join(', ')
}
