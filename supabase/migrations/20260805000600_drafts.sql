-- drafts
--
-- Generated sections of the Research Ethics Board application, versioned, each mapped onto the
-- Dalhousie form's own section numbering (Section 1, and 2.1 through 2.15).
--
-- ai_generated is not null by design. Guardrail 5: every draft record states
-- whether a model wrote it, so the final package can disclose AI involvement
-- accurately rather than approximately.

create table if not exists drafts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects (id) on delete cascade,
  form_section    text not null,          -- '1', '2.1', '2.1.1', '2.6.3', and so on
  section_title   text,
  content         text,
  version         integer not null default 1,
  is_current      boolean not null default true,

  ai_generated    boolean not null,       -- guardrail 5, never nullable
  model_version   text,                   -- populated when ai_generated is true
  edited_by_human boolean not null default false,

  word_count      integer,
  word_limit      integer,                -- e.g. 500 for the lay summary in 2.1.1

  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (project_id, form_section, version)
);

comment on column drafts.ai_generated is
  'Guardrail 5. Records whether a model produced this text, so AI involvement stays disclosable to the Board.';

alter table drafts drop constraint if exists drafts_model_version_when_ai;
alter table drafts
  add constraint drafts_model_version_when_ai
  check (ai_generated = false or model_version is not null);

create index if not exists drafts_project_idx on drafts (project_id);
create index if not exists drafts_current_idx on drafts (project_id, form_section)
  where is_current;
