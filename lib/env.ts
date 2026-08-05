/**
 * Environment resolution in one place.
 *
 * The hosted accounts (Supabase, Anthropic, Vercel) are wired up later in the
 * build, so nothing here throws on a missing value at import time. Instead each
 * area reports whether it is configured, and the code paths that need it fail
 * loudly and specifically at the point of use.
 *
 * That is what makes the local-to-hosted move a configuration change rather than
 * a rewrite: the same modules load either way, they just report `configured:
 * false` until the keys arrive.
 */

function optional(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

/**
 * Accepts a project reference as well as a full URL.
 *
 * The dashboard shows both, one line apart, and pasting the reference is an easy
 * mistake that produces a confusing failure much later. Normalising here costs
 * nothing and removes the failure mode.
 */
function normaliseSupabaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().replace(/\/+$/, '')
  if (/^https?:\/\//.test(trimmed)) return trimmed
  // A bare project reference: 20 lowercase letters, as Supabase issues them.
  if (/^[a-z]{16,32}$/.test(trimmed)) return `https://${trimmed}.supabase.co`
  return trimmed
}

/** Exported for the test alone. Not part of the module's interface. */
export const normaliseSupabaseUrlForTest = normaliseSupabaseUrl

const supabaseUrl = normaliseSupabaseUrl(optional('NEXT_PUBLIC_SUPABASE_URL'))
const supabaseAnonKey = optional('NEXT_PUBLIC_SUPABASE_ANON_KEY')

/**
 * Whether there is a real database behind the app. Several defaults below key
 * off this, so that connecting Supabase switches off the stand-ins by itself
 * rather than depending on someone remembering two more variables.
 */
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const env = {
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    /** Server side only. Never import this into a client component. */
    serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  },
  anthropic: {
    apiKey: optional('ANTHROPIC_API_KEY'),
    model: optional('ANTHROPIC_MODEL') ?? 'claude-opus-5',
  },
  embeddings: {
    apiKey: optional('EMBEDDING_API_KEY'),
    model: optional('EMBEDDING_MODEL') ?? 'voyage-3.5',
  },
  app: {
    url: optional('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
    /**
     * Placeholder auth for the local phase, replaced by Supabase magic link when
     * the hosted project is provisioned.
     *
     * Off by default in production, on by default everywhere else. An unset
     * variable used to mean "on", which meant the Vercel deployment shipped with
     * a sign-in anyone could click through. A convenience default has to fail
     * closed in the one environment that is public.
     */
    usePlaceholderAuth:
      // A real database ends this, whatever the variable says. The placeholder
      // user id does not exist in auth.users, so row level security would reject
      // every write it attempted.
      !supabaseConfigured &&
      (optional('NEXT_PUBLIC_USE_PLACEHOLDER_AUTH') === undefined
        ? process.env.NODE_ENV !== 'production'
        : optional('NEXT_PUBLIC_USE_PLACEHOLDER_AUTH') === 'true'),

    /**
     * Review build. Sign-in is skipped entirely so the work in progress can be
     * looked at without an account, and the interface says on every screen that
     * this is what is happening.
     *
     * Safe only while there is nothing behind the wall: no database, no stored
     * answers, no participant data, an empty dashboard.
     *
     * Connecting Supabase switches it off by itself. Leaving that to a separate
     * variable meant an open URL sitting in front of a real database if anyone
     * forgot to set it, which is too consequential to depend on memory. It also
     * would not have worked: the reviewer's user id does not exist in
     * auth.users, so every write would fail row level security anyway.
     */
    reviewMode: !supabaseConfigured && optional('NEXT_PUBLIC_REVIEW_MODE') !== 'false',
  },
} as const

export const isSupabaseConfigured = supabaseConfigured
export const isSupabaseAdminConfigured = Boolean(env.supabase.url && env.supabase.serviceRoleKey)
export const isAnthropicConfigured = Boolean(env.anthropic.apiKey)
export const isEmbeddingsConfigured = Boolean(env.embeddings.apiKey)

export class NotConfiguredError extends Error {
  constructor(service: string, variables: string[]) {
    super(
      `${service} is not configured yet. Set ${variables.join(' and ')} in .env.local. ` +
        'This is expected during the local phase of the build.',
    )
    this.name = 'NotConfiguredError'
  }
}
