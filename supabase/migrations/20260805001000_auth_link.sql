-- SUPABASE ONLY. Requires the auth schema, so this will fail against a bare
-- Postgres. That is intentional: everything above this file is portable, and the
-- Supabase-specific wiring lives here and in the RLS migration.
--
-- Links the application tables to Supabase Auth users.

alter table profiles
  drop constraint if exists profiles_id_fkey;
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table projects
  drop constraint if exists projects_owner_id_fkey;
alter table projects
  add constraint projects_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete cascade;

alter table consent_events
  drop constraint if exists consent_events_user_id_fkey;
alter table consent_events
  add constraint consent_events_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Create a profile row on sign up so tombstone data has somewhere to land from
-- the first session.
create or replace function handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user ();
