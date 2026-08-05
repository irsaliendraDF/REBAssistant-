-- Consent and audit records.
--
-- Guardrail 7 is a whole-tool rule, not a feature: wherever the app stores or
-- reuses a person's information, there is an explicit consent step and a record
-- that it happened.
--
-- The clearest case is tombstone reuse. When a saved profile is pulled into a
-- new project, the researcher sees what is being carried over, confirms it, and
-- the confirmation is recorded against that project. Once per project, not once
-- per screen and not silently at save time.
--
-- This table is append only. No update or delete policy is granted to users in
-- the RLS migration. A consent record that can be edited afterwards is not a
-- consent record.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'consent_kind') then
    create type consent_kind as enum (
      'tombstone_reuse',      -- saved profile carried into a new project
      'app_terms',            -- researcher consents to how the tool uses their inputs
      'ai_disclosure_ack'     -- researcher acknowledges the AI-use disclosure
    );
  end if;
end
$$;

create table if not exists consent_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  project_id     uuid references projects (id) on delete cascade,
  kind           consent_kind not null,
  granted        boolean not null,
  -- Exactly what was shown to the person at the moment they confirmed, and what
  -- was carried over. Stored so the record can be reconstructed later.
  disclosure_text text not null,
  scope          jsonb,
  consent_version text,
  created_at     timestamptz not null default now()
);

comment on table consent_events is
  'Guardrail 7. Append only. Logged, explicit consent wherever a person''s information is stored or reused.';

-- One recorded reuse decision per project, which is the Section 9 assumption 6
-- interaction default.
create unique index if not exists consent_events_tombstone_once_per_project
  on consent_events (project_id, kind)
  where kind = 'tombstone_reuse' and project_id is not null;

create index if not exists consent_events_user_idx on consent_events (user_id, created_at desc);


-- Redaction audit.
--
-- Guardrail 1: every call to the Anthropic API passes through a single redaction
-- function, and identifiable participant data is stripped or the call refused.
-- This table records that the gate ran and what it did. It stores counts and
-- categories only. It never stores the detected text itself, because writing
-- flagged content into the database would defeat the purpose of the gate and
-- breach guardrail 2.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'redaction_outcome') then
    create type redaction_outcome as enum ('clean', 'redacted', 'refused');
  end if;
end
$$;

create table if not exists redaction_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects (id) on delete set null,
  user_id       uuid,
  call_purpose  text not null,       -- e.g. 'method_interpretation', 'draft:2.4'
  outcome       redaction_outcome not null,
  detector_hits jsonb not null default '[]'::jsonb,  -- categories and counts only, never the matched text
  model_version text,
  created_at    timestamptz not null default now()
);

comment on column redaction_events.detector_hits is
  'Categories and counts only. The matched text is never stored, which would defeat the gate and breach guardrail 2.';

create index if not exists redaction_events_project_idx on redaction_events (project_id, created_at desc);
