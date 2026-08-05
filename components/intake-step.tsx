import Link from 'next/link'

import { saveIntakeSection } from '@/app/project/[id]/actions'
import { QuestionField } from '@/components/question-field'
import type { AnswerMap } from '@/lib/data/types'
import { missingRequired, type IntakeSection } from '@/lib/intake/questions'

/**
 * Step 2. The guided question sequence, one form section at a time.
 *
 * Sections are the form's own, so an answer never has to be reassigned later.
 * The side list shows which are done, which is the only honest way to answer
 * "how much of this is left" for a form this long.
 */
export function IntakeStep({
  projectId,
  sections,
  current,
  answers,
  missing,
}: {
  projectId: string
  sections: IntakeSection[]
  current: IntakeSection
  answers: AnswerMap
  missing: string[]
}) {
  const index = sections.findIndex((section) => section.formSection === current.formSection)
  const isLast = index === sections.length - 1
  const previous = sections[index - 1]

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Application sections" className="lg:pt-1">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
          Sections
        </p>
        <ol className="space-y-1">
          {sections.map((section) => {
            // A section counts as done only once it has been answered. Testing
            // required questions alone marked "Conflict of interest" complete
            // before the researcher had seen it, because every question in it is
            // optional.
            const touched = section.questions.some(
              (question) => (answers[question.key] ?? '').trim().length > 0,
            )
            const done = touched && missingRequired(section.questions, answers).length === 0
            const isCurrent = section.formSection === current.formSection

            return (
              <li key={section.formSection}>
                <Link
                  href={`/project/${projectId}?section=${encodeURIComponent(section.formSection)}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={[
                    'flex items-start gap-2 rounded-md px-2 py-1.5 text-xs leading-snug transition',
                    isCurrent
                      ? 'bg-forest text-white'
                      : 'text-muted hover:bg-surface-2 hover:text-ink',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'font-mono text-[10px]',
                      isCurrent ? 'text-lime-soft' : 'text-faint',
                    ].join(' ')}
                  >
                    {section.formSection}
                  </span>
                  <span className="flex-1">{section.title}</span>
                  {done && !isCurrent ? (
                    <span className="text-faint" aria-label="complete">
                      ✓
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <form action={saveIntakeSection} className="space-y-8">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="formSection" value={current.formSection} />

        <div className="space-y-8 rounded-lg border border-line bg-white p-6">
          <div>
            <p className="font-mono text-xs text-faint">Section {current.formSection}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{current.title}</h2>
            {current.intro ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">{current.intro}</p>
            ) : null}
          </div>

          {current.questions.map((question) => (
            <QuestionField
              key={question.key}
              question={question}
              value={answers[question.key]}
              missing={missing.includes(question.key)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="advance"
            className="rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
          >
            {isLast ? 'Save and continue to method check' : 'Save and next section'}
          </button>
          <button
            type="submit"
            name="intent"
            value="save"
            className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
          >
            Save
          </button>
          {previous ? (
            <Link
              href={`/project/${projectId}?section=${encodeURIComponent(previous.formSection)}`}
              className="text-sm text-muted underline-offset-4 hover:underline"
            >
              Back to {previous.title.toLowerCase()}
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  )
}
