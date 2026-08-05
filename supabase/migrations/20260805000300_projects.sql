-- projects and the workflow state machine
--
-- A project moves forward only when the researcher explicitly advances it.
-- Nothing auto-advances. method_check is the load-bearing gate: rejection sends
-- the project backwards, not forwards.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_state') then
    create type project_state as enum (
      'triage',
      'intake',
      'method_check',
      'draft',
      'gap_analysis',
      'complete'
    );
  end if;
end
$$;

create table if not exists projects (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null,
  title                    text not null,
  plain_language_summary   text,
  institution              text not null default 'Dalhousie University',
  state                    project_state not null default 'triage',

  -- Guardrail 4. Set during triage. While either flag is true, draft generation
  -- for the affected sections is blocked and the researcher is routed to a
  -- person. The app must never auto-generate these sections.
  involves_indigenous_research      boolean not null default false,
  involves_community_engaged_research boolean not null default false,
  routing_note             text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  completed_at             timestamptz
);

comment on column projects.state is
  'Workflow position. Advanced only by explicit user action, never automatically.';
comment on column projects.involves_indigenous_research is
  'Guardrail 4. When true, affected sections are flagged and routed to a human, never generated.';

create index if not exists projects_owner_idx on projects (owner_id);
create index if not exists projects_state_idx on projects (state);

-- Audit trail of every state transition, including who caused it. A transition
-- with no actor would mean the app advanced itself, which guardrail 3 forbids.
create table if not exists project_state_transitions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  from_state   project_state,
  to_state     project_state not null,
  actor_id     uuid not null,
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists project_state_transitions_project_idx
  on project_state_transitions (project_id, created_at desc);
