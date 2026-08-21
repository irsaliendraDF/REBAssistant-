import 'server-only'

import { existsSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

import { readManifest } from '@/lib/kb/manifest'

/**
 * Whether a template can actually be handed to the researcher, here, now.
 *
 * Two different questions, and the interface has to tell them apart:
 *
 *   `known`       the manifest says this document has been ingested, so the tool
 *                 can name it accurately and cite it.
 *   `downloadable` the file itself is on this machine, so it can be served.
 *
 * They come apart on Vercel. The source documents are client material and are
 * gitignored, so a deployment has the manifest and none of the files behind it.
 * Naming a template the researcher can then fetch from the Research Ethics
 * Office is useful; a download link that 404s is worse than no link, so the
 * interface only offers one where the file is genuinely there.
 */

export interface TemplateAvailability {
  filename: string
  known: boolean
  downloadable: boolean
}

function templatePath(filename: string): string {
  // The two path segments are written out rather than taken from `SOURCE_DIR`,
  // which is the same directory. The bundler reads this statically to work out
  // what to trace, and a constant it cannot follow makes it trace the entire
  // project into the deployment. They are checked against each other in
  // templates.test.ts, so the two cannot drift apart silently.
  //
  // basename strips any traversal before it reaches the filesystem. The manifest
  // lookup in the callers is the real allowlist; this is the belt.
  return resolve(process.cwd(), 'knowledge-base', 'source', basename(filename))
}

export async function templateAvailability(
  filenames: string[],
): Promise<Map<string, TemplateAvailability>> {
  const manifest = await readManifest()
  const ingested = new Set(manifest.documents.map((entry) => entry.filename))

  return new Map(
    filenames.map((filename) => [
      filename,
      {
        filename,
        known: ingested.has(filename),
        downloadable: existsSync(templatePath(filename)),
      },
    ]),
  )
}

/**
 * Resolves a request for a template to a path, or to null.
 *
 * Null covers every failure the same way on purpose: unknown to the manifest,
 * absent from disk, or an attempt at a path that was never a template. The
 * caller has nothing useful to say about which, and saying which would tell a
 * caller probing the route what exists.
 */
export async function resolveTemplate(
  filename: string,
): Promise<{ path: string; contentType: string; label: string } | null> {
  const manifest = await readManifest()
  const entry = manifest.documents.find((document) => document.filename === filename)
  if (!entry) return null

  const path = templatePath(filename)
  if (!existsSync(path)) return null

  return { path, contentType: contentTypeFor(filename), label: entry.citationLabel }
}

function contentTypeFor(filename: string): string {
  switch (extname(filename).toLowerCase()) {
    case '.pdf':
      return 'application/pdf'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.doc':
      return 'application/msword'
    default:
      return 'application/octet-stream'
  }
}
