import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import { createAdminClient } from '@/lib/supabase/admin'

import { SOURCE_DIR, classify } from './config'
import { chunkText, detectFormSection } from './chunk'
import { extractDocument } from './extract'
import { splitGuidanceBySection } from './sections'
import { hashContent } from './hash'
import { type Manifest, isAlreadyIngested, readManifest, writeManifest } from './manifest'

/**
 * Knowledge base ingestion.
 *
 * Re-runnable and incremental by design, because the source documents arrive in
 * batches rather than all at once. Running it twice over the same folder does
 * nothing the second time; running it after dropping in a new file ingests only
 * that file.
 *
 * De-duplication is on content hash, not filename, since several delivered files
 * are `-2` copies of documents already present.
 *
 * NOT YET WIRED, and deliberately so. Two pieces arrive later in the build:
 *
 *   1. Text extraction for .pdf and .docx. Needs a parsing dependency, which the
 *      brief says to ask about before installing.
 *   2. Embedding generation, which needs an API key that has not been issued.
 *
 * Everything either side of those two gaps is real: the scan, the hashing, the
 * de-duplication, the chunking, and the manifest write. `plan()` runs today and
 * reports exactly what a full ingest would do.
 */

export interface IngestPlanItem {
  filename: string
  contentHash: string
  docType: string
  citationLabel: string
  status: 'new' | 'already_ingested' | 'duplicate_content' | 'unsupported_format'
  chunkCount?: number
  duplicateOfFilename?: string
}

export interface IngestPlan {
  scannedAt: string
  sourceDir: string
  items: IngestPlanItem[]
  newDocuments: number
  skippedDuplicates: number
}

const SUPPORTED_TEXT_FORMATS = new Set(['.txt', '.md'])
const NEEDS_EXTRACTOR = new Set(['.pdf', '.docx', '.doc'])

/**
 * Scans the source folder and reports what a full ingest would do, without
 * touching the database or calling an embedding API. Safe to run at any time.
 */
export async function plan(root = process.cwd()): Promise<IngestPlan> {
  const sourcePath = resolve(root, SOURCE_DIR)
  const manifest = await readManifest(root)

  let filenames: string[] = []
  try {
    filenames = (await readdir(sourcePath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      // Canonical names before their `-2` copies. De-duplication keeps whichever
      // is seen first, and the winner's filename becomes the citation a Board
      // reads. "confidentiality-agreement-template-2" is not what that document
      // is called.
      .sort((a, b) => {
        const suffixed = Number(isNumberedCopy(a)) - Number(isNumberedCopy(b))
        return suffixed !== 0 ? suffixed : a.localeCompare(b)
      })
  } catch {
    // Folder does not exist yet, which is the normal state before the first drop.
    filenames = []
  }

  const seenHashes = new Map<string, string>()
  const items: IngestPlanItem[] = []

  for (const filename of filenames) {
    const bytes = await readFile(resolve(sourcePath, filename))
    const contentHash = hashContent(bytes)
    const { docType, citationLabel } = classify(filename)
    const extension = extname(filename).toLowerCase()

    const firstSeen = seenHashes.get(contentHash)
    if (firstSeen) {
      items.push({
        filename,
        contentHash,
        docType,
        citationLabel,
        status: 'duplicate_content',
        duplicateOfFilename: firstSeen,
      })
      continue
    }
    seenHashes.set(contentHash, filename)

    if (isAlreadyIngested(manifest, contentHash)) {
      items.push({ filename, contentHash, docType, citationLabel, status: 'already_ingested' })
      continue
    }

    if (SUPPORTED_TEXT_FORMATS.has(extension) || NEEDS_EXTRACTOR.has(extension)) {
      const chunks = SUPPORTED_TEXT_FORMATS.has(extension)
        ? chunkText(bytes.toString('utf8'))
        : []
      items.push({
        filename,
        contentHash,
        docType,
        citationLabel,
        status: 'new',
        // Only known without extracting, which plan() deliberately does not do.
        chunkCount: chunks.length || undefined,
      })
      continue
    }

    items.push({
      filename,
      contentHash,
      docType,
      citationLabel,
      status: 'unsupported_format',
    })
  }

  return {
    scannedAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    items,
    newDocuments: items.filter((item) => item.status === 'new').length,
    skippedDuplicates: items.filter((item) => item.status === 'duplicate_content').length,
  }
}

/**
 * Full ingest: extract, split, store, update the manifest.
 *
 * Writes with the service role client, because `kb_documents` and `kb_chunks`
 * are readable by signed-in researchers and writable by nobody. Ingestion is not
 * something the application does; it is something a maintainer does, from a
 * machine, when the guidance changes.
 *
 * No embeddings are generated. Guidance is retrieved by form section, which is
 * printed in the document rather than inferred from a similarity score. See
 * `lib/kb/sections.ts` and `docs/decisions.md`.
 */
export interface IngestResult {
  documentsIngested: number
  chunksWritten: number
  sectionsMapped: number
  skipped: { filename: string; reason: string }[]
}

export async function ingestAll(root = process.cwd()): Promise<IngestResult> {
  const supabase = createAdminClient()
  if (!supabase) {
    throw new Error(
      'Ingestion needs SUPABASE_SERVICE_ROLE_KEY. It writes to tables that row level ' +
        'security makes read-only for everyone else.',
    )
  }

  const sourcePath = resolve(root, SOURCE_DIR)
  const manifest = await readManifest(root)
  const plannedRun = await plan(root)

  const result: IngestResult = {
    documentsIngested: 0,
    chunksWritten: 0,
    sectionsMapped: 0,
    skipped: [],
  }

  for (const item of plannedRun.items) {
    if (item.status === 'already_ingested' || item.status === 'duplicate_content') {
      result.skipped.push({ filename: item.filename, reason: item.status })
      continue
    }

    let extracted
    try {
      extracted = await extractDocument(resolve(sourcePath, item.filename))
    } catch (error) {
      result.skipped.push({
        filename: item.filename,
        reason: error instanceof Error ? error.message : 'extraction failed',
      })
      continue
    }

    const { data: document, error: documentError } = await supabase
      .from('kb_documents')
      .upsert(
        {
          title: item.filename.replace(/\.[^.]+$/, ''),
          source_path: item.filename,
          content_hash: item.contentHash,
          doc_type: item.docType,
          citation_label: item.citationLabel,
          page_count: extracted.pageCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'content_hash' },
      )
      .select('id')
      .single()

    if (documentError || !document) {
      throw new Error(`Could not store ${item.filename}: ${documentError?.message ?? 'no row'}`)
    }

    const documentId = (document as { id: string }).id

    // Replace rather than append, so re-ingesting a corrected document does not
    // leave the old text alongside the new for retrieval to pick between.
    const { error: clearError } = await supabase
      .from('kb_chunks')
      .delete()
      .eq('document_id', documentId)
    if (clearError) throw new Error(`Could not clear old chunks: ${clearError.message}`)

    const chunks = buildChunks(item.docType, item.citationLabel, extracted.text)

    const { error: chunkError } = await supabase.from('kb_chunks').insert(
      chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk.content,
        citation: chunk.citation,
        form_section: chunk.formSection ?? null,
        embedding: null,
      })),
    )
    if (chunkError) throw new Error(`Could not store chunks: ${chunkError.message}`)

    manifest.documents = manifest.documents.filter(
      (entry) => entry.contentHash !== item.contentHash,
    )
    manifest.documents.push({
      contentHash: item.contentHash,
      filename: item.filename,
      title: item.filename.replace(/\.[^.]+$/, ''),
      docType: item.docType,
      citationLabel: item.citationLabel,
      chunkCount: chunks.length,
      ingestedAt: new Date().toISOString(),
    })

    result.documentsIngested += 1
    result.chunksWritten += chunks.length
    result.sectionsMapped += chunks.filter((chunk) => chunk.formSection).length
  }

  await writeManifest(manifest, root)
  return result
}

interface BuiltChunk {
  content: string
  citation: string
  formSection?: string
}

/**
 * The guidelines document is the one that maps onto the form, so it is split by
 * section number and every chunk carries the section it belongs to. Everything
 * else is chunked by size, and a section is attached only where the text names
 * one itself.
 */
function buildChunks(docType: string, citationLabel: string, text: string): BuiltChunk[] {
  if (docType === 'guideline') {
    const sections = splitGuidanceBySection(text)
    if (sections.length > 0) {
      return sections.map((section) => ({
        content: section.text,
        citation: `${citationLabel}, s. ${section.formSection} ${section.heading}`,
        formSection: section.formSection,
      }))
    }
    // A guidance document with no numbered sections still belongs in the base;
    // it just cannot be routed to one.
  }

  return chunkText(text).map((chunk, index) => ({
    content: chunk.content,
    citation: `${citationLabel}, part ${index + 1}`,
    // The chunker already reports a heading it recognised. Fall back to reading
    // the text only where it did not.
    formSection: chunk.formSection ?? detectFormSection(chunk.content),
  }))
}

export { readManifest, writeManifest, type Manifest }

/** True for the `-2` style duplicates several source documents arrive as. */
function isNumberedCopy(filename: string): boolean {
  return /-\d+\.[^.]+$/.test(filename)
}
