import { CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } from './config'

export interface Chunk {
  index: number
  content: string
  /** Populated when the chunk sits under a recognisable form section heading. */
  formSection?: string
  /** Page number where the chunk starts, when the extractor supplies page breaks. */
  pageNumber?: number
}

/**
 * Splits on paragraph boundaries first, falling back to sentences, so a chunk
 * rarely ends mid-thought. Overlap carries the tail of one chunk into the next,
 * because an article's meaning often depends on the sentence before it.
 */
export function chunkText(
  text: string,
  options: { targetChars?: number; overlapChars?: number } = {},
): Chunk[] {
  const target = options.targetChars ?? CHUNK_TARGET_CHARS
  const overlap = options.overlapChars ?? CHUNK_OVERLAP_CHARS

  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chunks: Chunk[] = []
  let buffer = ''
  let currentSection: string | undefined

  const flush = () => {
    const content = buffer.trim()
    if (!content) return
    chunks.push({ index: chunks.length, content, formSection: currentSection })
    buffer = overlap > 0 ? content.slice(-overlap) : ''
  }

  for (const paragraph of paragraphs) {
    const heading = detectFormSection(paragraph)
    if (heading) {
      // A new form section starts a new chunk, so a chunk never straddles two
      // sections and mis-cites one as the other.
      flush()
      buffer = ''
      currentSection = heading
    }

    if (buffer.length + paragraph.length + 2 > target && buffer.trim().length > 0) {
      flush()
    }

    buffer += (buffer ? '\n\n' : '') + paragraph
  }

  flush()
  return chunks
}

/**
 * Recognises Dalhousie form headings such as "2.7.5 Will data be stored
 * outside Canada?" so chunks can be cited to a section rather than a page.
 */
export function detectFormSection(paragraph: string): string | undefined {
  const match = paragraph.match(/^\s*(\d{1,2}(?:\.\d{1,2}){0,2})[.)\s]\s*[A-Z]/)
  return match ? match[1] : undefined
}
