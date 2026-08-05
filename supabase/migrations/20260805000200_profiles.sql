-- profiles
--
-- Tombstone data: the researcher details that persist across projects and get
-- reused on the next application. This table is what makes the reuse promise in
-- the deck true. One row per user.
--
-- id matches the authenticated user id. The foreign key to auth.users is added
-- separately in 20260805001000_auth_link.sql so this file stays portable to a
-- plain Postgres instance.

create table if not exists profiles (
  id                      uuid primary key,
  full_name               text,
  email                   text,
  role                    text,          -- e.g. Principal Investigator, Co-Investigator, Student
  department              text,
  institution             text not null default 'Dalhousie University',
  -- Phase 1 populates institution with a single value. The column exists so a
  -- multi-institution Phase 3 is a data change rather than a schema rewrite.
  core_certificate_status text,          -- TCPS 2: CORE tutorial completion
  core_certificate_date   date,
  phone                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table profiles is
  'Researcher tombstone data reused across projects. Contains researcher details only. Never participant data.';

create index if not exists profiles_email_idx on profiles (email);
