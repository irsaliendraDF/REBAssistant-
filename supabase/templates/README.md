# Authentication email templates

The first email anyone sees of this tool is the first thing they judge it by, and
the default Supabase one reads as spam. Shakara flagged exactly that on 6 August
2026: she got in, but assumed the email was junk first.

These templates replace it. They are kept here rather than only in the Supabase
dashboard so the wording is versioned, reviewable, and survives the handover to
Future Civics. If you edit them in the dashboard, edit them here too.

**Read this before assuming which templates matter.** Sign-in changed to email
and password on 21 September 2026. The magic link is gone. **Reset Password is
now the email that decides whether somebody can get in at all**, and it was the
one template nobody had configured, because the note below used to say it was
never triggered. It was never triggered until the day it became the only one that
was.

## Which template is which

Since 21 September 2026 sign-in is email and password, so these are sent:

| File | Supabase template | When it is sent |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | Once, when an account is created |
| `recovery.html` | **Reset Password** | Setting a password, and every forgotten one after |
| `magic-link.html` | **Magic Link** | Never any more. Kept for the history, and in case the link ever returns |

**`recovery.html` is the one that matters now.** Everyone who had an account
before passwords existed sets their first one through it, and this product's own
usage pattern guarantees it gets used again: researchers work hard for a week and
come back months later, which is exactly when a password has been forgotten.

Invite user and Change Email Address are still never triggered.

## How to apply them

1. Supabase dashboard, project `fzciyxuqzdashapkmcam`
2. **Authentication** in the left sidebar, then **Emails**
3. Open the **Confirm signup** template, clear the message body, paste the whole
   contents of `confirm-signup.html`, and save
4. Do the same for **Reset Password** with `recovery.html`
5. Set the subject lines:
   - Confirm signup: `Confirm your email for Research Ethics Board Assistant`
   - Reset Password: `Set a new password for Research Ethics Board Assistant`

**Until step 4 is done, the reset email is Supabase's unstyled default.** It does
not name the tool, and it is the shape of message people delete. Somebody
reporting that no email arrived may well have received that one.

**Both templates changed again on 22 September and both need re-pasting**, even
if you pasted one earlier the same day. See below for what changed.

Send yourself one afterwards to check it. The placeholders are filled in by
Supabase; if you open these files directly in a browser you will see the
placeholder text rather than a link, which is correct.

## Why the link is a token_hash link, and why the URL is hardcoded

Both templates build their own link:

```
https://reb-assistant.vercel.app/callback?token_hash={{ .TokenHash }}&type=recovery
```

rather than using `{{ .ConfirmationURL }}`, and rather than `{{ .RedirectTo }}` or
`{{ .SiteURL }}`. **Three separate reasons, all of them learned the hard way on
22 September 2026.**

**One: `{{ .ConfirmationURL }}` completes only in the browser that asked for it**,
because the proof of the request is a cookie in that browser. Open the email on a
phone after asking on a laptop and it cannot work. A `token_hash` link carries its
own proof and completes anywhere.

**Two, and this is the big one: a `token_hash` link never visits Supabase at all.**
It goes straight to this app, which verifies the token server side. That takes the
whole `redirect_to` allow-list out of the picture. **This project's allow-list does
not contain the app's paths**, so Supabase was discarding every `redirect_to` the
app sent and falling back to the Site URL. Verified by asking the admin API for a
recovery link and reading back what it resolved to:

```
asked : https://reb-assistant.vercel.app/callback?next=/reset-password
  got : https://reb-assistant.vercel.app/
```

So a `ConfirmationURL` link landed on the site root, which has no token handling,
rather than on `/callback`. **Fix the allow-list anyway** under Authentication,
URL Configuration, Redirect URLs, by adding `https://reb-assistant.vercel.app/**`.
Nothing here depends on it any more, but leaving it wrong is a trap for whoever
needs it next.

**Three: the URL is hardcoded because the alternatives resolve wrongly.**
`{{ .RedirectTo }}` renders whatever Supabase resolved, which is the bare Site URL
while the allow-list is wrong, producing `https://reb-assistant.vercel.app/&token_hash=...`
with no `?`. `{{ .SiteURL }}` carries a trailing slash, producing a double slash.
Hardcoding is blunt, and it is the only one of the three that cannot silently
produce a broken link. **If the domain ever changes, these two files change with
it**, and that is written here because nothing else will remind anyone.

**The six-digit code these templates used to carry is gone**, as of 22 September.
It existed for the browser-binding problem above, which the link form now solves
at the source, and for a claim that Microsoft 365 spends one-use links by scanning
them, which **was never observed here**. It went into the repository on 24 August
as one of four possible explanations for a report whose actual cause was a missing
session refresh, then got repeated in eight files as though it were established.

Worth knowing if anyone reinstates it: **Supabase issued an eight-digit
`email_otp` on this project**, not six, so the old six-digit input would have
rejected a valid code anyway.

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
