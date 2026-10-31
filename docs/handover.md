# Research Ethics Board Assistant Handover

**Prepared for:** KJ and Shakara
**Prepared by:** Irene Saliendra, Founder and Principal Consultant, DigitalFlow Consulting Inc.
**Date:** 31 October 2026
**Production address:** https://reb-assistant.vercel.app

## 1. Summary

The Research Ethics Board Assistant is built, deployed and operating in production. Account creation, email confirmation, password reset and AI-assisted drafting were each verified on the live system in October 2026, and the Word download follows the numbered questions of the Dalhousie Research Ethics Board application form. The tool asks every numbered question on the form, other than 2.11, which is completed on the form, and 2.13, which is routed to a person.

The handover is complete when the account transfers in Section 6 are finished. Until then DigitalFlow Consulting retains working access to every account described here. This document contains no passwords, keys or recovery codes. The one login that must be transferred is supplied separately, as described in Section 5.

Two matters remain open and require a decision by the recipients:

1. **Database plan.** The database project pauses itself when idle, which has interrupted service twice. A paid plan removes the behaviour (Section 7).
2. **Repository.** The complete code and history now reside in the project repository, `researchethicsboardassistant-commits/REBassistant`. Production continues to deploy from the DigitalFlow repository until Vercel is linked to the project repository (Section 6, step 6). Both hold the same code as of 31 October 2026, and both are public (Section 5.2).

## 2. Purpose and limits of the tool

The tool helps a researcher at Dalhousie University prepare a Research Ethics Board application. A researcher signs in, answers questions about the study, confirms that the tool has understood the method, and receives a Word document laid out under the form's own numbered questions. The researcher completes and submits the application.

The tool does not review research, approve or exempt it, or submit anything to Dalhousie. Every ethics determination is made by the Board.

## 3. The Word document

Each answer is printed under the form's own number (2.3.1, 2.3.2 and so on), so that content is transferred to the form question by question. Four conventions apply:

- **"Complete on the form."** Section 1 and question 2.11 are completed on the form by the research team. The tool never asks for people's details, and 2.11 is completed from the researcher's saved details.
- **"No answer captured yet."** The tool asks the question and the researcher has not answered it. A question that applies only to some studies, such as a consent exception or the use of deception, is introduced by a yes or no question, and its follow-up is asked only when the answer is yes. A yes or no question answered no prints as a ticked box, which is how the form's own "Not applicable" box is answered. Where one form number holds answers to several of the tool's questions, any that remain unanswered are listed beneath the answers.
- **"Not drafted by this tool. Prepare it directly."** Section 2.13, research involving Indigenous peoples, is routed to a person and is never written by the tool.
- **Section 1** (names, Banner numbers, telephone numbers, supervisor) is printed as labelled blanks. The tool is designed never to ask for personal details.

## 4. Operation and troubleshooting

### 4.1 Common conditions

| Condition | Usual meaning | Action |
|---|---|---|
| "Wrong email or password" | Either the password is incorrect or the address has no account. The tool cannot distinguish the two, by design | Try any other address that may have been used. Otherwise select **Forgot your password?** |
| The dashboard is empty and work appears lost | A different address was used. Work remains with the address under which it was started, and accounts cannot be merged | Sign out and sign in with the original address |
| No email arrives (confirmation or reset) | The message was sent and the receiving mail system is holding it, or the address has no account | Check the junk folder and wait two minutes. Request one further email only (one per minute is permitted). If it still does not arrive, use a different address. See 4.2 |
| "That link has expired or had already been used" | Links work once and last one hour. The link may already have been opened | Request a new email and select the button once |
| The link opens "page not found" (404) | The email template in Supabase is incorrect | See 4.3 |
| Nothing loads, or sign-in reports the service as unavailable | The Supabase project has paused itself | See 4.4 |
| Drafting returns "Not yet drafted", or the AI step never completes | The Anthropic key in Vercel is missing, expired or out of credit | See 4.5 |

### 4.2 Email that does not arrive

In October 2026 the tool's emails to one Dalhousie address did not arrive, although the Sent folder of the sending mailbox showed them leaving. A Gmail address worked. The cause was not established. Should this recur:

1. Open the sending mailbox, researchethicsboardassistant@gmail.com, and look in **Sent** for the message.
2. If the message is present, the tool has performed its function and the receiving system is holding it. The researcher should use a different address, such as a Gmail address.
3. If the message is absent, open Supabase, then **Logs**, then **Auth**, and examine the newest entries for a failure.

### 4.3 The two email templates

The tool sends two distinct emails. Each has its own entry in Supabase, under **Authentication**, then **Emails**:

- **Confirm signup.** Subject: "Confirm your email for Research Ethics Board Assistant". The button address ends `type=signup`.
- **Reset Password.** Subject: "Set a new password for Research Ethics Board Assistant". The button address ends `type=recovery`.

The wording of each is held in the repository under `supabase/templates/` (`confirm-signup.html` and `recovery.html`). The entire contents of the file are pasted into the matching entry, and the page is then reloaded to confirm that the change was saved.

This configuration failed once. On 16 October 2026 the Confirm signup entry contained the Reset Password wording, and every new account's confirmation link was reported as expired. Pasting the correct file into each entry resolved it.

### 4.4 Interruption of the whole service

The Supabase project pauses itself after a period without use. This occurred on 26 August and on 19 September 2026. No data was lost on either occasion.

1. **Check.** Open `https://reb-assistant.vercel.app/callback?token_hash=probe&type=email` and read the end of the address bar once the page has loaded. An address ending `error=link_expired` indicates that the database is answering and the fault lies elsewhere. An address ending `error=exchange_failed` indicates that the database is not answering.
2. **Restore.** Open Supabase, open the project, and select **Restore project**. Allow two to three minutes. A "web server is down" message during this period is expected.
3. **Prevent.** A paid Supabase plan does not pause. This is a billing decision and requires no development.

### 4.5 Interruption of drafting

1. In Vercel, open the project, then **Settings**, then **Environment Variables**, and confirm that `ANTHROPIC_API_KEY` is present.
2. Confirm that the Anthropic account holds credit, since billing follows the key.
3. When the key is replaced, the new value is entered in Vercel and the project is redeployed. A key is never placed in the repository or in an email.

Drafting was verified on the live system on 31 October 2026.

### 4.6 Assisting a researcher who cannot sign in

A password cannot be set on behalf of another person. The researcher selects **Forgot your password?** and the email is delivered to the researcher.

To review the existing accounts and the number of projects held by each, open Supabase, then **SQL Editor**, and run the following query. It reads data only.

```
select u.email, count(p.id) as projects
from auth.users u
left join projects p on p.owner_id = u.id
group by u.email
order by projects desc, u.email;
```

To remove an empty account, select **Authentication**, then **Users**, then the row's menu, then **Delete user**. The count above is checked first, because deleting an account deletes its work.

## 5. Accounts, repositories and credentials

### 5.1 Accounts

Section 5.4 shows how these accounts connect to one another.

| Account | Held by | Transfer method |
|---|---|---|
| Project mailbox, researchethicsboardassistant@gmail.com | DigitalFlow | Ownership transfer on a call with Irene Saliendra (Section 6, step 1) |
| Supabase (database and sign-in) | The project's own organisation, signed in to through the project GitHub account | Follows the project mailbox. The recipients are added as owners of the organisation, and the service key is rotated |
| Anthropic key (AI drafting) | DigitalFlow key, held in Vercel | The recipients issue their own key and revoke the existing key |
| Vercel (hosting) | DigitalFlow account | Linked to the transferred repository, then every setting is verified |
| GitHub repository | DigitalFlow account, and the project repository | The code resides in the project repository. The recipients are added as its owners (Section 6, step 5) |

### 5.2 Repositories

Two repositories exist, and on 31 October 2026 the complete code and history were copied from the DigitalFlow repository to the project repository.

| Repository | Content | Visibility |
|---|---|---|
| `researchethicsboardassistant-commits/REBassistant` | **The project repository.** The complete code and history, including the final changes of 31 October 2026. It is not yet connected to production | Public |
| `irsaliendraDF/REBAssistant-` | The DigitalFlow repository. Vercel deploys production from it until step 6 of Section 6. A change pushed to only one of the two repositories leaves the other behind | Public |

The project repository belongs to a GitHub account registered through Google sign-in with the project mailbox. Control of that mailbox therefore carries control of that GitHub account, and the repository follows the mailbox to the recipients in step 1 of Section 6.

Both repositories contain no credentials, which was verified across the full history on 31 October 2026. The file `.env.local` is excluded from version control, and only `.env.local.example` is tracked. The repository does contain the Supabase project identifier and the mailbox address, which are not secrets. The repository is public, and the recommended course is to set it to private when it is transferred, unless public release of the code is intended.

### 5.3 Credentials

No password, key or recovery code is recorded in this document, because a document of this kind is forwarded, copied and retained, and a credential recorded in it remains available to every holder of any copy.

The one password that must be transferred, that of the project mailbox, is supplied in a separate document titled "Logins", shared with the recipients by name. Two-step verification on that mailbox sends its code to the telephone of Irene Saliendra, so the password alone does not grant access. Moving two-step verification to the recipients' own telephone is completed together on a call. The Logins document is deleted once step 1 of Section 6 is complete.

All other accounts are transferred by invitation, by ownership transfer or by the issue of new keys, and require no password from DigitalFlow. The mailbox's backup codes are never shared. The recipients regenerate them in step 1, which voids every code held by DigitalFlow.

### 5.4 How the accounts connect

Two views follow. The first shows who must sign in to what, which decides who can reach each account once the mailbox is transferred. The second shows how the running tool uses each service, which decides what stops when one of them fails.

**Figure 1. Who signs in to what**

```
  Project mailbox (Gmail)
  researchethicsboardassistant@gmail.com
            |
            |  signs in with Google
            v
  GitHub account
  researchethicsboardassistant-commits
            |
      +-----+--------------------+
      |                          |
      | owns                     | signs in with GitHub
      v                          v
  Project repository       Supabase organisation
  REBassistant             (the project's own)
                                 |
                                 | holds
                                 v
                           Database, sign-in, email
                           templates and the service key

  Separate accounts, held by DigitalFlow until steps 4 and 6 of Section 6:

  Vercel (hosting)         deploys from  irsaliendraDF/REBAssistant-
  Vercel (hosting)         holds         the Supabase keys and the Anthropic key
  Anthropic account        issues        the Anthropic key
```

**Figure 2. How the running tool uses each service**

```
  Researcher's browser
            |
            |  signs in with email and password
            v
  The tool, hosted on Vercel
            |
      +-----+------------------------------+
      |                                    |
      | stores and reads answers,          | sends drafting requests,
      | checks sign-in                     | after the redaction check
      v                                    v
  Supabase                           Anthropic (the AI model)
  (database and sign-in)
      |
      | sends confirmation and reset emails
      | through the project mailbox
      | (an App Password held in Supabase)
      v
  Researcher's inbox
```

**What stops when one piece is lost**

| If this is lost | What stops |
|---|---|
| Access to the project mailbox | Nobody can sign in to the GitHub account, and so not to the project repository or the Supabase dashboard. The tool itself keeps running, and emails keep sending until the App Password is revoked |
| Access to the GitHub account | The project repository and the Supabase dashboard cannot be reached. The tool itself keeps running |
| The Supabase project | Sign-in, saved answers and drafts stop. Section 4.4 applies if it has only paused |
| The App Password held in Supabase | Confirmation and reset emails stop sending. People who are already signed in are not affected |
| The Anthropic key held in Vercel | Drafting stops. Everything else continues |
| Vercel | The site goes offline and nothing can be deployed |

## 6. Transfer procedure

Until every step is complete, DigitalFlow retains working access. This reflects the nature of shared accounts and is not a deficiency of any party. The only remedy is to complete the list, in this order:

1. **Mailbox.** Take ownership, change the password, regenerate the backup codes and move two-step verification to the recipients' own telephone. This step is the one most often omitted. Until the backup codes are regenerated, DigitalFlow holds ten working bypasses of two-step verification, regardless of the password.
2. **Mail credential in Supabase.** In the Google account, revoke the existing App Password and issue a new one. Enter it in Supabase under **Authentication**, then **Emails**, then the SMTP settings.
3. **Supabase.** The project belongs to the project's own organisation, and its dashboard is signed in to through the project GitHub account, so control of the mailbox in step 1 carries control of it. Add the recipients' own accounts as owners of that organisation, rotate the service role key and update it in Vercel.
4. **Anthropic.** Issue a new key in the recipients' own Anthropic account, enter it in Vercel and revoke the existing key.
5. **GitHub.** The code already resides in the project repository, which is controlled through the project mailbox. Add the recipients' own GitHub accounts as owners of that repository, and set it to private unless public release of the code is intended.
6. **Vercel.** Link the project to the project repository and verify every environment variable. The two variables beginning `NEXT_PUBLIC_` must retain that prefix, because omitting it fails silently and completely.

## 7. Open items and known limitations

1. **Database plan.** The Supabase project pauses itself when idle and has interrupted service twice. The usage pattern of the tool, intensive use for a week followed by months of inactivity, is the least suited to this behaviour. A paid plan is recommended before researchers rely on the tool.
2. **Repository ownership and visibility.** The project repository is public, and the recipients are added as its owners in step 5 of Section 6. Until step 6, production deploys from the DigitalFlow repository, so a change must be pushed to both repositories to reach production and remain in the project repository.
3. **Disclosure wording** in `lib/disclosure/text.ts` was settled on 31 October 2026 and carries version `v1-2026-10`. It has not been read by a research ethics expert, and a read by one before the tool is relied on is recommended. The wording avoids statements the tool cannot verify, such as that the research team reviewed the text.
4. **Drafting prompt and intake questions** are first drafts. The 57 intake questions were written to cover every numbered question on the form, and their wording would benefit from review by the same expert. The drafting prompt enforces the guardrail against ethics determinations and should be read by a person who knows what a Board will not accept.
5. **Gap analysis** is rule-based. A model-assisted pass would identify more omissions.
6. **Email is sent from a Gmail account.** This is suitable for a test group and unsuitable for a cohort, because the account is limited to roughly 500 messages a day. A domain controlled by the recipients, with SPF and DKIM records, is the replacement.
7. **Residency.** Canadian residency was agreed to apply to participant data. The application runs in the hosting provider's default region while the database is in Montreal. The commitment holds because no participant data is stored anywhere in the system. If a later phase stores participant data, this decision must be reopened beforehand.

## 8. Technical reference

### 8.1 Guardrails

The following eight guardrails derive from Section 11 of the signed agreement and determine several design decisions.

| # | Guardrail | Enforced in |
|---|---|---|
| 1 | Redaction gate before every model call | `lib/anthropic/redaction.ts`, applied at the single chokepoint in `lib/anthropic/client.ts` |
| 2 | No participant data at rest | The schema. There is no participant table and no field for a participant's name or contact details |
| 3 | A human gate at every reasoning step | `lib/workflow/states.ts`. Nothing advances automatically and every transition is logged with an actor |
| 4 | Indigenous and community-engaged research is routed to a person, never generated | `isGenerationBlocked()`, evaluated in code before a prompt is constructed |
| 5 | AI involvement remains disclosable | `drafts.ai_generated` is not null. Drafts are versioned and a human edit carries the AI provenance forward |
| 6 | The tool never makes the ethics determination | The drafting and method-check system prompts, and the absence of any code path that scores or approves |
| 7 | Automated, logged consent wherever information is collected or reused | `consent_events`, append-only, recording the exact wording shown |
| 8 | AI-use disclosure on three surfaces | The terms gate, the participant consent wording and the disclosure within the application |

Guardrail 1 redacts email addresses, telephone numbers, postal codes and street addresses before a request is sent. Social Insurance Numbers, health card numbers and dates of birth cause the request to be refused outright, and the researcher is told what to remove. Guardrail 5 is the reason drafts are versioned and not overwritten: replacing a row would erase the record that a model wrote a section, and the disclosure to the Board would become inaccurate. The disclosure within the application is generated from the database and lists the sections a model actually drafted.

### 8.2 Researcher workflow

```
triage → intake → method check → draft → gap analysis → complete
```

- **Triage** establishes the shape of the study and sets the routing flags. The answer "I am not sure" to the Indigenous and community-engaged questions counts as yes, because routing a study to a person unnecessarily costs a conversation, and failing to route it costs considerably more.
- **Intake** asks the substantive questions. Each question declares the form section it feeds.
- **Method check** states back the methodology as the tool understood it. The researcher confirms, alters or rejects it, and a rejection returns the project to intake.
- **Draft** produces the application section by section, by one button per section.
- **Gap analysis** reports what is missing or thin, citing TCPS 2 at chapter level only.
- **Complete** offers the Word document.

Nothing in this sequence advances automatically.

### 8.3 The Word document and the form's numbered questions

`lib/form/dalhousie-questions.ts` lists the form's 54 numbered questions and states under which of them each of the tool's questions prints. Where a section covers two or more questions, the AI draft is requested as numbered answers (`[[2.3.1]]` on its own line before each answer), and `splitDraft()` in `lib/draft/assemble.ts` reads them back. If the model disregards the format, the text prints whole under its section and nothing is lost.

Two answers print in a section other than the one in which they are asked: dependence on the researcher (asked at 2.3, printed at 2.5.1) and incentives (asked at 2.4, printed at 2.6.5). A test in `lib/form/dalhousie-questions.test.ts` fixes that every numbered question is asked, other than 2.11 and 2.13. Five yes or no questions (phased review, a consent exception, deception, incidental findings and genetic counselling) gate their follow-ups through a `showWhen` function on the question. A follow-up that is not shown is not required, counted, printed or drafted, and an answer kept from before its gate was changed back to no does not print. The numbers 2.7.2 and 2.8.2 are generated by Word's list numbering and were read through Word.

### 8.4 Sign-in

Sign-in uses an email address and a password, on four screens: sign in, create an account, forgot password and set a new password. Email is involved twice in the life of an account, once to confirm it and once if the password is forgotten. Ordinary sign-in involves no inbox.

- **Confirmation remains enabled.** Without it, any person could register an address they do not control.
- **Signing in never creates an account.** Until 21 September 2026 any address typed into the sign-in box created an account silently, and one researcher reached the product under three addresses with work under two of them.
- **Supabase does not disclose whether an address has an account.** A wrong password and an unregistered address return the same `invalid_credentials`, so that the sign-in box cannot be used to discover which addresses are registered. The only two places that can prevent a second account are the sign-up screen and the empty dashboard, which names the signed-in address.
- **Applications belong to the address under which they were started.** There is no merging or linking of accounts.
- **Both emails carry a `token_hash` link**, which holds its own proof and does not depend on a cookie in the browser that requested it. The link's address is written into each template (`https://reb-assistant.vercel.app/callback?token_hash=…&type=signup` or `type=recovery`), because Supabase's own redirect value resolved incorrectly while the Redirect URLs list was incomplete and produced a link with no question mark. The list now holds `https://reb-assistant.vercel.app/**`, added on 31 October 2026, and the links remain hardcoded, so they do not depend on it. If the domain changes, both template files change with it. See `supabase/templates/README.md`.
- **Removed mechanisms.** The magic link, the six-digit code and the browser reset were each a remedy for a way in which a sign-in link can fail. A password fails in none of those ways.

### 8.5 Technology

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database and authentication | Supabase (Postgres with pgvector), region `ca-central-1` |
| Model | Anthropic, `claude-opus-5`, set in `lib/env.ts` and overridable by `ANTHROPIC_MODEL` |
| Export | `docx` |
| Hosting | Vercel |
| Tests | Vitest, 392 passing |

The data layer sits behind an interface, `DataStore` (`lib/data/types.ts`), with an in-memory implementation used when no database is configured and a Supabase implementation. Both are held to the same behaviour, which is what makes the ownership rules testable.

### 8.6 Knowledge base

The application ships with Dalhousie's form, its application guidelines, its consent and confidentiality templates and its recruitment guidance: eleven documents of about 34,000 words. Similarity search was scaffolded and deliberately not built. The guidelines are written against the form's own numbering, so the guidance that applies to a section is identified by the section number, in a table that a research ethics expert can read and correct. A similarity score cannot be audited in that way.

The cost is that unusual wording may fall outside a fixed mapping. If test users encounter this, `docs/decisions.md` records what to change: the vector column and `match_kb_chunks` already exist, and only an embedding step in `lib/kb/ingest.ts` is required. Ingestion is a local script (`npm run ingest`, with `npm run ingest:plan` as a dry run) and requires the Supabase service role key.

### 8.7 Running the project

```
npm install
npm run dev          # http://localhost:3000
npm test             # 392 tests
npm run build
npm run ingest:plan  # shows what ingestion would do, changes nothing
npm run ingest       # loads the knowledge base, needs the service role key
```

The application runs without credentials. With no database it uses the in-memory store and says so on screen. With no model key it produces the document structure from the researcher's own answers and says so. Environment variables are documented in `.env.local.example`. The reasoning behind the design decisions is recorded in `docs/decisions.md`, which should be read before any structural change.

### 8.8 Recorded history

1. **Exposed API key.** An Anthropic key was exposed in a chat transcript during the build. It was rotated the same day and the exposed key was verified as revoked.
2. **First-click error.** The first click of a sign-in link once returned a server error that disappeared on refresh. The cause was clock skew between Supabase and the validating server, and `lib/data/clock-skew.ts` accommodates it.
3. **Three addresses.** One researcher reached the product under three addresses, discovered on 21 September 2026 by counting the accounts after a sign-in complaint whose cause was the paused project. Two of the three accounts were deleted after a full snapshot of the database was written to disk. The finding is that a sign-in which cannot fail cannot be diagnosed. Sign-in was reported as faulty repeatedly between 26 August and 21 September and three fixes were applied to it before the accounts were counted. See `docs/sign-in-spec.md` and `docs/sign-in-spec-2.md`.
4. **Confirmation emails reported as expired.** On 16 October 2026 the Confirm signup template held the Reset Password wording (Section 4.3). The application converts any "expired", "invalid", "used" or "not found" error into one message (`lib/auth/callback.ts`), so the screen could not state the cause, and the actual error was found by printing it temporarily. Should it recur, the Supabase Auth log is read first and the template in each entry is then checked.

## 9. Support

DigitalFlow Consulting Inc. remains available to the recipients after the final invoice for any issue with the tool.

Irene Saliendra
Founder and Principal Consultant, DigitalFlow Consulting Inc.
irene@digitalflowconsulting.ca
