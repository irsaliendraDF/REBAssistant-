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
 *
 * The counts are filters. Eighteen findings in one list is a wall; taking the
 * five incomplete sections first, finishing them, then looking at the rest is
 * how people actually work through a list this long. Filtering is a query
 * parameter rather than client state, so a filtered view survives a reload, can
 * be left open in a tab, and can be sent to a supervisor as a link.
 */

const SEVERITY_ORDER: GapSeverity[] = ['missing', 'worth_reviewing', 'thin']

const FILTER_LABELS: Record<GapSeverity, string> = {
  missing: 'not complete',
  worth_reviewing: 'worth reviewing',
  thin: 'brief',
}

const BADGE_LABELS: Record<GapSeverity, string> = {
  missing: 'Not complete',
  worth_reviewing: 'Worth reviewing',
  thin: 'Brief',
}

export function GapAnalysisStep({
  projectId,
  findings,
  activeSeverity,
  modelConnected,
}: {
  projectId: string
  findings: GapFinding[]
  /** Undefined shows everything. */
  activeSeverity?: GapSeverity
  modelConnected: boolean
}) {
  const counts = countBySeverity(findings)
  const visible = activeSeverity
    ? findings.filter((finding) => finding.severity === activeSeverity)
    : findings

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterPill
              projectId={projectId}
              label="all findings"
              value={findings.length}
              active={activeSeverity === undefined}
            />
            {SEVERITY_ORDER.map((severity) => (
              <FilterPill
                key={severity}
                projectId={projectId}
                severity={severity}
                label={FILTER_LABELS[severity]}
                value={counts[severity]}
                active={activeSeverity === severity}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center">
              <p className="text-sm text-muted">
                Nothing in this group. Choose another, or show all findings.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((finding, index) => (
                <li key={index} className="rounded-lg border border-line bg-white p-5">
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
          )}
        </>
      )}

      <form action={advanceWorkflow} className="border-t border-line pt-6">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="to" value="complete" />
        <button
          type="submit"
          className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
        >
          Review Before Finishing
        </button>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
          You can continue with findings outstanding. These are observations for you to weigh, not
          conditions to satisfy.
        </p>
      </form>
    </div>
  )
}

function FilterPill({
  projectId,
  severity,
  label,
  value,
  active,
}: {
  projectId: string
  severity?: GapSeverity
  label: string
  value: number
  active: boolean
}) {
  const href = severity ? `/project/${projectId}?severity=${severity}` : `/project/${projectId}`

  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={[
        'rounded-full border px-3 py-1.5 transition',
        active
          ? 'border-forest bg-forest font-medium text-white'
          : 'border-line bg-white text-muted hover:border-forest hover:text-ink',
      ].join(' ')}
    >
      <span className={active ? '' : 'font-medium text-ink'}>{value}</span> {label}
    </Link>
  )
}

function SeverityBadge({ severity }: { severity: GapSeverity }) {
  const styles: Record<GapSeverity, string> = {
    missing: 'bg-alert-soft text-alert',
    worth_reviewing: 'bg-lime-soft text-ink',
    thin: 'bg-surface-2 text-muted',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${styles[severity]}`}>
      {BADGE_LABELS[severity]}
    </span>
  )
}
