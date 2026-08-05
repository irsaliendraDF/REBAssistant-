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

export const env = {
  supabase: {
    url: optional('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: optional('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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
     * the hosted project is provisioned. Must be false in any deployed
     * environment.
     */
    usePlaceholderAuth: optional('NEXT_PUBLIC_USE_PLACEHOLDER_AUTH') !== 'false',
  },
} as const

export const isSupabaseConfigured = Boolean(env.supabase.url && env.supabase.anonKey)
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
