/**
 * What happened when we asked Supabase to send a sign-in email.
 *
 * Pure, like `callback.ts` next door, so every branch can be tested without a
 * network or a Supabase project. The server action does the talking; deciding
 * *which* failure happened, and therefore what the researcher sees, is here.
 *
 * Why this file exists: the action used to test the error's *message* with
 * `/rate|limit|too many/i` and send everything else to the "check your email"
 * screen. An unreachable project produces the message `fetch failed`, which
 * matches nothing, so the app told researchers an email was on its way while the
 * database was down and no email existed. That is the screen the client saw on
 * 26 August 2026 and again on the weekend of 19 September 2026.
 *
 * The shapes below were read off the live project on 2026-09-21 with the same
 * `@supabase/supabase-js` the app uses. See `docs/sign-in-spec.md`.
 */

/** The parts of a Supabase auth error this decision actually uses. */
export type AuthErrorLike = {
  name?: string
  status?: number
  code?: string
  message?: string
}

export type SendOutcome =
  /** The email is on its way. */
  | 'sent'
  /**
   * Supabase answered, and there is no account for that address. Not an error
   * to apologise for: it is the whole point of asking with `shouldCreateUser:
   * false`, and the researcher is offered the address back plus a deliberate
   * way to create one.
   */
  | 'unknown_address'
  /** Too many requests. The one failure where trying again at once is wrong. */
  | 'rate_limited'
  /**
   * Supabase did not answer at all. Almost always the project having paused
   * itself, which has taken this product down twice.
   */
  | 'service_unavailable'
  /**
   * Supabase answered with something else. The mail server not answering in
   * time lands here, and with Gmail behind it the message usually arrives
   * regardless, so this goes to the sent screen with a caveat rather than
   * claiming a failure.
   */
  | 'unconfirmed'

export function readSendOutcome(error: AuthErrorLike | null | undefined): SendOutcome {
  if (!error) return 'sent'

  // No answer from the server at all. `AuthRetryableFetchError` with status 0 is
  // what a paused project, a DNS failure and a dropped connection all produce.
  // Checked first, because an error with no status must not fall through to a
  // branch that assumes one.
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'service_unavailable'
  }

  // On status, not on the message. Supabase has more than one 429 here and at
  // least one of them reads "For security purposes, you can only request this
  // after N seconds", which contains none of rate, limit or too many. Matching
  // the message is how the old code missed cases.
  if (error.status === 429) return 'rate_limited'

  // `otp_disabled` is Supabase's code for refusing to send a one-time password.
  // We only ever ask with `shouldCreateUser: false`, so for us it means there is
  // no account for that address. It is also the code if OTP sign-in were turned
  // off for the whole project, which would make every address look unknown; that
  // is a project setting nobody changes, and it would be caught the first time
  // anyone tried to sign in.
  if (error.code === 'otp_disabled') return 'unknown_address'

  return 'unconfirmed'
}

/**
 * Whether a failure is the service being unreachable rather than refusing.
 *
 * Used on the six-digit code path too. During both outages that box was the only
 * thing on screen that looked like it might work, and it could not, because the
 * code is verified against the same project that was not answering.
 */
export function isServiceUnavailable(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false
  return error.name === 'AuthRetryableFetchError' || error.status === 0
}
