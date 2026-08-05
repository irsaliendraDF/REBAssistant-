import type { Question } from '@/lib/intake/questions'

/**
 * Renders one question. Plain form controls with names matching the question
 * key, so a whole step posts as ordinary FormData and needs no client
 * JavaScript. That keeps answers on the server, which is where they have to end
 * up anyway.
 */
export function QuestionField({
  question,
  value,
  missing,
}: {
  question: Question
  value?: string
  missing?: boolean
}) {
  const describedBy = question.help ? `${question.key}-help` : undefined

  return (
    <div className={missing ? 'rounded-md border-l-2 border-red-400 pl-4' : undefined}>
      <label
        htmlFor={question.key}
        className="block text-sm font-medium leading-relaxed text-slate-900"
      >
        {question.label}
        {question.required ? <span className="ml-1 text-slate-400">*</span> : null}
      </label>

      {question.help ? (
        <p id={describedBy} className="mt-1 text-xs leading-relaxed text-slate-500">
          {question.help}
        </p>
      ) : null}

      {missing ? (
        <p className="mt-1 text-xs font-medium text-red-600">
          This one is needed before you can move on.
        </p>
      ) : null}

      <div className="mt-2">
        {question.type === 'choice' ? (
          <fieldset>
            <legend className="sr-only">{question.label}</legend>
            <div className="space-y-2">
              {question.options?.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-slate-700"
                >
                  <input
                    type="radio"
                    name={question.key}
                    value={option.value}
                    defaultChecked={value === option.value}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : question.type === 'textarea' ? (
          <textarea
            id={question.key}
            name={question.key}
            rows={4}
            defaultValue={value ?? ''}
            placeholder={question.placeholder}
            aria-describedby={describedBy}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-slate-500"
          />
        ) : (
          <input
            id={question.key}
            name={question.key}
            type="text"
            defaultValue={value ?? ''}
            placeholder={question.placeholder}
            aria-describedby={describedBy}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        )}
      </div>
    </div>
  )
}
