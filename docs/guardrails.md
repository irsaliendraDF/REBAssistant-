# Guardrails

From Section 11 of the signed Phase 1 agreement. These are contractual, not
preferences. Where possible each one is enforced by structure, so that breaking
it requires deliberately dismantling something rather than merely forgetting a
convention.

## 1. Redaction gate before every model call

One chokepoint function that every Anthropic call passes through. If identifiable
participant data is detected it is stripped, or the call is refused. No call
bypasses it.

**Where:** [`lib/anthropic/redaction.ts`](../lib/anthropic/redaction.ts) is the
gate. [`lib/anthropic/client.ts`](../lib/anthropic/client.ts) is the only module
permitted to construct a request, and it runs the gate before anything else,
including before the configuration check, so a missing key can never become a
path that skips redaction. `import 'server-only'` makes an import from client
code a build error rather than a review question.

**Categories that refuse rather than strip:** social insurance numbers, health
card and medical record numbers, dates of birth. Their presence means something
went wrong upstream, and stripping them quietly would hide that.

**Tuned against false positives, on purpose.** A refusal blocks the researcher's
work, and researchers who hit spurious refusals learn to route around the tool,
which is a worse outcome than the one the gate exists to prevent. So an
unlabelled nine-digit group is only read as a social insurance number if it also
passes the Luhn checksum, which real ones do and arbitrary numeric data usually
does not. A labelled one is refused regardless, because the label is the signal.
The street-address detector is case sensitive for the same reason: with the
ignore-case flag it also matched prose like "a 5 minute walk down the street".

**What it does not catch: participant names.** No regular expression can separate
"we interviewed Sarah Chen" from "as Chen (2019) argues" or from "Dalhousie
University". Names are handled by never asking the researcher for them, not by
the gate.

**Audited.** Every pass writes a `redaction_events` row through
[`lib/anthropic/audit.ts`](../lib/anthropic/audit.ts), including refusals, where
nothing was sent. Categories and counts only, never the matched text. The audit
write never throws: a database hiccup must not become a reason the gate did not
run, or a broken feature the researcher works around.

**Tested.** [`lib/anthropic/redaction.test.ts`](../lib/anthropic/redaction.test.ts),
run with `npm test`. Covers detection, the false-positive cases above, the
boundary where a phone number's first nine digits look like a social insurance
number, idempotency, allow-list handling, and refusal propagation across a
multi-string call.

**Do not** add a second module that calls the API.

## 2. No participant data at rest

The schema contains no column for identifiable participant data. Do not add one.
The schema is the enforcement mechanism.

**Where:** all of `supabase/migrations/`. `redaction_events` deliberately stores
categories and counts only, never the matched text, since logging flagged content
would breach this guardrail in the act of enforcing guardrail 1.

## 3. Human gate at every reasoning step

Nothing auto-advances.

**Where:** [`lib/workflow/states.ts`](../lib/workflow/states.ts). Transitions
require an `actorId` with no default and no optional form, so an accidental
automatic advance does not typecheck. `project_state_transitions` records who
caused each move. `method_interpretations` has a `pending` default and a check
constraint requiring a correction whenever a researcher alters or rejects an
interpretation.

## 4. Indigenous and community-engaged research is flagged and routed

Detected during triage, flagged, and routed to a person. Never generated.

**Where:** `projects.involves_indigenous_research` and
`involves_community_engaged_research`.
[`lib/form/dalhousie-sections.ts`](../lib/form/dalhousie-sections.ts) marks
section 2.13 as `routed_to_human` permanently, and `isGenerationBlocked()`
extends the block to the population, recruitment and consent sections once either
flag is set.

## 5. AI involvement stays disclosable

Every draft record stores whether it was AI-generated.

**Where:** `drafts.ai_generated`, `not null` by design, with a check constraint
requiring `model_version` whenever it is true. This is what makes disclosure
surface (c) below writable truthfully rather than approximately.

## 6. The app never makes the ethics determination

All language stays advisory. No "approved", no "exempt".

**Where:** copy throughout, and the `gap_severity` enum, which is deliberately
descriptive (`missing`, `thin`, `worth_reviewing`) rather than judgemental.

## 7. Automated, logged consent wherever information is collected or reused

A whole-tool rule, not one feature. Wherever the app stores or reuses a person's
information there is an explicit consent step and a record that it happened.

**Where:** `consent_events`, append only. Insert and select policies are granted;
update and delete are not. The clearest case is tombstone reuse: when a saved
profile is pulled into a new project, the researcher sees what is being carried
over and confirms it, once per project. A unique index enforces the once-per-
project shape.

## 8. AI-use disclosure on three surfaces

The honesty chain runs the length of the project:

- **(a)** The app's own terms. The researcher consents to how the tool uses their
  inputs.
- **(b)** Generated participant consent forms. Participants are told an
  AI-assisted system handles their data.
- **(c)** The Research Ethics Board application itself. The Board is told it was prepared with AI
  assistance.

**Status:** not written yet, scheduled for week 3. Wording will be clearly marked
as placeholder for Shakara to refine, since she knows what a Board expects to
see. Surface (c) is writable truthfully because of guardrail 5.
