import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

/**
 * Text extraction for the source documents.
 *
 * `unpdf` and `mammoth` are devDependencies and are loaded dynamically, on
 * purpose. Ingestion runs once, locally, and writes its results to Postgres; the
 * deployed application only ever reads rows. A static import here would pull a
 * PDF parser into the serverless bundle to sit there unused for the life of the
 * project, and would break the production build the day someone prunes
 * devDependencies.
 */

export interface ExtractedDocument {
  text: string
  /** Pages, where the format has them. Null for word processor formats. */
  pageCount: number | null
}

export class UnsupportedFormatError extends Error {
  constructor(extension: string) {
    super(`No text extractor for ${extension || 'files without an extension'}`)
    this.name = 'UnsupportedFormatError'
  }
}

export async function extractDocument(path: string): Promise<ExtractedDocument> {
  const extension = extname(path).toLowerCase()

  if (extension === '.pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(path)))
    const { text } = await extractText(pdf, { mergePages: true })
    return { text: normalise(String(text)), pageCount: pdf.numPages }
  }

  if (extension === '.docx') {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ path })
    return { text: normalise(value), pageCount: null }
  }

  if (extension === '.txt' || extension === '.md') {
    return { text: normalise(await readFile(path, 'utf8')), pageCount: null }
  }

  // .doc, the pre-2007 binary format, is not handled. One file may arrive in it;
  // converting that one by hand is cheaper than carrying a parser for it.
  throw new UnsupportedFormatError(extension)
}

/**
 * Extractors leave non-breaking spaces, carriage returns and long runs of blank
 * lines behind. Left alone these reach the model as tokens that mean nothing and
 * reach a citation as whitespace nobody can see but everybody can mismatch on.
 */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
