import Link from 'next/link'

/**
 * The way out of a screen.
 *
 * Styled as a real control rather than faint small print. It was previously
 * extra-small muted text, which technically existed and practically did not:
 * people could not find it, which is the same as it not being there.
 */
export function BackLink({
  href = '/dashboard',
  label = 'All Applications',
}: {
  href?: string
  label?: string
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-forest transition hover:border-forest hover:bg-surface-2"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9.5 3 4.5 8l5 5" />
      </svg>
      {label}
    </Link>
  )
}
