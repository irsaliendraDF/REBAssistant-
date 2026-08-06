import Link from 'next/link'

import { advanceWorkflow } from '@/app/project/[id]/actions'
import { countBySeverity, type GapFinding, type GapSeverity } from '@/lib/gaps/analyse'

/**
 * Step 5. What looks missing, thin or worth another look.
 *
 * Guardrail 6 shapes the whole screen. Nothing here blocks the researcher, and
 * nothing here passes judgement. There is no score, no traffic light, and no
 * "ready to submit" claim, because every one of those would be read as a verdict
 * the tool is not entitled to give. Continuing is always available, including
 * with findings outstanding, because the Board decides what matters and the
 * researcher decides what to act on.
 */
export function GapAnalysisStep({
  projectId,
  findings,
  modelConnected,
}: {
  projectId: string
  findings: GapFinding[]
  modelConnected: boolean
}) {
  const counts = countBySeverity(findings)

  return (
    <div className="space-y-6">
      {!modelConnected ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
          <span className="font-medium">These are rule-based checks.</span> They catch missing
          sections, brief answers, and answers that contradict each other. Once TCPS2 is loaded, the
          findings will also cite the specific guidance behind them, and a model will look for the
          things a rule cannot anticipate.
        </p>
      ) : null}

      {findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
          <p className="text-sm font-medium text-ink">Nothing Flagged</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            These checks did not find anything to raise. That is not the same as the application
            being complete or approvable, which is the Board’s judgement, not this tool’s.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Count label="not complete" value={counts.missing} />
            <Count label="worth reviewing" value={counts.worth_reviewing} />
            <Count label="brief" value={counts.thin} />
          </div>

          <ul className="space-y-3">
            {findings.map((finding, index) => (
              <li
                key={index}
                className="rounded-lg border border-line bg-white p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  {finding.formSection ? (
                    <Link
                      href={`/project/${projectId}?section=${encodeURIComponent(finding.formSection)}`}
                      className="font-mono text-xs text-muted underline-offset-4 hover:underline"
                    >
                      Section {finding.formSection}
                    </Link>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-ink">{finding.finding}</p>

                {finding.tcps2Reference ? (
                  <p className="mt-2 text-xs text-muted">{finding.tcps2Reference}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <form action={advanceWorkflow} className="border-t border-line pt-6">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value="complete" />
        <button
          type="submit"
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
        >
          Mark as Ready to Review
        </button>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
          You can continue with findings outstanding. These are observations for you to weigh, not
          conditions to satisfy.
        </p>
      </form>
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-line bg-white px-3 py-1.5 text-muted">
      <span className="font-medium text-ink">{value}</span> {label}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: GapSeverity }) {
  const styles: Record<GapSeverity, string> = {
    missing: 'bg-alert-soft text-alert',
    worth_reviewing: 'bg-lime-soft text-ink',
    thin: 'bg-surface-2 text-muted',
  }

  const labels: Record<GapSeverity, string> = {
    missing: 'Not complete',
    worth_reviewing: 'Worth reviewing',
    thin: 'Brief',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${styles[severity]}`}>
      {labels[severity]}
    </span>
  )
}
