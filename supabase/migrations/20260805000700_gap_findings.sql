-- gap_findings
--
-- What is missing or thin in the application, tied back to TCPS2 principles and
-- to the form section it affects.
--
-- Guardrail 6: these are observations and suggestions. Nothing here is an ethics
-- determination. The wording surfaced to the researcher stays advisory, and the
-- severity scale below is deliberately descriptive ('missing', 'thin') rather
-- than judgemental ('fails', 'non-compliant').

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gap_severity') then
    create type gap_severity as enum ('missing', 'thin', 'worth_reviewing');
  end if;
end
$$;

create table if not exists gap_findings (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects (id) on delete cascade,
  form_section   text,                -- section the gap affects, e.g. '2.7'
  severity       gap_severity not null default 'worth_reviewing',
  finding        text not null,       -- advisory language only
  tcps2_reference text,               -- e.g. 'TCPS2 Article 5.1'
  kb_chunk_id    uuid,                -- citation back to the guidance that raised it
  ai_generated   boolean not null default true,
  model_version  text,
  resolved       boolean not null default false,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

comment on table gap_findings is
  'Advisory gap analysis. Guardrail 6: the app never makes the ethics determination, the REB does.';

create index if not exists gap_findings_project_idx on gap_findings (project_id, resolved);
