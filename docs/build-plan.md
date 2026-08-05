# REB Assistant: Build Plan for Claude Code

**Project:** REB Assistant
**Client:** Future Civics
**Phase 1 handoff:** September 1, 2026. Internal test build due August 10, 2026.
**Prepared by:** Irene Saliendra, DigitalFlow Consulting Inc.

---

## 1. How to use this document

Section 11 is a kickoff prompt to paste into Claude Code. Everything above it is the reasoning behind that prompt, for you rather than for the tool. Read Section 9 before you start, since it lists the assumptions baked into this plan.

---

## 1a. Documents received (as of the last update)

Shakara has delivered the starter document set to the REB Drive folder. These are the ingestion inputs and, in one case, the structural spine of the whole build.

**The structural anchor.** `application-human-ethics-prospective-research.docx` is the actual Dalhousie REB application form for prospective research. It has a fixed shape: Section 1 (administrative, team, funding, attestations) and Section 2 (2.1 through 2.15: lay summary, research question, study population, recruitment, consent process, methods, privacy and confidentiality, retention, risk and benefit, dissemination, team, conflict of interest, Indigenous research, clinical trials, personal health information). It carries word limits (the lay summary is capped at 500 words) and cites specific TCPS2 articles throughout. This form is the target output structure and the workflow's backbone. Build the schema and the draft assembly against these exact section numbers.

**Consent and recruitment templates** (these become the app's own generation templates, since the tool drafts these documents):
- `consent-form-template-online-survey.pdf`
- `consent-form-prospective-research-data-collection.pdf`
- `consent-form-secondary-personal-records.pdf`
- `consent-form-secondary-research-existing-records.pdf`
- `consent-form-data-sharing-repository-future-research.pdf`
- `confidentiality-agreement-template.pdf` (for hired transcriptionists, per form 2.6.3)
- `hints-for-research-recruitment-messages.pdf`

**Guidance for the knowledge base:**
- `reb-application-guidelines-for-prospective-research.pdf`

**Real test material** (a live application to build and break against, not a template):
- `Draft Research Proposal: Community Retrofit Readiness and Derisking Framework`
- `Future Civics - Braindump - REB CHAT` (KJ's research content, the subject of the live application)

Note: several files have `-2` duplicates. De-duplicate on ingestion by content hash, not filename.

---

## 2. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript | Native fit for Vercel, server actions keep API keys off the client |
| Hosting | Vercel | Already in use |
| Database, auth, storage | Supabase | See Section 3 |
| Vector search | pgvector inside Supabase Postgres | Avoids a second vendor for embeddings |
| Reasoning | Anthropic API, server side only | Never called from the browser |
| Styling | Tailwind | Fast, and the UI is forms and review screens, not a design showcase |
| Source of record | GitHub repo | Becomes the handover artifact |

## 3. Why Supabase is needed

You asked whether it is required. It is, for four separate reasons, any one of which would be enough.

1. **Tombstone reuse.** The deck promises the app captures researcher details once and reuses them on the next project. Cross-session, cross-project reuse is persistent storage by definition.
2. **Sign-in.** Slide 4 promises one sign-in. Authentication needs a user store.
3. **Work in progress.** Nobody completes an REB application in one sitting. Without saved drafts, a closed tab loses everything.
4. **Knowledge base retrieval.** TCPS2 is far too large to put in a prompt. It needs chunking, embedding and vector search. pgvector runs inside the same Postgres instance.

**Provision the project in a Canadian region.** Supabase sets region at project creation and it cannot be changed afterwards without a migration. Section 11 of the signed agreement commits to Canadian-resident hosting, so this is the single most consequential click in the whole setup. Get it wrong and it is a rebuild, not a settings change.

When you request the Supabase setup email, ask for:
- A project provisioned in a Canadian region
- The project URL and anon key
- The service role key, which stays server side and never enters the repo
- Confirmation of which region was actually selected

## 4. Repo structure

```
reb-assistant/
  app/                    Next.js App Router
    (auth)/               sign in, callback
    dashboard/            project list
    project/[id]/         the guided workflow
    api/                  server routes
  lib/
    anthropic/            prompt construction, redaction gate
    supabase/             client and server helpers
    kb/                   ingestion, chunking, retrieval
  supabase/
    migrations/           SQL schema, version controlled
  knowledge-base/
    source/               dropped source documents, gitignored
    manifest.json         what has been ingested, and when
  docs/
    agreement.pdf         signed Phase 1 agreement
    build-plan.pdf        Appendix A
    handover.md           written last, for the client
  .env.local.example      documents required keys, holds no values
```

## 5. Data model

Minimum viable schema. Names are suggestions, structure is the point.

- **`profiles`** Tombstone data that persists across projects. Name, role, department, institution, CORE certificate status. One row per user. This table is what makes the reuse promise true.
- **`projects`** One research project. Title, plain-language description, status, timestamps.
- **`intake_answers`** Per-project responses to the intake questions.
- **`method_interpretations`** The verification loop. Stores the app's plain-language reading of the methodology, and the researcher's response: confirmed, altered, or rejected, plus their correction. This table is the audit trail proving a human reviewed every reasoning step.
- **`drafts`** Generated sections, versioned, each flagged with whether it was AI-drafted. Supports the disclosure requirement.
- **`gap_findings`** What is missing or thin, tied to TCPS2 principles.
- **`kb_documents`** and **`kb_chunks`** Source documents and their embedded chunks. Chunks carry a citation back to the source so the app can say where guidance came from.

**Deliberately absent: any column for identifiable participant data.** Do not add one. The schema itself is the enforcement.

## 6. Workflow states

The app is a state machine. A project moves forward only when the researcher explicitly advances it.

```
triage -> intake -> method_check -> draft -> gap_analysis -> complete
```

Each transition needs a user action. Nothing auto-advances. `method_check` is the load-bearing gate: the app states its interpretation, the researcher confirms, alters or rejects, and rejection sends it back rather than through.

## 7. Guardrails, as build requirements

These come from Section 11 of the signed agreement. They are contractual, not preferences.

1. **Redaction gate before every model call.** One chokepoint function that every Anthropic call passes through. If identifiable participant data is detected, it is stripped or the call is refused. No call bypasses it.
2. **No participant data at rest.** Enforced by the schema, as above.
3. **Human gate at every reasoning step.** The state machine enforces this. No silent advancement.
4. **Indigenous and community-engaged research is flagged and routed, never generated.** Detect it during triage, set a flag, and block draft generation for those sections with a message directing the researcher to a person.
5. **AI involvement stays disclosable.** Every draft row records whether it was AI-generated, so the final package can disclose it accurately.
6. **The app never makes the ethics determination.** Language throughout stays advisory. No "your application is approved" or "this is exempt". It surfaces and suggests, the REB decides.
7. **Automated, logged consent wherever information is collected or reused.** This is a whole-tool principle, not a Woveo-specific one. Anywhere the app stores or reuses a person's information, there is an explicit consent step with a record that it happened. The clearest case is tombstone reuse: when the app pulls a saved profile into a new project, the researcher actively confirms the reuse and the confirmation is logged. See Section 9 assumption 6 for the interaction default.
8. **AI-use disclosure on three surfaces.** The tool must produce plain-language AI-disclosure text in three places, because the honesty chain runs the length of the project: (a) the researcher consents to how the tool uses their inputs, in the app's own terms; (b) generated participant consent forms tell participants their data is handled by an AI-assisted system; (c) the REB application itself discloses to the Board that it was prepared with AI assistance. The draft table already records which sections were AI-generated, so surface (c) can be written truthfully. Treat the wording as placeholder for Shakara to refine, since she knows what a Board expects to see.

## 8. Build sequence

Tight, given August 10. Ordered so the highest-risk work happens first. You have chosen to wire the hosted accounts (Supabase, Anthropic, Vercel) later, so the early work runs locally and swaps to hosted services at a defined point rather than depending on them from day one.

**Week 1, to July 31.** Scaffold against a local Postgres with pgvector (Docker), write the schema as migrations, build the workflow shell and auth locally. Goal: the app runs end to end on your machine with local data. No hosted accounts needed yet. Because Supabase is Postgres, these same migrations apply unchanged when you provision it, so nothing here is throwaway.

**Week 2, August 1 to 7.** Knowledge base ingestion and retrieval working against the real Dalhousie form, templates and TCPS2 material, still local. Intake flow writing to the database. Tombstone reuse proven with a second project. Draft assembly producing a .docx in the Dalhousie form structure.

**Week 3, August 8 to 10.** Method verification loop, gap analysis, the three AI-disclosure surfaces. Then the switch to hosted: provision Supabase in the correct Canadian region, apply the migrations, add the Anthropic key, deploy to Vercel. Rough edges are fine. It needs to run end to end for the internal test, not be finished.

**August 11 to 24.** Feedback from Shakara and KJ, applied.

**August 25 to September 1.** Hardening, handover documentation, and the repo and Vercel transfer to Future Civics.

Two risk notes. Ingestion in week 2 is demanding but no longer blocked, since the documents have arrived. The hosted switch in week 3 carries the one irreversible step, the Supabase region, so confirm the residency question in Section 10 before you click create.

## 9. Assumptions baked into this plan

Correct any that are wrong before you start.

1. **Auth is email magic link, not Dalhousie SSO.** Institutional SSO needs Dal IT involvement and a formal integration request, which will not happen by September 1.
2. **Documents get dropped into the repo folder manually, not pulled from Drive by API.** Drive stays the human source of truth. Building a Drive OAuth integration to fetch five documents is not worth the week it would cost.
3. **Output is a Word document matching the Dalhousie form layout.** The received form (Section 1a) fixes this. The app fills the form's own Section 1 and Section 2.1 through 2.15 structure and exports a .docx the researcher can review, complete and submit themselves. Not a direct submission into Dalhousie's system, which the agreement puts out of scope.
4. **Single institution, Dalhousie only.** Schema should carry an institution field so Phase 3 is not a rewrite, but only one value is populated.
5. **A handful of test users on August 10, not a public launch.**
6. **Tombstone reuse consent is an active confirmation on first reuse into a new project, logged once per project.** Not a click on every screen, and not a silent one-time consent at save. When a saved profile is pulled into a new project, the researcher sees what is being carried over and confirms it, and that confirmation is recorded against the project. This satisfies the Section 7 consent guardrail with minimal friction. Change it if you want reuse consent handled differently.

## 10. Open questions

Ordered by how much they change the build.

1. **Is Canadian data residency absolute, or is it about participant data specifically?** It is written as a flat commitment. If it is absolute, Vercel function regions need checking too, not just Supabase, and it decides which Canadian region you pick when you do provision Supabase. Note that Anthropic API calls leave Canada regardless, which is exactly why the redaction gate exists. Interestingly, form section 2.7.5 asks researchers this exact question about their own data, so the tool will need to reason about it anyway. This is the one genuinely open design question left. It does not block the scaffold, but settle it before the Supabase project is created, since region is permanent.

**Decided:**
- Name is **REB Assistant**. Repo, package and deployment all use it.
- GitHub repo and Vercel project stay under your personal accounts for now, transferring to Future Civics later per Section 12. Build accordingly and keep the transfer clean.
- Supabase, the Anthropic API key, and Vercel deployment are wired up later, not at the start. See the revised build sequence in Section 8.

**Resolved earlier:**
- Output format is the Dalhousie .docx form (Section 1a).
- Woveo is a separate case study, not part of this build. For the MVP they are only a source of test data.
- The starter document set has arrived, so week 2 ingestion is no longer blocked on missing inputs.

## 11. Kickoff prompt for Claude Code

Paste the block below. Fill in the bracketed values first.

---

I am starting a new project. Before writing any code, read this whole brief, then confirm your understanding and your proposed first steps before you begin.

**Set up the working folder first.** Create a folder at `~/Desktop/reb-assistant`. This folder is the eventual handover artifact for the client, so treat it as the single source of truth for the project. Initialise a git repository in it. Everything lives here: application code, database migrations, documentation and the signed agreement. The product is called **REB Assistant**; use that name in the repo, the package and the UI.

**What we are building.** A web application that helps researchers at Dalhousie University prepare Research Ethics Board applications. The researcher signs in, works through a guided sequence, and comes out with a completed first draft plus an analysis of what is still missing. This is Phase 1, the minimum viable product. It is deliberately narrow: Dalhousie only, academic researchers only, REB applications only.

**Stack.** Next.js with the App Router and TypeScript, deployed to Vercel later. Postgres with the pgvector extension for data, authentication, file storage and embeddings, run locally at first and moved to hosted Supabase later in the build. Tailwind for styling. The Anthropic API for reasoning, called only from the server and never from the browser, added later. Write everything so the move from local to hosted is a configuration change, not a rewrite.

**The workflow is a state machine:** `triage -> intake -> method_check -> draft -> gap_analysis -> complete`. Each transition requires an explicit user action. Nothing advances automatically. In `method_check`, the app states its plain-language interpretation of the researcher's methodology and the researcher confirms, alters or rejects it. Rejection sends the flow backwards, not forwards.

**Schema.** `profiles` holds researcher tombstone data that persists and is reused across projects. `projects`, `intake_answers`, `method_interpretations`, `drafts`, `gap_findings`, `kb_documents`, `kb_chunks`. Write these as version-controlled SQL migrations under `supabase/migrations`.

**Non-negotiable guardrails, from a signed client agreement:**

1. Every call to the Anthropic API passes through a single redaction function. If identifiable participant data is present it is stripped, or the call is refused. No code path may bypass this.
2. The schema must contain no column for identifiable participant data. Do not add one.
3. A human review gate exists at every reasoning step. Nothing auto-advances.
4. Indigenous and community-engaged research is detected during triage, flagged, and routed to a human. The app must never auto-generate those sections.
5. Every draft record stores whether it was AI-generated, so AI involvement remains disclosable.
6. The app never makes an ethics determination. All language stays advisory. The Research Ethics Board decides, not the tool.
7. Wherever the app stores or reuses a person's information, there is an explicit, logged consent step. In particular, when a saved researcher profile is reused in a new project, the researcher confirms the reuse and it is recorded. This is a whole-tool rule, not one feature.
8. The app produces plain-language AI-use disclosure in three places: the app's own terms (the researcher consents to how their inputs are used), the participant consent forms it generates (participants are told an AI-assisted system handles their data), and the REB application itself (the Board is told it was AI-assisted). Use clearly-marked placeholder wording; it will be reviewed by a domain expert.

**Output structure.** The target output is a Word document that mirrors the Dalhousie REB application form for prospective research: Section 1 (administrative and team information) and Section 2, subsections 2.1 through 2.15. I will place the real form and its templates in the source folder. Build the schema fields and the draft assembly to map onto those exact section numbers, and respect the form's word limits, for example the 500-word cap on the lay summary in 2.1.1.

**Knowledge base.** Source documents are the Dalhousie REB form, its consent and recruitment templates, application guidelines, and TCPS2 material. They go in `knowledge-base/source/`, which is gitignored. Build an ingestion script that chunks, embeds and stores them with citations back to the source document, and de-duplicates by content hash since some files arrive in duplicate. I do not have every document yet, so make ingestion re-runnable and incremental. Write a `manifest.json` recording what has been ingested and when.

**Environment.** Create `.env.local.example` documenting every required key with no real values in it. The hosted accounts (Supabase, Anthropic API, Vercel) are being connected later in the build, not now, so nothing you do at the start should require their credentials. When Supabase does arrive, its service role key is server side only and must never be committed or exposed to the client.

**Stand up the database locally for now.** Use a local Postgres with the pgvector extension (Docker is fine) so the app runs end to end on my machine without any hosted account. Write the schema as Supabase-style SQL migrations under `supabase/migrations` so the exact same migrations apply later when I provision the hosted Supabase project. Do not create or connect a hosted Supabase project yet, and do not deploy to Vercel yet. I will tell you when.

**Start with this and nothing more:** the project scaffold, a local Postgres with pgvector running via Docker, the schema migrations, the local database client setup, and a runnable dev server. The target for step one is an application that runs locally, connects to the local database, and shows an empty dashboard behind a placeholder auth boundary. Do not build the workflow screens yet, and do not wire up any hosted service.

Ask me before installing any dependency that is not obviously required, and before making an architectural decision this brief does not cover.

---

## 12. Before you paste it

Nothing blocks the start any more. The decisions are made and the early build runs locally.

- [x] Name decided: REB Assistant
- [x] Ownership decided: your accounts now, transfer to Future Civics later
- [x] Documents received and ready for `knowledge-base/source/`
- [ ] Docker available locally, for the Postgres and pgvector container
- [ ] The `~/Desktop/reb-assistant` path is right for your machine, adjust if not

Deferred until the week 3 hosted switch, not needed to begin:
- [ ] Supabase project in the correct Canadian region (confirm the residency question in Section 10 first, since region is permanent)
- [ ] Anthropic API key
- [ ] Vercel deployment

You are clear to paste the Section 11 prompt into Claude Code now.
