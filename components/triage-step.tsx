import { saveTriage } from '@/app/project/[id]/actions'
import { QuestionField } from '@/components/question-field'
import type { AnswerMap } from '@/lib/data/types'
import { TRIAGE_QUESTIONS } from '@/lib/intake/questions'

/**
 * Step 1. A few opening questions about the shape of the research.
 *
 * Two of them decide whether the tool will draft parts of this application at
 * all, which is why they sit at the very start rather than being discovered
 * halfway through drafting.
 */
export function TriageStep({
  projectId,
  answers,
  missing,
}: {
  projectId: string
  answers: AnswerMap
  missing: string[]
}) {
  return (
    <form action={saveTriage} className="space-y-8">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="space-y-8 rounded-lg border border-line bg-white p-6">
        {TRIAGE_QUESTIONS.map((question) => (
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
          Save and continue to intake
        </button>
        <button
          type="submit"
          name="intent"
          value="save"
          className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2"
        >
          Save and come back later
        </button>
      </div>
    </form>
  )
}
