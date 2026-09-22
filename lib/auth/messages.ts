import type { SignInReason } from './callback'

/**
 * What the researcher is told when something does not work.
 *
 * Here rather than in the page so the reason codes and the sentences cannot
 * drift apart: `messages.test.ts` asserts that every reason the app can produce
 * has something to say, which is the failure that would otherwise ship as a
 * blank red box.
 *
 * Each message says what happened and what to do next. "Please try again" on its
 * own is what sends a researcher to email you instead, which is how this problem
 * reached us in the first place.
 */

/**
 * Sign-in and sign-up, from 21 September 2026 email and password.
 *
 * There is no "could not be sent" reason, deliberately. Supabase reports a
 * failure when the mail server does not answer in time, which is not the same as
 * the mail being refused, and with Gmail behind it the message usually arrives
 * anyway. Asserting it failed was wrong often enough to be a bug.
 *
 * `service_unavailable` is the one that matters most. Supabase not answering at
 * all used to fall through to a screen that blamed something else, so a
 * researcher retyped a correct password, or watched an inbox, while the database
 * was asleep. Twice. It does not fix the outage. It stops the outage lying about
 * itself, and it stops the next one reaching the builder as a sign-in bug.
 */
export type CredentialReason =
  | 'invalid_email'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'missing_password'
  | 'already_registered'
  | 'rate_limited'
  | 'service_unavailable'
  | 'reset_failed'
  | 'same_password'

export type SignInMessageKey = SignInReason | CredentialReason

export const SIGN_IN_MESSAGES: Record<SignInMessageKey, string> = {
  invalid_email: 'That does not look like an email address. Please check it and try again.',
  auth_not_configured: 'Sign-in is not connected yet. Please try again shortly.',

  // One message, because Supabase gives one error for both a wrong password and
  // an address that has never registered, on purpose, so that the sign-in box
  // cannot be used to find out who has an account. Saying "we do not know which"
  // would be honest and useless, so this names both possibilities and offers the
  // route out of each.
  invalid_credentials:
    'That email and password do not match an account. Check the password, or reset it below. If you have never set a password here, create an account instead.',

  email_not_confirmed:
    'This account has not been confirmed yet. Check your email for the confirmation link, including your junk folder, and use it before signing in.',

  missing_password: 'Please enter your password.',

  weak_password:
    'That password is too short or too easy to guess. Please choose a longer one and try again.',

  already_registered:
    'There is already an account for that address. Sign in with it instead, or reset the password if you do not have it.',

  rate_limited: 'Too many attempts recently. Please wait a minute and try again.',

  // Names the service rather than the person's typing or their inbox, because
  // neither is where the answer is. No timescale is promised: a paused project
  // comes back in a couple of minutes, and nothing here can tell that apart from
  // a longer outage, so it says who to tell instead.
  service_unavailable:
    'Sign-in is temporarily unavailable, and this is nothing to do with your password. This is usually brief. Please try again in a few minutes, and let us know if it is still happening.',

  same_password:
    'That is the password you already have. Please choose a different one, or go back and sign in with it.',

  reset_failed:
    'That password could not be saved. Send yourself a new link below and try once more.',

  // Confirmation and password-reset links still arrive by email, so these stay.
  missing_code: 'That link was incomplete. Please request a new one.',
  link_expired:
    'That link has expired or had already been used. Links last an hour and work once. Please request another.',
  link_wrong_device:
    'That link was opened in a different browser from the one that asked for it, which it cannot complete. Please request another and open it on this device.',
  exchange_failed: 'That link could not be completed. Please request another.',
}

export function signInMessage(reason: string | undefined): string | undefined {
  if (!reason) return undefined
  return SIGN_IN_MESSAGES[reason as SignInMessageKey]
}
