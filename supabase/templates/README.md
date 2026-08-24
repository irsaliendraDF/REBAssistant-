# Authentication email templates

The sign-in email is the first thing anyone sees of this tool, and the default
Supabase one reads as spam. Shakara flagged exactly that on 6 August 2026: she
got in, but assumed the email was junk first.

These two templates replace it. They are kept here rather than only in the
Supabase dashboard so the wording is versioned, reviewable, and survives the
handover to Future Civics. If you edit them in the dashboard, edit them here too.

## Which template is which

Sign-in is magic link only, so only two of Supabase's templates are ever sent:

| File | Supabase template | When it is sent |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | First time an address is used |
| `magic-link.html` | **Magic Link** | Every sign-in after that |

The others (Invite user, Change Email Address, Reset Password) are never
triggered by this app, because there is no password and no invitation flow.

## How to apply them

1. Supabase dashboard, project `fzciyxuqzdashapkmcam`
2. **Authentication** in the left sidebar, then **Emails**
3. Open the **Confirm signup** template, clear the message body, paste the whole
   contents of `confirm-signup.html`, and save
4. Do the same for **Magic Link** with `magic-link.html`
5. Set the subject lines:
   - Confirm signup: `Confirm your email for Research Ethics Board Assistant`
   - Magic Link: `Your sign-in link for Research Ethics Board Assistant`

Send yourself one afterwards to check it. The `{{ .ConfirmationURL }}`
placeholder is filled in by Supabase; if you open these files directly in a
browser you will see the placeholder text instead of a link, which is correct.

## The six-digit code

Both templates now show a code as well as a link, from the `{{ .Token }}`
placeholder. **Re-paste both templates into the dashboard**, or the code will not
appear in the mail people receive and the code box on the sign-in page will have
nothing to accept.

It is there because a link is fragile in a university mailbox in two ways that
have nothing to do with the researcher:

- A magic link completes only in the browser that asked for it. Open the email on
  a phone after requesting the link on a laptop and it cannot work, however fast
  you click. Shakara reported being unable to get in after signing in once; this
  is one of the two things that produces that.
- Microsoft 365, which Dalhousie runs, follows links in mail to check them. A
  link that works once can be spent before anyone clicks it.

A typed code has neither problem. The link stays first, because it is one click
when it works.

## What these templates fix, and what they do not

They fix the content signals: the tool is named, the message says why it arrived
and what to do if it was unexpected, the link is shown as text as well as a
button for clients that strip buttons, and it looks like the app it came from.

They do not fix the sender. With Supabase's built-in email service every message
comes from a generic Supabase address that the dashboard cannot change, and that
is the single strongest reason a message lands in spam. Custom SMTP was turned on
for exactly that reason on 6 August 2026.

## Current mail configuration

Under **Authentication → Emails → SMTP Settings**. Custom SMTP is on and mail
goes out through Gmail:

| Setting | Value |
|---|---|
| Sender email address | `researchethicsboardassistant@gmail.com` |
| Sender name | Research Ethics Board Assistant |
| Host | `smtp.gmail.com` |
| Port | 465 |
| Minimum interval per user | 60 seconds |
| Username | `researchethicsboardassistant@gmail.com` |
| Password | A Google App Password, not the account password |

Gmail will not accept an account password over SMTP. The value in that field is a
16-character App Password generated at `myaccount.google.com/apppasswords`, which
requires 2-Step Verification to be enabled on the mailbox first. If mail suddenly
stops sending, the App Password having been revoked is the first thing to check.

The mailbox itself is a dedicated account created for this project, not a
personal one. See the handover document for how the account and its recovery
material are held.

## Before real researchers are invited

Gmail SMTP is fine for the August test group. Two things make it wrong for a
cohort:

- It caps at roughly 500 messages a day, and it is a personal-tier mailbox doing
  a product's job.
- The address is a `gmail.com` one. Deliverability on a real domain with SPF and
  DKIM records is meaningfully better, and looks like what it is.

When that move happens, use a **Future Civics** domain, not a DigitalFlow one.
This product transfers to Future Civics, and sending their researchers' sign-in
mail from the contractor's domain works right up until the transfer and then
becomes something someone has to unpick under time pressure. Brevo and Resend
both do this well.
