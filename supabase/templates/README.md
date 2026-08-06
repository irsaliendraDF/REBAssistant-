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

## What these templates fix, and what they do not

They fix the content signals: the tool is named, the message says why it arrived
and what to do if it was unexpected, the link is shown as text as well as a
button for clients that strip buttons, and it looks like the app it came from.

They do not fix the sender. With Supabase's built-in email service every message
comes from a generic Supabase address, and that address cannot be changed from
the dashboard. It is the single strongest reason a message lands in spam, and no
amount of template work touches it.

Fixing it needs custom SMTP on a real domain, under **Project Settings →
Authentication → SMTP Settings**. Brevo or Resend both work; whichever is used,
the domain needs SPF and DKIM records or deliverability gets worse rather than
better.

That is worth doing before real researchers are invited, for a second reason:
Supabase's built-in sender is rate limited to a handful of messages an hour. It
is fine for a few test users in August and will not survive a cohort.
