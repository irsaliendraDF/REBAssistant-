# Decisions

Why things are the way they are. Kept as we go rather than reconstructed at the
end, because the reasoning is the part a future developer cannot recover from the
code.

What a decision is doing here: someone could reasonably have chosen otherwise,
and the choice is not obvious from reading the file it lives in.

---

## Infrastructure

**Supabase is in `ca-central-1`, and that cannot change.** Section 11 of the
signed agreement commits to Canadian-resident hosting. Supabase fixes region at
project creation; changing it is a rebuild and a data migration, not a setting.
Note that Anthropic API calls leave Canada regardless, which is precisely why the
redaction gate exists.

**Everything above the data layer talks to a `DataStore` interface, never to
Supabase directly.** Built when there was no database at all, so the app could be
developed and demonstrated before credentials existed. It also means the
in-memory and hosted implementations are held to the same behaviour, including
ownership checks that mirror row level security.

**Auth is email magic link. No institutional single sign-on, no Google.** SSO
needs Dalhousie IT involvement and a formal integration request, which will not
happen inside Phase 1. Social sign-in is excluded separately: one identity per
researcher, so saved details are reused rather than fragmented across two
accounts the person did not realise were different.

**The magic link redirect is read from request headers, not from
`NEXT_PUBLIC_APP_URL`.** The variable approach failed silently in the worst way:
forget it on the deployment and it keeps its development default, so every
production sign-in email points at localhost. Nothing errors. It just does not
work, for everyone.

**Review mode and placeholder sign-in switch themselves off when Supabase is
configured**, rather than depending on their own variables. Leaving it to memory
risked an open URL in front of a real database. It would not have worked anyway:
neither stand-in user id exists in `auth.users`, so every write would have failed
row level security with the cause several steps from the symptom.

**Email sending is not built.** Supabase's own sender carries a few messages an
hour, which is enough for the internal test and not for real use. Brevo, or any
comparable service, on a real domain is a named pre-production task. It must not
be a Gmail address: `gmail.com` cannot pass DMARC alignment for an application,
and a researcher receiving a sign-in link from a personal-looking address for a
research ethics tool is right to treat it as phishing.

---

## The guardrails, where a choice was involved

**"I am not sure" counts as yes** on the Indigenous research and
community-engaged questions in triage. The cost of flagging is a conversation
with the Research Ethics Office. The cost of not flagging is a drafting tool
improvising on TCPS2 Chapter 9 and community protocols. Those costs are not
remotely symmetrical, so uncertainty resolves toward the person.

**The redaction gate refuses on some categories and strips on others.** Contact
details are stripped and the call proceeds, because the surrounding text is
usually legitimate methodology. Social insurance numbers, health numbers and
dates of birth refuse the call outright: their presence means something went
wrong upstream, and stripping them quietly would hide that.

**An unlabelled nine-digit group is only treated as a social insurance number if
it passes the Luhn checksum.** Real ones are Luhn-valid; arbitrary numeric data
usually is not. Without this, table data like `100 200 300` blocks the
researcher's work, and researchers who hit spurious refusals learn to route
around the tool, which is a worse outcome than the one the gate exists to
prevent.

**The gate does not attempt participant name detection.** No regular expression
separates "we interviewed Sarah Chen" from "as Chen (2019) argues" or from
"Dalhousie University". Attempting it means either constant false refusals or
false confidence. Names are handled by never asking for them: no intake question
invites one, and a test fails if a new one does.

**Gap findings cite TCPS2 at chapter level only.** Chapter numbering is something
the code can state accurately; article numbers are not, until the document is
ingested and a retrievable chunk sits behind the citation. A tool inventing
plausible article numbers into a research ethics application is worse than one
citing nothing, because the researcher cannot tell the difference and the Board
can.

**The AI-use disclosure is generated from what was actually drafted**, not
templated. Today it states plainly that no section was AI-generated, because none
was. A disclosure that overclaims or stays silent teaches a Board that
disclosures carry no information, which is worse than having none.

**Gap analysis has no score, no traffic light, and never blocks.** Each of those
reads as a verdict the tool is not entitled to give. Continuing is always
available with findings outstanding: they are observations to weigh, not
conditions to satisfy.

**The brevity check applies to required questions only.** Applied to optional
ones as well, it produced around nine findings on a reasonable application, which
is the fastest way to teach a researcher that findings are noise worth scrolling
past.

**Tombstone reuse is confirmed once per project, not per screen and not silently
at save.** Section 9 of the build plan settles the interaction. Both answers are
recorded, because a record that only ever says yes is not evidence of anything,
and the exact wording shown is stored verbatim rather than a version number, so
the decision can be reconstructed after the text changes.

---

## Interface

**Olive `#96A537` is not text.** It is 2.7:1 against white. Neither are the two
pale supplied colours. They are fills, with the dark green on top of them, which
is where the contrast comes from. Every pairing the interface uses is checked
against WCAG AA by test, so this cannot be undone by accident.

**Neutrals are tinted green rather than grey.** Five colours do not make an
interface, and pure grey next to a green palette reads as a different design.

**Red is kept for validation errors**, against the palette, because the
convention carries meaning a green palette cannot replace.

**Restraint is deliberate.** This is a long form researchers work through over
weeks. Brand presence is limited to the rule across the top, the wordmark, and
primary actions.

---

## Known provisional things

**`lib/form/dalhousie-sections.ts` is written from the build plan's description
of the form, not from the form itself.** Every section number, title and word
limit needs checking against
`application-human-ethics-prospective-research.docx` once it is ingested. This is
the highest-value correction available in the repo, because draft assembly,
intake and gap findings all key off those numbers.

**The intake question set is a first draft** for the client's research ethics
expert to revise. Wording, ordering, and what is required versus optional are all
open. It is one file, so her feedback is cheap to apply.

**Method check readings are rule-derived, not model-reasoned.** They restate
answers rather than interpreting them, which means they cannot misunderstand,
which makes confirming them a weaker check than the step ultimately exists for.
The screen says so. `modelVersion: null` marks a rule-derived reading, which is
what will distinguish the rounds later.

**The embedding dimension is 1024, stated in exactly two places**: the knowledge
base migration and `lib/kb/config.ts`. Changing it means a migration and a full
re-ingest. The provider is not settled; Anthropic has no embeddings endpoint, so
this is a second vendor.
