-- Knowledge base: source documents and their embedded chunks.
--
-- Source material is the Dalhousie REB form, its consent and recruitment
-- templates, the application guidelines, and TCPS2. Chunks carry a citation back
-- to their source document and location so the app can always say where a piece
-- of guidance came from.
--
-- Documents are identified by content hash, not filename. Several of the
-- delivered files arrive as '-2' duplicates, so de-duplication has to happen on
-- content.
--
-- EMBEDDING DIMENSION: 1024. This must match the model configured in
-- lib/kb/config.ts. Changing it later is a migration and a full re-ingest, so it
-- is set in exactly these two places and nowhere else.

create table if not exists kb_documents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  source_path    text not null,        -- path within knowledge-base/source/
  content_hash   text not null unique, -- sha256 of file bytes, the de-dup key
  doc_type       text,                 -- form | template | guideline | tcps2 | other
  citation_label text,                 -- how this document is cited to the user
  page_count     integer,
  ingested_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on column kb_documents.content_hash is
  'sha256 of the file contents. De-duplication key, because some source files arrive as -2 duplicates under different filenames.';

create table if not exists kb_chunks (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references kb_documents (id) on delete cascade,
  chunk_index    integer not null,
  content        text not null,
  token_count    integer,

  -- Citation payload. Every chunk can name its own source.
  citation       text,                 -- e.g. 'TCPS2 Article 5.1' or 'Dalhousie REB form, s. 2.7.5'
  page_number    integer,
  form_section   text,                 -- populated where a chunk maps to a form section

  embedding      vector(1024),
  created_at     timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create index if not exists kb_chunks_document_idx on kb_chunks (document_id);
create index if not exists kb_chunks_section_idx on kb_chunks (form_section);

-- Cosine similarity search index. Built now so retrieval is fast from the first
-- ingest; HNSW handles an empty table fine.
create index if not exists kb_chunks_embedding_idx
  on kb_chunks using hnsw (embedding vector_cosine_ops);

-- Retrieval helper. Returns chunks with their citation attached, so a caller can
-- never end up with guidance text and no way to attribute it.
create or replace function match_kb_chunks (
  query_embedding vector(1024),
  match_count     integer default 8,
  min_similarity  float default 0.0
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  content      text,
  citation     text,
  page_number  integer,
  form_section text,
  doc_title    text,
  similarity   float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.citation,
    c.page_number,
    c.form_section,
    d.title,
    1 - (c.embedding <=> query_embedding) as similarity
  from kb_chunks c
  join kb_documents d on d.id = c.document_id
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

alter table gap_findings
  drop constraint if exists gap_findings_kb_chunk_fk;
alter table gap_findings
  add constraint gap_findings_kb_chunk_fk
  foreign key (kb_chunk_id) references kb_chunks (id) on delete set null;
