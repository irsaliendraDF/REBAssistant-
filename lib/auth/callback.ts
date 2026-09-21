/**
 * Reading an emailed link.
 *
 * Pure, so the decisions can be tested without a browser or a Supabase project.
 * The route handler does the talking to Supabase; everything about *which*
 * failure happened, and therefore what the researcher should be told, is here.
 *
 * **Sign-in no longer arrives this way.** Since 21 September 2026 it is email
 * and password, so exactly two links still reach this route: confirming a new
 * account, and resetting a password. Both are once in an account's life rather
 * than once per sign-in, which is the whole point of the change.
 *
 * Why the failure detail survives a change that removed most of its callers:
 * every failure used to arrive as one sentence, "that link has expired or has
 * already been used". Three quite different things produce it, and only one of
 * them is solved by requesting another link. A reset link is exactly as capable
 * of being expired, spent, or opened in the wrong browser as a sign-in link was.
 */

/** The email link types this app can still receive. */
export type EmailLinkType = 'signup' | 'email' | 'recovery'

export type SignInReason =
  /** The link is past its hour, or has already been used once. */
  | 'link_expired'
  /**
   * The link was opened somewhere other than where it was asked for. The proof
   * of that request lives in a cookie in the original browser, so a link
   * forwarded to a phone, or opened in a different browser, cannot complete.
   */
  | 'link_wrong_device'
  /** The link arrived without the part that identifies it. */
  | 'missing_code'
  /** Something else went wrong in the exchange. */
  | 'exchange_failed'
  | 'auth_not_configured'

export type CallbackOutcome =
  | { kind: 'code'; code: string; next: string }
  | { kind: 'token_hash'; tokenHash: string; type: EmailLinkType; next: string }
  | { kind: 'failed'; reason: SignInReason }

/** Where each kind of link should land once it has been exchanged. */
export const AFTER_RECOVERY = '/reset-password'
export const AFTER_CONFIRMATION = '/dashboard'

/**
 * Only relative paths, and only ones that stay on this site. A `next` parameter
 * that can be pointed anywhere turns the callback into an open redirect, which
 * is worth exactly nothing to us and quite a lot to someone else.
 */
export function safeNext(value: string | null, fallback: string = AFTER_CONFIRMATION): string {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

function readLinkType(value: string | null): EmailLinkType {
  if (value === 'recovery') return 'recovery'
  if (value === 'email') return 'email'
  return 'signup'
}

export function readCallbackParams(params: URLSearchParams): CallbackOutcome {
  // Supabase reports a dead link by redirecting here with its own parameters
  // rather than with a code. Reading them is the difference between "please
  // request a new link", which is true and actionable, and "that link was
  // incomplete", which is neither.
  const error = params.get('error')
  const errorCode = params.get('error_code')

  if (error || errorCode) {
    return {
      kind: 'failed',
      reason: errorCode === 'otp_expired' ? 'link_expired' : 'exchange_failed',
    }
  }

  const type = readLinkType(params.get('type'))

  // A recovery link has somewhere specific to go, and it goes there whether or
  // not the `next` parameter survived the trip through the mail client. Landing
  // a password reset on the dashboard would leave the person signed in holding
  // the password they came here to change, with no sign that anything was left
  // undone.
  const fallback = type === 'recovery' ? AFTER_RECOVERY : AFTER_CONFIRMATION
  const next = safeNext(params.get('next'), fallback)

  // The token-hash form, which does not depend on a cookie from the browser that
  // asked for the link. Accepted whether or not the email template currently
  // sends it, so switching the template is a change in one place.
  const tokenHash = params.get('token_hash')
  if (tokenHash) {
    return { kind: 'token_hash', tokenHash, type, next }
  }

  const code = params.get('code')
  if (code) {
    return { kind: 'code', code, next }
  }

  return { kind: 'failed', reason: 'missing_code' }
}

/**
 * What a failed exchange actually means.
 *
 * The missing-verifier message is the one worth separating. It says the link was
 * opened in a browser that never asked for it: forwarded to a phone, opened from
 * a different machine, or opened after the browser cleared its cookies. A new
 * link will fail the same way unless it is opened where it was requested, so
 * telling that person to request another one is a loop.
 */
export function exchangeFailureReason(message: string): SignInReason {
  if (/code verifier|flow state|flow_state/i.test(message)) {
    return 'link_wrong_device'
  }
  if (/expired|invalid|used|not found/i.test(message)) {
    return 'link_expired'
  }
  return 'exchange_failed'
}

/** Where a failed callback sends the researcher. */
export function signInUrl(origin: string, reason: SignInReason): string {
  return `${origin}/sign-in?error=${reason}`
}
