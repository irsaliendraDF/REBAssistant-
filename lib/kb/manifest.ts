import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { MANIFEST_PATH } from './config'

/**
 * The manifest records what has been ingested and when, so ingestion can be
 * re-run incrementally as the remaining source documents arrive. It is committed
 * to the repo, which also makes it the human-readable answer to "what does the
 * knowledge base actually contain right now".
 */

export interface ManifestEntry {
  contentHash: string
  filename: string
  title: string
  docType: string
  citationLabel: string
  chunkCount: number
  ingestedAt: string
  /** Filenames seen with this same content hash, for example the `-2` duplicates. */
  duplicateOf?: string[]
}

export interface Manifest {
  version: 1
  updatedAt: string | null
  documents: ManifestEntry[]
}

export const EMPTY_MANIFEST: Manifest = {
  version: 1,
  updatedAt: null,
  documents: [],
}

export async function readManifest(root = process.cwd()): Promise<Manifest> {
  try {
    const raw = await readFile(resolve(root, MANIFEST_PATH), 'utf8')
    return JSON.parse(raw) as Manifest
  } catch {
    return { ...EMPTY_MANIFEST, documents: [] }
  }
}

export async function writeManifest(manifest: Manifest, root = process.cwd()): Promise<void> {
  const payload: Manifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    documents: [...manifest.documents].sort((a, b) => a.filename.localeCompare(b.filename)),
  }
  await writeFile(resolve(root, MANIFEST_PATH), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function isAlreadyIngested(manifest: Manifest, contentHash: string): boolean {
  return manifest.documents.some((entry) => entry.contentHash === contentHash)
}
