import Link from 'next/link'

import type { AnswerMap } from '@/lib/data/types'
import { missingRequired, type IntakeSection } from '@/lib/intake/questions'

/**
 * The list of form sections down the left of intake.
 *
 * Shared by the section itself and by the checkpoint that follows it, so a
 * researcher who has just finished 2.4 still sees where they are in the form
 * while they read their answers back. A checkpoint that replaced the whole
 * screen would lose the one thing that makes a long form bearable, which is
 * being able to see how much of it is left.
 */
export function IntakeSectionNav({
  projectId,
  sections,
  current,
  answers,
  mode = 'link',
}: {
  projectId: string
  sections: IntakeSection[]
  /** The section being worked on, or read back at a checkpoint. */
  current: string
  answers: AnswerMap
  /**
   * `submit` renders each entry as a submit button inside the surrounding form,
   * so moving to another section saves what has been typed on the way out.
   *
   * As plain links, which is what these were, a researcher who filled in half of
   * 2.6 and clicked 2.9 to check something lost the half. The list looked like
   * free navigation and behaved like a trapdoor, so people stopped using it and
   * reported that they could not move around. `link` remains correct where there
   * is nothing unsaved to lose, such as the checkpoint that reads answers back.
   */
  mode?: 'link' | 'submit'
}) {
  return (
    <nav aria-label="Application sections" className="lg:pt-1">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Sections</p>
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
          const isCurrent = section.formSection === current

          const className = [
            'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs leading-snug transition',
            isCurrent ? 'bg-forest text-white' : 'text-muted hover:bg-surface-2 hover:text-ink',
          ].join(' ')

          const label = (
            <>
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
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    role="img"
                    aria-label="Complete"
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                ) : null}
            </>
          )

          return (
            <li key={section.formSection}>
              {mode === 'submit' ? (
                <button
                  type="submit"
                  name="goto"
                  value={section.formSection}
                  aria-current={isCurrent ? 'page' : undefined}
                  // Without this, a browser refuses to submit while a required
                  // field on the current section is empty, which is exactly the
                  // half-finished state someone is in when they want to go and
                  // check something else.
                  formNoValidate
                  className={className}
                >
                  {label}
                </button>
              ) : (
                <Link
                  href={`/project/${projectId}?section=${encodeURIComponent(section.formSection)}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={className}
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
