// `server-only` throws outside Next's module graph. Ingestion is a script, not a
// request, so the guard is meaningless here and this stands in for it.
export {}
