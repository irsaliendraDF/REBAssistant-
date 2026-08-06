-- Additional tombstone fields, found by validating against the real form.
--
-- Section 1.1 of application-human-ethics-prospective-research.docx requires a
-- Banner number and a ROMEO Researcher Portal attestation for the submission to
-- be accepted by the Board at all. Both are stable per researcher, so they
-- belong in the profile and are reused rather than retyped.
--
-- Affiliation is the Section 1.1 list (Faculty, PhD Student, Staff, and so on),
-- which the form asks for as a checkbox and which also decides whether the
-- supervisor block in 1.2 applies.
--
-- Still researcher details only. Nothing here is participant data.

alter table profiles add column if not exists banner_number text;
alter table profiles add column if not exists romeo_registered boolean not null default false;
alter table profiles add column if not exists affiliation text;

comment on column profiles.banner_number is
  'Dalhousie Banner number. Required by form section 1.1.';
comment on column profiles.romeo_registered is
  'ROMEO Researcher Portal attestation. The form is not accepted without it.';
