import type { SignInReason } from './callback'

/**
 * What the researcher is told when sign-in does not work.
 *
 * Here rather than in the page so the reason codes and the sentences cannot
 * drift apart: `messages.test.ts` asserts that every reason the callback can
 * produce has something to say, which is the failure that would otherwise ship
 * as a blank red box.
 *
 * Each message says what happened and what to do next. "Please try again" on its
 * own is what sends a researcher to email you instead, which is how this problem
 * reached us in the first place.
 */

/** Reasons raised before an email is ever sent, or by the code form. */
export type SendReason = 'invalid_email' | 'rate_limited' | 'send_failed'
export type CodeReason = 'invalid_code' | 'code_failed'

export type SignInMessageKey = SignInReason | SendReason | CodeReason

export const SIGN_IN_MESSAGES: Record<SignInMessageKey, string> = {
  invalid_email: 'That does not look like an email address. Please check it and try again.',
  auth_not_configured: 'Sign-in is not connected yet. Please try again shortly.',
  rate_limited:
    'Too many sign-in emails have been sent recently. Please wait a minute and try again.',
  send_failed: 'The sign-in email could not be sent. Please try again in a moment.',
  missing_code: 'That sign-in link was incomplete. Please request a new one below.',
  link_expired:
    'That link has expired or had already been used. Links last an hour and work once. Request another below, or use the six-digit code from the email instead.',
  link_wrong_device:
    'That link was opened in a different browser from the one that asked for it, which it cannot complete. Enter the six-digit code from the same email instead, or request a new link and open it on this device.',
  exchange_failed:
    'That sign-in link could not be completed. Request another below, or use the six-digit code from the email.',
  invalid_code: 'A sign-in code is six digits. Please check the email and try again.',
  code_failed:
    'That code was not accepted. Codes last an hour and work once, so use the newest email you received, or request a fresh one.',
}

export function signInMessage(reason: string | undefined): string | undefined {
  if (!reason) return undefined
  return SIGN_IN_MESSAGES[reason as SignInMessageKey]
}
