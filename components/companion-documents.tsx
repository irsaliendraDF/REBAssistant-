import Link from 'next/link'

import type { CompanionDocument, Necessity } from '@/lib/documents/companions'
import type { TemplateAvailability } from '@/lib/documents/templates'

/**
 * What still has to be written, once the application itself is drafted.
 *
 * The list is built from the researcher's own answers, so every entry can say
 * why it is there. That is what separates this from the appendix checklist
 * printed on the form: the form lists everything any study might need, and a
 * researcher reading it has to work out which lines are about them.
 *
 * Guardrail 6 again. "Required" here means the form or the Board asks for it,
 * not that this tool has decided the study is incomplete without it, and the
 * closing line says the Research Ethics Office is the authority on what a
 * particular submission needs.
 *
 * Templates are named whether or not they can be downloaded. On a deployment
 * without the source documents the researcher still learns which Dalhousie
 * template covers this document, which is the part they cannot work out alone.
 */

const NECESSITY_LABELS: Record<Necessity, string> = {
  required: 'Expected',
  likely: 'Likely needed',
  consider: 'Worth considering',
}

const NECESSITY_STYLES: Record<Necessity, string> = {
  required: 'bg-alert-soft text-alert',
  likely: 'bg-lime-soft text-ink',
  consider: 'bg-surface-2 text-muted',
}

export function CompanionDocuments({
  projectId,
  documents,
  availability,
}: {
  projectId: string
  documents: CompanionDocument[]
  /** Keyed by template filename. Missing means the tool knows of no template. */
  availability: Record<string, TemplateAvailability>
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center">
        <p className="text-sm font-medium text-ink">No Companion Documents Identified</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Your answers did not describe recruitment, consent or an instrument in enough detail for
          this list to be built. Section 3 of the form lists the appendices a submission can need.
          Go through it with the Research Ethics Office.
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Documents to Prepare Alongside This</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The application is not the whole submission. These are the appendices your answers point
          at, each with what it has to contain. Research Ethics Board Assistant does not write them:
          the Board reads the wording participants are actually given, and that wording is yours.
        </p>
      </div>

      <ul className="space-y-3">
        {documents.map((document) => (
          <li key={document.id} className="rounded-lg border border-line bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${NECESSITY_STYLES[document.necessity]}`}
              >
                {NECESSITY_LABELS[document.necessity]}
              </span>
              {document.formSection ? (
                <Link
                  href={`/project/${projectId}?section=${encodeURIComponent(document.formSection)}`}
                  className="font-mono text-xs text-muted underline-offset-4 hover:underline"
                >
                  Section {document.formSection}
                </Link>
              ) : null}
              {document.routedToHuman ? (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-muted">
                  Not drafted by this tool
                </span>
              ) : null}
            </div>

            <h3 className="mt-3 text-sm font-medium text-ink">{document.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{document.why}</p>

            <ul className="mt-3 space-y-1.5 border-l-2 border-line pl-4">
              {document.checklist.map((line, index) => (
                <li key={index} className="text-sm leading-relaxed text-muted">
                  {line}
                </li>
              ))}
            </ul>

            <TemplateLine document={document} availability={availability} />

            <p className="mt-3 text-xs text-faint">Appendix: {document.appendix}</p>
          </li>
        ))}
      </ul>

      <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
        This list is built from your answers by rule, not by a model, so it reflects what you told
        the tool and nothing beyond it. It is not a complete account of what your submission needs.
        The Research Ethics Office is.
      </p>
    </section>
  )
}

function TemplateLine({
  document,
  availability,
}: {
  document: CompanionDocument
  availability: Record<string, TemplateAvailability>
}) {
  if (!document.templateFilename || !document.templateLabel) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-muted">
        There is no Dalhousie template for this one. It is written from your own study.
      </p>
    )
  }

  const status = availability[document.templateFilename]

  if (status?.downloadable) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-muted">
        <a
          href={`/templates/${encodeURIComponent(document.templateFilename)}`}
          className="font-medium text-forest underline underline-offset-4"
        >
          Open the template
        </a>{' '}
        {document.templateLabel}.
      </p>
    )
  }

  return (
    <p className="mt-3 text-xs leading-relaxed text-muted">
      Template: {document.templateLabel}. It is not available to download here, so ask the Research
      Ethics Office for the current version rather than working from an old copy.
    </p>
  )
}
