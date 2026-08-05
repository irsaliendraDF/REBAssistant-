-- Extensions required by the REB Assistant schema.
-- pgcrypto: gen_random_uuid() for primary keys.
-- vector:   pgvector, for knowledge base embedding search.

create extension if not exists pgcrypto;
create extension if not exists vector;
