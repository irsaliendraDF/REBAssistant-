import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Retrieval.
 *
 * Every result carries its citation, because guidance the app cannot attribute
 * is guidance the researcher cannot check. The `match_kb_chunks` function in the
 * knowledge base migration joins the citation on for exactly this reason: there
 * is no query path that returns chunk text without its source.
 */

export interface RetrievedChunk {
  chunkId: string
  documentId: string
  content: string
  citation: string | null
  pageNumber: number | null
  formSection: string | null
  docTitle: string
  similarity: number
}

export async function retrieve(
  queryEmbedding: number[],
  options: { matchCount?: number; minSimilarity?: number } = {},
): Promise<RetrievedChunk[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: queryEmbedding,
    match_count: options.matchCount ?? 8,
    min_similarity: options.minSimilarity ?? 0,
  })

  if (error) {
    throw new Error(`Knowledge base retrieval failed: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      chunk_id: string
      document_id: string
      content: string
      citation: string | null
      page_number: number | null
      form_section: string | null
      doc_title: string
      similarity: number
    }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      citation: row.citation,
      pageNumber: row.page_number,
      formSection: row.form_section,
      docTitle: row.doc_title,
      similarity: row.similarity,
    }),
  )
}

/**
 * Formats retrieved guidance for inclusion in a prompt, with citations attached
 * so the model's output can name its source rather than assert from nowhere.
 */
export function formatForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const source = chunk.citation ?? chunk.docTitle
      const page = chunk.pageNumber ? `, p. ${chunk.pageNumber}` : ''
      return `[${index + 1}] ${source}${page}\n${chunk.content}`
    })
    .join('\n\n---\n\n')
}
