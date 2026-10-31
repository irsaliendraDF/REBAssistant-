# Logins

**Prepared for:** KJ and Shakara
**Prepared by:** Irene Saliendra, Founder and Principal Consultant, DigitalFlow Consulting Inc.

## 1. Handling

This document is shared with KJ and Shakara by name only. Link sharing is turned off, and downloading, printing and copying are disabled. The document is not forwarded, and its contents are not copied into an email or a message.

The document is deleted when step 1 below is complete. A password recorded here ceases to be valid when the mailbox password is changed, and a document that retains an outdated password is a greater liability than no document.

## 2. The project mailbox

**Address:** researchethicsboardassistant@gmail.com

This mailbox sends every account confirmation and password-reset email for the tool. Whoever controls it can take over any account in the product.

**Password:** [to be entered by Irene Saliendra]

The password alone does not grant access. The mailbox uses two-step verification, and the code is sent to the telephone of Irene Saliendra. Two-step verification is moved to the recipients' own telephone on a call.

## 3. Step 1 of the transfer

The following actions are completed in this order, on the same day:

1. Change the password.
2. Regenerate the backup codes. This voids every code held by DigitalFlow, and it is the step most often omitted.
3. Move two-step verification to a telephone controlled by the recipients.
4. Revoke the existing App Password in the Google account, issue a new one, and enter it in Supabase (Authentication, then Emails, then the SMTP settings).

The document is then deleted.

## 4. Accounts that require no password

- **Supabase.** The project belongs to the project's own organisation, which is signed in to through the project GitHub account. Control of the mailbox carries control of that account. The recipients are added as owners and sign in with their own accounts.
- **GitHub.** The code resides in the project repository, controlled through the same account. The recipients' own accounts are added as owners.
- **Vercel.** The recipients link the project to the transferred repository and verify every setting.
- **Anthropic key.** The recipients issue their own key and replace the existing key in Vercel.
- **Backup codes.** These are never shared. The recipients generate their own in step 1.

No other password is required from DigitalFlow.
