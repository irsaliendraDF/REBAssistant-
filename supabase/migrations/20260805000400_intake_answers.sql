-- intake_answers
--
-- Per-project responses to the guided intake questions. Answers are keyed to the
-- Dalhousie form section they feed (for example '2.3' for study population) so
-- draft assembly can map answers onto the form's own numbering.
--
-- These are answers about the research, given by the researcher. They are not,
-- and must never become, a store of participant data.

create table if not exists intake_answers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  question_key text not null,     -- stable identifier for the intake question
  form_section text,              -- Dalhousie form section this feeds, e.g. '2.3'
  answer       text,
  answered_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, question_key)
);

create index if not exists intake_answers_project_idx on intake_answers (project_id);
create index if not exists intake_answers_section_idx on intake_answers (project_id, form_section);
