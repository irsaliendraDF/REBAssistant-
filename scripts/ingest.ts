import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Loads the knowledge base into Supabase.
 *
 *   npm run ingest
 *
 * Re-runnable. A document already ingested is skipped on content hash, so
 * running it twice does nothing the second time and running it after correcting
 * one document re-ingests only that one.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, which is deliberately blank in `.env.local`.
 * Ingestion is the only job in this project that writes to tables row level
 * security makes read-only, so it is the only job that needs it. Paste it in,
 * run this, and blank it again.
 */

// Vite only exposes VITE_-prefixed variables, and none of these are prefixed
// because the application reads them through Next. Loaded by hand instead.
function loadEnv(): void {
  let raw = ''
  try {
    raw = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf8')
  } catch {
    return
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (value) process.env[match[1]] ??= value
  }
}

loadEnv()

const { ingestAll, plan } = await import('../lib/kb/ingest')

const dryRun = process.argv.includes('--plan')

if (dryRun) {
  const planned = await plan()
  console.log(`Scanned ${planned.sourceDir}: ${planned.items.length} files\n`)
  for (const item of planned.items) {
    console.log(`  ${item.status.padEnd(18)} ${item.filename}`)
  }
  console.log(`\n${planned.newDocuments} to ingest, ${planned.skippedDuplicates} duplicates.`)
} else {
  const result = await ingestAll()
  console.log(`Ingested ${result.documentsIngested} documents.`)
  console.log(`${result.chunksWritten} chunks written, ${result.sectionsMapped} mapped to a form section.`)
  for (const skip of result.skipped) {
    console.log(`  skipped  ${skip.filename}: ${skip.reason}`)
  }
}
