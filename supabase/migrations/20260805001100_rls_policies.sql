-- SUPABASE ONLY. Uses auth.uid(), so this requires the Supabase auth schema.
--
-- Row level security. A researcher sees their own profile and their own
-- projects, and everything hanging off those projects. Nothing else.
--
-- Note what is deliberately absent: consent_events and redaction_events get
-- insert and select policies but no update or delete policy. Audit records that
-- users can rewrite are not audit records.

alter table profiles                    enable row level security;
alter table projects                    enable row level security;
alter table project_state_transitions   enable row level security;
alter table intake_answers              enable row level security;
alter table method_interpretations      enable row level security;
alter table drafts                      enable row level security;
alter table gap_findings                enable row level security;
alter table consent_events              enable row level security;
alter table redaction_events            enable row level security;
alter table kb_documents                enable row level security;
alter table kb_chunks                   enable row level security;

-- profiles: own row only.
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects: own projects only.
drop policy if exists projects_all_own on projects;
create policy projects_all_own on projects
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Child tables inherit access from the owning project.
do $$
declare
  t text;
begin
  foreach t in array array[
    'project_state_transitions',
    'intake_answers',
    'method_interpretations',
    'drafts',
    'gap_findings'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_via_project', t);
    execute format($f$
      create policy %I on %I
        for all to authenticated
        using (exists (
          select 1 from projects p
          where p.id = %I.project_id and p.owner_id = auth.uid()
        ))
        with check (exists (
          select 1 from projects p
          where p.id = %I.project_id and p.owner_id = auth.uid()
        ))
    $f$, t || '_via_project', t, t, t);
  end loop;
end
$$;

-- consent_events: insert and read your own. No update, no delete, by design.
drop policy if exists consent_events_insert_own on consent_events;
create policy consent_events_insert_own on consent_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists consent_events_select_own on consent_events;
create policy consent_events_select_own on consent_events
  for select to authenticated using (user_id = auth.uid());

-- redaction_events: readable by the owner of the project it relates to. Writes
-- come from the server with the service role, which bypasses RLS, because the
-- gate must not depend on client permissions.
drop policy if exists redaction_events_select_own on redaction_events;
create policy redaction_events_select_own on redaction_events
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from projects p
      where p.id = redaction_events.project_id and p.owner_id = auth.uid()
    )
  );

-- Knowledge base: readable by any signed-in researcher, written only by the
-- ingestion script running with the service role.
drop policy if exists kb_documents_read on kb_documents;
create policy kb_documents_read on kb_documents
  for select to authenticated using (true);

drop policy if exists kb_chunks_read on kb_chunks;
create policy kb_chunks_read on kb_chunks
  for select to authenticated using (true);
