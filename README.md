# Research Ethics Board Assistant

A web application that helps researchers at Dalhousie University prepare Research
Ethics Board applications. The researcher signs in, works through a guided
sequence, and comes out with a completed first draft plus an analysis of what is
still missing.

**Phase 1, minimum viable product.** Deliberately narrow: Dalhousie only,
academic researchers only, Research Ethics Board applications only.

**Research Ethics Board Assistant does not make ethics determinations.** It drafts and it flags
gaps. The Research Ethics Board decides.

Client: Future Civics. Built by DigitalFlow Consulting Inc.
Internal test build: August 10, 2026. Phase 1 handoff: September 1, 2026.

---

## Where things are

```
app/                  Next.js App Router
  (auth)/             sign in, magic link callback, session actions
  dashboard/          project list, behind the auth boundary
  project/[id]/       the guided workflow
components/           shared UI: app shell, progress track, question fields
lib/
  data/               the store interface, in-memory and Supabase implementations
  intake/             the question set, keyed to form sections
  anthropic/          redaction gate and the single model-call chokepoint
  auth/               session handling
  form/               the Dalhousie form structure, section numbers and word limits
  kb/                 knowledge base ingestion, chunking, retrieval
  supabase/           browser, server and service-role clients
  workflow/           the state machine
supabase/migrations/  schema, version controlled, plain SQL
knowledge-base/
  source/             source documents, gitignored
  manifest.json       what has been ingested, and when
docs/                 agreement, build plan, guardrails, handover
```

## Running it

```bash
npm run dev
```

Then open http://localhost:3000. You land straight on the dashboard, because the
build is currently in review mode.

### Review mode

Sign-in is skipped entirely, so the work in progress can be looked at without an
account. Every screen says so. This is safe only while there is nothing behind
the wall: no database, no stored answers, no participant data, an empty
dashboard.

**Turn it off the same day the hosted Supabase project is connected**, by setting
`NEXT_PUBLIC_REVIEW_MODE=false`. It is the one thing standing between an open URL
and real researcher data.

Nothing else is required right now. There is no database connected, no Anthropic
key and no hosted account, and the app is written to say so plainly rather than
fail. Copy `.env.local.example` to `.env.local` when those arrive.

Tests:

```bash
npm test
```

## Current state

Built:

- Project scaffold, Next.js App Router with TypeScript and Tailwind
- Full schema as version-controlled SQL migrations, including row level security
- The redaction gate, the single chokepoint every model call must pass through,
  its `redaction_events` audit trail, and 61 tests covering both misses and
  false positives
- The workflow state machine, with transitions that cannot fire without an actor
- The Dalhousie form structure, section numbers and word limits, in one file
- Knowledge base ingestion scan, hashing, content-hash de-duplication, chunking
  and the manifest
- Placeholder auth boundary and an empty dashboard

- Triage and intake: the guided question sequence, section by section, with the
  Indigenous and community-engaged flags routing the affected sections to a
  person

- Draft assembly and `.docx` export in the form structure, with AI-use
  disclosure generated from what was actually drafted

Not built yet, in build-sequence order:

- The remaining workflow screens: method check, draft, gap analysis
- Model-drafted prose for the `awaiting_drafting` sections, which needs the
  Anthropic key
- Text extraction for PDF and DOCX, and embedding generation
- Draft assembly and .docx export in the Dalhousie form layout
- The three AI-disclosure surfaces
- Hosted Supabase, the Anthropic key, and the Vercel deployment

## Guardrails

Eight of them, from Section 11 of the signed agreement. They are contractual, not
preferences, and several are enforced by structure rather than by convention. See
[docs/guardrails.md](docs/guardrails.md) for each one and where it lives in the
code.

The two most load-bearing:

- **No column anywhere holds identifiable participant data.** The schema is the
  enforcement.
- **Every model call passes through `lib/anthropic/redaction.ts`.**
  `lib/anthropic/client.ts` is the only module permitted to call the API, and it
  runs the gate first. Do not add a second caller.
