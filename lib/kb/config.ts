/**
 * Knowledge base configuration.
 *
 * EMBEDDING_DIMENSION must match the `vector(...)` column in
 * supabase/migrations/20260805000800_knowledge_base.sql. Changing it means a
 * migration and a full re-ingest, so it is stated in exactly two places and
 * nowhere else.
 */

export const EMBEDDING_DIMENSION = 1024

/** Source documents live here. Gitignored: they are client material. */
export const SOURCE_DIR = 'knowledge-base/source'

/** Record of what has been ingested and when. Committed. */
export const MANIFEST_PATH = 'knowledge-base/manifest.json'

/**
 * Chunking. Guidance documents like TCPS2 reward slightly larger chunks with
 * generous overlap, because an article's meaning often depends on the sentence
 * before it.
 */
export const CHUNK_TARGET_CHARS = 1800
export const CHUNK_OVERLAP_CHARS = 250

export type DocType = 'form' | 'template' | 'guideline' | 'tcps2' | 'test_material' | 'other'

/**
 * How a filename maps to a document type and a citation label. Matched in order,
 * first match wins. Extend as more source documents arrive.
 */
export const DOC_TYPE_RULES: { match: RegExp; docType: DocType; citationLabel: string }[] = [
  {
    match: /application-human-ethics-prospective-research/i,
    docType: 'form',
    citationLabel: 'Dalhousie Research Ethics Board application form (prospective research)',
  },
  {
    match: /reb-application-guidelines/i,
    docType: 'guideline',
    citationLabel: 'Dalhousie Research Ethics Board application guidelines',
  },
  { match: /^consent-form/i, docType: 'template', citationLabel: 'Consent form template' },
  {
    match: /confidentiality-agreement/i,
    docType: 'template',
    citationLabel: 'Confidentiality agreement template',
  },
  {
    match: /hints-for-research-recruitment/i,
    docType: 'template',
    citationLabel: 'Recruitment message guidance',
  },
  { match: /tcps/i, docType: 'tcps2', citationLabel: 'TCPS 2' },
  {
    match: /retrofit|braindump|future\s*civics/i,
    docType: 'test_material',
    citationLabel: 'Test material (not guidance)',
  },
]

export function classify(filename: string): { docType: DocType; citationLabel: string } {
  for (const rule of DOC_TYPE_RULES) {
    if (rule.match.test(filename)) {
      return { docType: rule.docType, citationLabel: rule.citationLabel }
    }
  }
  return { docType: 'other', citationLabel: filename }
}
