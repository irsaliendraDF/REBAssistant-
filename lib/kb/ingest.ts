import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import { SOURCE_DIR, classify } from './config'
import { chunkText } from './chunk'
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
      .sort()
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

    if (SUPPORTED_TEXT_FORMATS.has(extension)) {
      const chunks = chunkText(bytes.toString('utf8'))
      items.push({
        filename,
        contentHash,
        docType,
        citationLabel,
        status: 'new',
        chunkCount: chunks.length,
      })
      continue
    }

    items.push({
      filename,
      contentHash,
      docType,
      citationLabel,
      status: NEEDS_EXTRACTOR.has(extension) ? 'unsupported_format' : 'unsupported_format',
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
 * Full ingest: extract, chunk, embed, store, update the manifest.
 *
 * Blocked on the two pieces named at the top of this file. It throws rather than
 * partially succeeding, because a knowledge base that silently holds half of
 * TCPS2 is worse than one that holds none of it and says so.
 */
export async function ingestAll(_root = process.cwd()): Promise<never> {
  throw new Error(
    'Full ingest is not wired yet. It needs a PDF and DOCX text extractor, and an embedding API key. ' +
      'Run plan() to see what would be ingested.',
  )
}

export { readManifest, writeManifest, type Manifest }
