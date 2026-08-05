-- method_interpretations
--
-- The verification loop, and the proof that a human reviewed every reasoning
-- step. The app writes its plain-language reading of the researcher's
-- methodology; the researcher responds confirmed, altered or rejected, with a
-- correction where they altered or rejected it.
--
-- A row with response 'pending' means the gate has not been passed. The project
-- cannot leave method_check until every interpretation is resolved, and
-- 'rejected' sends the flow backwards rather than through.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'interpretation_response') then
    create type interpretation_response as enum (
      'pending',
      'confirmed',
      'altered',
      'rejected'
    );
  end if;
end
$$;

create table if not exists method_interpretations (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects (id) on delete cascade,
  form_section       text,          -- e.g. '2.6' methods
  interpretation     text not null, -- the app's plain-language reading
  response           interpretation_response not null default 'pending',
  researcher_correction text,       -- required when response is altered or rejected
  responded_by       uuid,
  responded_at       timestamptz,
  model_version      text,          -- which model produced the interpretation
  created_at         timestamptz not null default now()
);

comment on table method_interpretations is
  'Human review audit trail. Guardrail 3: no reasoning step advances without an explicit researcher response.';

alter table method_interpretations
  drop constraint if exists method_interpretations_correction_required;
alter table method_interpretations
  add constraint method_interpretations_correction_required
  check (
    response not in ('altered', 'rejected')
    or (researcher_correction is not null and length(trim(researcher_correction)) > 0)
  );

alter table method_interpretations
  drop constraint if exists method_interpretations_responded_recorded;
alter table method_interpretations
  add constraint method_interpretations_responded_recorded
  check (
    response = 'pending'
    or (responded_by is not null and responded_at is not null)
  );

create index if not exists method_interpretations_project_idx
  on method_interpretations (project_id, created_at desc);
