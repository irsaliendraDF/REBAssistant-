# Migrations

Applied in filename order. They are plain SQL so the same files run against a
local Postgres today and against hosted Supabase later, unchanged.

## Two groups

**`202608050001*` to `202608050009*` — portable.** Plain Postgres plus the
`vector` and `pgcrypto` extensions. Nothing here depends on Supabase.

**`202608050010*` and above — Supabase only.** These reference the `auth` schema
(`auth.users`, `auth.uid()`), which only exists once Supabase is provisioned or
the Supabase CLI local stack is running. Applying them to a bare Postgres will
fail, and that is intentional rather than a bug: the core schema stays portable
and the Supabase-specific wiring is quarantined in its own files.

## Rules that are not negotiable

These come from Section 11 of the signed client agreement. Do not relax them in a
later migration without checking the agreement first.

1. **No column anywhere holds identifiable participant data.** The schema is the
   enforcement mechanism, not a convention. If a future feature seems to need
   such a column, that feature is out of scope.
2. **`drafts.ai_generated` is `not null`.** Every draft record states whether a
   model wrote it, so AI involvement stays disclosable.
3. **`consent_events` is append only.** No update or delete policy is granted.
   A consent record that can be edited is not a consent record.
4. **Workflow state never advances without a user action.** The
   `project_state` enum and the `method_interpretations` audit trail exist to
   prove a human reviewed each reasoning step.
