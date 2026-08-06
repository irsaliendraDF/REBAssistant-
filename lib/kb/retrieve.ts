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

/**
 * Guidance for one form section, routed by number rather than by similarity.
 *
 * Deliberately narrow on document type. Verification after the first ingest
 * found section 2.4 being answered by the application form itself: the form
 * carries the same headings, so its size-based chunks were tagged with the same
 * section numbers, and a query on `form_section` alone returned whichever row
 * came back first. The form's own wording is the question. The guidelines are
 * the answer to what a Board expects. Handing a model the question and calling
 * it guidance is how a draft ends up restating the prompt.
 *
 * The exact-match filter matters for the same reason. Sub-points arrive as their
 * own numbers when a document is chunked by size, so a prefix match on '2.1'
 * would also drag in '2.15'.
 */
export interface SectionGuidanceChunk {
  content: string
  citation: string | null
  docTitle: string
}

export async function guidanceForSection(
  formSection: string,
  options: { docTypes?: string[] } = {},
): Promise<SectionGuidanceChunk[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('kb_chunks')
    .select('content, citation, chunk_index, kb_documents!inner(title, doc_type)')
    .eq('form_section', formSection)
    .in('kb_documents.doc_type', options.docTypes ?? ['guideline'])
    .order('chunk_index', { ascending: true })

  // Guidance is an enhancement, not a precondition. A knowledge base that is
  // unreachable must not stop a researcher drafting: they lose the Board's notes,
  // not the tool.
  if (error) return []

  return (data ?? []).map((row) => {
    const document = row.kb_documents as unknown as { title: string; doc_type: string }
    return {
      content: row.content as string,
      citation: row.citation as string | null,
      docTitle: document?.title ?? 'Knowledge base',
    }
  })
}
