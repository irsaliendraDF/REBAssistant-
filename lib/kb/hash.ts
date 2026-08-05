import { createHash } from 'node:crypto'

/**
 * Documents are identified by content hash, not filename.
 *
 * Several of the delivered source files arrive as `-2` duplicates under
 * different filenames but with identical contents. De-duplicating on filename
 * would ingest each of them twice and double the weight of that guidance in
 * every retrieval.
 */
export function hashContent(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}
