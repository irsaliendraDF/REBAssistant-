import { saveIntakeSection } from '@/app/project/[id]/actions'
import { IntakeSectionNav } from '@/components/intake-section-nav'
import { QuestionField } from '@/components/question-field'
import type { AnswerMap } from '@/lib/data/types'
import type { IntakeSection } from '@/lib/intake/questions'

/**
 * Step 2. The guided question sequence, one form section at a time.
 *
 * Sections are the form's own, so an answer never has to be reassigned later.
 * The side list shows which are done, which is the only honest way to answer
 * "how much of this is left" for a form this long.
 *
 * Finishing a section does not go straight to the next one. It goes to that
 * section's checkpoint, which reads the answers back before moving on.
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
    // The navigation lives inside the form on purpose. Every section in the list
    // is a submit button, so moving to another one saves the current answers on
    // the way out rather than discarding them.
    <form action={saveIntakeSection} className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="formSection" value={current.formSection} />

      <IntakeSectionNav
        projectId={projectId}
        sections={sections}
        current={current.formSection}
        answers={answers}
        mode="submit"
      />

      <div className="space-y-8">

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
            {isLast ? 'Save and Review Before the Method Check' : 'Save and Next Section'}
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
            // Also a submit, for the same reason as the section list: going back
            // should carry this section's answers back with it.
            <button
              type="submit"
              name="goto"
              value={previous.formSection}
              formNoValidate
              className="text-sm text-muted underline-offset-4 hover:underline"
            >
              Back to {previous.title.toLowerCase()}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
