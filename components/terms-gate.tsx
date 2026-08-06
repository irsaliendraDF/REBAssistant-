import { acceptAppTerms } from '@/app/dashboard/actions'
import { APP_TERMS_DISCLOSURE } from '@/lib/disclosure/text'

/**
 * Guardrail 8, surface (a), and guardrail 7's logging requirement.
 *
 * This blocks the dashboard rather than sitting above it. The disclosure says
 * what the researcher types is sent to a model outside Canada, and that is not
 * something to mention beside a "Start a New Application" button they can press
 * first. There is no dismiss and no "later": the only way past is to accept,
 * because the alternative is using a tool whose terms you have not seen.
 *
 * The accepted text is stored verbatim on the consent record, not a version
 * number, so what a researcher agreed to can be reconstructed after the wording
 * is replaced. It will be replaced: this text is a placeholder pending review by
 * the research ethics team.
 */
export function TermsGate() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Before You Start</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          How this tool uses what you type, in full. Please read it: some of it constrains what you
          should enter.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white p-6">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">
          {APP_TERMS_DISCLOSURE}
        </p>
      </div>

      <form action={acceptAppTerms} className="space-y-3">
        <button
          type="submit"
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
        >
          I Have Read This and I Agree
        </button>
        <p className="text-xs leading-relaxed text-muted">
          Your agreement is recorded, along with the exact wording shown above, so it can be
          produced later if anyone asks what you were told.
        </p>
      </form>
    </div>
  )
}
