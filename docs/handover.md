# Research Ethics Board Assistant — Handover

**For:** Future Civics
**Built by:** DigitalFlow Consulting
**Status at this document:** internal test build, 6 August 2026
**Live:** https://reb-assistant.vercel.app

This document is written for someone who has never seen this project and has to
take it over. It says what the tool does, how it is built, why the harder
decisions went the way they did, what is deliberately unfinished, and what has to
happen to transfer it.

It contains no passwords, keys or recovery codes, on purpose. See
**Accounts and credentials** below for where those live.

---

## 1. What the tool is

A web application that helps researchers at Dalhousie University prepare a
Research Ethics Board application. A researcher signs in, answers questions about
their study, checks that the tool has understood them, and gets a Word document
laid out in the Board's own form structure, which they complete and submit
themselves.

**What it deliberately is not.** It does not review research, does not approve or
exempt anything, does not submit to Dalhousie, and does not decide whether a
study is ethical. Every ethics determination is the Board's. This is not modesty;
it is the central design constraint, and it is enforced in several places in code
rather than requested in a prompt.

---

## 2. The eight guardrails

These come from Section 11 of the signed agreement. They are the reason several
things are built the way they are, so they are listed with where each one
actually lives.

| # | Guardrail | Where it is enforced |
|---|---|---|
| 1 | Redaction gate before every model call | `lib/anthropic/redaction.ts`, applied at the single chokepoint in `lib/anthropic/client.ts` |
| 2 | No participant data at rest | The schema. There is no participant table and no field for a participant's name or contact details, and `lib/data/types.ts` offers no way to add one |
| 3 | A human gate at every reasoning step | `lib/workflow/states.ts`. Nothing auto-advances; saving never advances; every transition is logged with an actor |
| 4 | Indigenous and community-engaged research routed, never generated | `isGenerationBlocked()`, checked in code before a prompt is constructed |
| 5 | AI involvement stays disclosable | `drafts.ai_generated` is `not null`. Drafts are versioned, and a human edit carries the AI provenance forward |
| 6 | The app never makes the ethics determination | The drafting and method-check system prompts, plus the absence of any code path that scores or approves |
| 7 | Automated, logged consent wherever information is collected or reused | `consent_events`, append-only. Three consent kinds, each recording the exact wording shown |
| 8 | AI-use disclosure on three surfaces | App terms gate, participant consent wording, and the disclosure inside the application itself |

**Guardrail 1 is worth understanding properly.** Some categories are redacted
before sending (email addresses, phone numbers, postal codes, street addresses).
Others cause the request to be **refused outright** rather than cleaned: Social
Insurance Numbers, health card numbers, dates of birth. The researcher is told
what to remove. Nothing is sent.

**Guardrail 5 is why drafts are versioned rather than overwritten.** If an edit
replaced the row, a researcher rewriting an AI-drafted section would erase the
record that a model wrote it, and the disclosure to the Board would quietly
become false. Editing carries `ai_generated` and `model_version` forward and sets
`edited_by_human`.

**Guardrail 8's third surface is generated from fact, not template.** The
disclosure in the exported document lists the sections a model actually drafted,
read from the database. It cannot drift from the truth, which is the entire point
of it.

---

## 3. How a researcher moves through it

```
triage → intake → method check → draft → gap analysis → complete
```

- **Triage** establishes the shape of the study and sets the routing flags. On
  the Indigenous and community-engaged questions, *"I am not sure" counts as
  yes*. Being wrongly routed to a person costs a conversation; not being routed
  costs considerably more.
- **Intake** asks the substantive questions. Every question declares which form
  section it feeds, which is how answers reach the right place in the document.
- **Method check** states back what the tool understood the methodology to be, in
  a form the researcher can disagree with. Confirm, alter, or reject. A rejection
  sends the project back to intake.
- **Draft** produces the application section by section. Drafting is a button per
  section, never one button that writes everything.
- **Gap analysis** reports what is missing or thin, citing TCPS 2 at chapter
  level only.
- **Complete** offers the Word document.

Nothing in this sequence moves on its own. That is guardrail 3, and it is the
reason there is no "generate my application" button anywhere in the product.

---

## 4. The stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database, auth | Supabase (Postgres + pgvector), region `ca-central-1` |
| Model | Anthropic, `claude-opus-5` |
| Export | `docx` |
| Hosting | Vercel |
| Tests | Vitest, 245 passing |

**The data layer is behind an interface.** Everything above it talks to a
`DataStore` (`lib/data/types.ts`), never to Supabase directly. There are two
implementations: an in-memory one used when no database is configured, and the
Supabase one. This was built when there was no database at all, and it is why
connecting the hosted project was a credentials change rather than a rewrite.
Keep it. It is also what makes the ownership rules testable, because both
implementations are held to the same behaviour.

---

## 5. The knowledge base, and why it has no vector search

The application ships with Dalhousie's form, its application guidelines, its
consent and confidentiality templates, and recruitment guidance. Eleven documents,
about 34,000 words.

The obvious design is similarity search: turn text into numbers, find the
passages closest to what the researcher wrote. That was scaffolded and then
**deliberately not built**.

The guidelines document is written against the form's own numbering. Section 2.4
is Recruitment, and 2.4.1 to 2.4.5 underneath it say what a Board expects that
section to cover. So the relationship between "the section being drafted" and
"the guidance that applies" is not something to infer from a similarity score. It
is the section number, printed in the document.

That matters beyond simplicity. A research ethics expert can read a table of
which guidance each section receives, and correct it. Nobody can audit a
similarity score. For a tool whose whole design is that a human can see and
correct what it did, the table is the right answer.

**What this costs.** A researcher writes something unusual and the relevant
guidance sits somewhere a fixed mapping would not predict. Similarity search
would find it. This will not. If test users hit that, it is the thing to revisit,
and `docs/decisions.md` records exactly what to look at: the migration already
creates the vector column, `match_kb_chunks` already works, and only
`lib/kb/ingest.ts` would need an embedding step. No data would be lost, because
none was ever written.

**Ingestion is a local script, not something the app does.** `npm run ingest`,
run from a maintainer's machine when the guidance changes. `npm run ingest:plan`
shows what it would do without touching anything. It needs the Supabase service
role key, which is the only job in the project that does.

---

## 6. What is deliberately unfinished

Being explicit about this is the point of the section. None of it is an oversight.

**The disclosure wording is placeholder text.** Every string in
`lib/disclosure/text.ts` is a first draft awaiting review by a research ethics
expert. The *mechanism* is real and tested; the words are not final. They are
marked as placeholders in the product itself.

**The intake question set is a first draft.** Wording, ordering, and what is
required versus optional are all open. It is one file
(`lib/intake/questions.ts`), so revisions are cheap to apply.

**The drafting system prompt needs expert review.** It is what enforces guardrail
6, which code cannot enforce. It should be read by someone who knows what a Board
will not tolerate.

**Gap analysis is rule-based, not model-reasoned.** It catches contradictions and
omissions by rule. A model pass would catch more. The method check was upgraded
from rules to model reasoning; gap analysis has not been.

**Email is on a Gmail account, not a domain.** Fine for a test group, wrong for a
cohort: it caps around 500 messages a day. When it moves, use a **Future Civics**
domain with SPF and DKIM records, not a DigitalFlow one. See
`supabase/templates/README.md`.

**Canadian residency is scoped to participant data, not to every byte.** This was
settled by the client. The visible consequence is that there is no `vercel.json`
pinning functions to a Canadian region, so the app runs in Vercel's default
region while the database is in Montreal. The commitment still holds because
there is no participant data anywhere in the system. **If a later phase ever
stores anything about a participant, this decision has to be reopened before that
happens, not after.**

---

## 7. Accounts and credentials

Full detail, including the transfer checklist, is in
`docs/accounts-and-credentials.md` in the repository. Summary:

| Thing | Where | Note |
|---|---|---|
| Mailbox | `researchethicsboardassistant@gmail.com` | Dedicated to this project. Two-step verification on. Every sign-in link comes from here, so whoever controls it controls access to the product |
| Supabase | Project `fzciyxuqzdashapkmcam`, `ca-central-1` | Region is permanent |
| Anon key | Vercel, `.env.local`, every browser | Public by design. Row level security is the protection, not secrecy |
| Service role key | Vercel only | **Bypasses row level security entirely.** Never in the repo, never in chat |
| Anthropic key | Vercel only | Billing follows the key |
| Repository | `irsaliendraDF/REBAssistant-` | Transfers to Future Civics |

**Six things the receiving party must do, in order:**

1. Take ownership of the mailbox, change its password, **regenerate its backup
   codes**, and move two-step verification to their own phone
2. Revoke and reissue the Gmail App Password, update it in Supabase
3. Take ownership of the Supabase organisation, rotate the service role key
4. Issue their own Anthropic key, update Vercel, revoke the old one
5. Accept the GitHub repository transfer
6. Re-link Vercel and verify every environment variable, prefixes included

Step 1 is the one people skip. Until the backup codes are regenerated, the
outgoing party still holds ten working bypasses of two-step verification, no
matter what the password is.

Step 6 has already bitten this project once: the `NEXT_PUBLIC_` prefix is what
makes a value visible to the browser, and omitting it fails silently and totally.

---

## 8. Running it

```
npm install
npm run dev          # http://localhost:3000
npm test             # 245 tests
npm run build
npm run ingest:plan  # what ingestion would do, touches nothing
npm run ingest       # loads the knowledge base, needs the service role key
```

The app runs with no credentials at all. With no database it uses the in-memory
store and says so on screen; with no model key it produces the document structure
from the researcher's own answers and says that too. Nothing fails obscurely
because something is missing.

Environment variables are documented in `.env.local.example`.

---

## 9. Where the reasoning is written down

`docs/decisions.md` is the important file in this repository. It records why
things are the way they are, including the decisions that look like mistakes
until you know the reason: why olive is never used for text, why "I am not sure"
counts as yes, why the app terms block the dashboard instead of sitting above it,
why there is no Canadian region pin on Vercel, why drafts are versioned.

Anyone taking this over should read it before changing anything structural. It is
kept current with the code, in the same commits.

---

## 10. Known history worth stating

Two things a new maintainer would otherwise rediscover the hard way.

**An Anthropic API key was exposed in a chat transcript during the build.** It
was rotated the same day and the exposed key was verified dead. Noted because a
handover should say what happened, not only what the current state is.

**The first click of a magic link used to return a server error, and a refresh
worked.** That was clock skew: Supabase stamps the session token with its own
clock, and a validating server fractionally behind reads the timestamp as the
future. `lib/data/clock-skew.ts` waits it out. If similar symptoms appear
elsewhere, that is the first thing to check.

---

## 11. Contact

Built by Irene Saliendra, DigitalFlow Consulting.
Client contact: Shakara, Future Civics.
Test material provided by KJ.
