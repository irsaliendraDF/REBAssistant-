import { CompanionDocuments } from '@/components/companion-documents'
import type { CompanionDocument } from '@/lib/documents/companions'
import type { TemplateAvailability } from '@/lib/documents/templates'

/**
 * Step 6. The end of the workflow inside the tool, and the middle of the work
 * outside it.
 *
 * The download used to be the whole of this screen, which read as "you are
 * finished". A researcher who submits the application on its own gets it back:
 * the Board asks for the consent form, the instrument and the permission letter
 * that the application refers to. So the last screen is the document, and then
 * the list of what has to go with it.
 */
export function CompleteStep({
  projectId,
  documents,
  availability,
}: {
  projectId: string
  documents: CompanionDocument[]
  availability: Record<string, TemplateAvailability>
}) {
  const expected = documents.filter((document) => document.necessity === 'required').length

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-line bg-white p-8 text-center">
        <p className="text-sm font-medium text-ink">Ready for You to Review</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Download the document, check it, complete anything the tool left to you, and submit it
          yourself. Research Ethics Board Assistant does not submit applications and does not decide
          whether research is approved.
        </p>
        <a
          href={`/project/${projectId}/export`}
          className="mt-6 inline-block rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
        >
          Download Draft (.docx)
        </a>
        {expected > 0 ? (
          <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-muted">
            {expected === 1
              ? 'One further document is expected alongside it, listed below and in the download.'
              : `${expected} further documents are expected alongside it, listed below and in the download.`}
          </p>
        ) : null}
      </div>

      <CompanionDocuments
        projectId={projectId}
        documents={documents}
        availability={availability}
      />
    </div>
  )
}
