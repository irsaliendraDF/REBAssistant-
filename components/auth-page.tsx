import type { ReactNode } from 'react'

/**
 * The frame the four signed-out screens share: sign in, create an account,
 * forgot password, set a new password.
 *
 * One component rather than four copies, because the wording above the form is
 * the first thing a researcher reads about what this tool does and it should not
 * be able to differ between the screen they land on and the screen they are sent
 * to.
 */
export function AuthPage({
  error,
  children,
}: {
  error?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-ink">Research Ethics Board Assistant</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Prepare a Research Ethics Board application, section by section. Research Ethics Board
          Assistant helps you draft and spot gaps. It does not decide whether your application will
          be approved.
        </p>
      </div>

      {error ? (
        <p className="mb-6 rounded-lg border border-alert/40 bg-alert-soft px-4 py-3 text-sm leading-relaxed text-alert">
          {error}
        </p>
      ) : null}

      {children}
    </main>
  )
}

/** A label, its hint and its input, laid out the same way on every screen. */
export function Field({
  id,
  name,
  type,
  label,
  hint,
  autoComplete,
  placeholder,
  defaultValue,
}: {
  id: string
  name: string
  type: 'email' | 'password'
  label: string
  hint?: string
  autoComplete: string
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-muted">
        {label}
      </label>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-forest"
      />
    </div>
  )
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-md bg-forest px-4 py-2.5 text-sm font-medium text-white transition hover:bg-forest-dark"
    >
      {children}
    </button>
  )
}

/** The line of alternatives under a form. */
export function AuthLinks({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5 text-sm text-muted">
      {children}
    </div>
  )
}
