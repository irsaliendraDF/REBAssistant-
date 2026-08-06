# Accounts, credentials, and what happens at transfer

Source material for the handover document. It records **what exists, who holds
it, and what the recipient has to do**. It deliberately contains no secrets.

No password, API key, App Password, recovery code or backup code belongs in this
file, in the handover document, or in any shared Drive folder. A handover
document is copied, exported, forwarded and kept long after it is useful. A
credential in it is a credential in all of those places, permanently, for anyone
who ever had access to any of them.

Secrets live in the systems that need them and in a password manager. Everything
below says where to look, not what the value is.

---

## The mailbox

`researchethicsboardassistant@gmail.com`, created for this project on
6 August 2026. Not a personal account.

It matters more than it looks: every sign-in to the tool is a magic link sent
from this mailbox. Whoever controls it controls access to the product.

- **2-Step Verification is enabled.** Required, because Gmail will not issue an
  App Password without it.
- **Backup codes were generated on 6 August 2026.** Ten single-use codes, held by
  Irene Saliendra outside this repository and outside Drive.
- **An App Password is issued to Supabase** for SMTP. Visible in the Google
  account's App Passwords list as its own entry, revocable independently of the
  account password.

### At transfer

The receiving party takes ownership of the mailbox, and on the same day:

1. Changes the account password
2. **Regenerates the backup codes**, which voids every previously issued code
3. Re-points 2-Step Verification to a phone the receiving party controls
4. Revokes the existing Supabase App Password and issues a new one, then updates
   it in Supabase

Step 2 is the one people skip. Until it is done, the outgoing party still holds
ten working bypasses of two-step verification, no matter what the password is.

---

## Supabase

Project `fzciyxuqzdashapkmcam`, region `ca-central-1`. The region is permanent
and was chosen deliberately: see `docs/decisions.md`.

Three credentials exist, and they are not equivalent:

| Credential | Where it lives | Sensitivity |
|---|---|---|
| Anon (publishable) key | Vercel, `.env.local`, and every browser | Public by design. Row level security is the protection, not secrecy. |
| Service role key | Vercel only | **Bypasses row level security entirely.** Never in the repo, never in chat, never in a ticket. |
| SMTP App Password | Supabase SMTP settings | See the mailbox section above. |

The service role key is used by exactly one thing: writing redaction audit
events, which must succeed regardless of who is signed in. It is deliberately
blank in local development.

### At transfer

Supabase organisation ownership moves, then the receiving party rotates the
service role key and updates it in Vercel. Rotating it is a two-minute job and
invalidates the outgoing party's copy.

---

## Anthropic

An API key, held in Vercel. Not in the repository, and not required to run the
app locally: the tool reports the model as unavailable rather than failing.

One key was exposed in a chat transcript during the build and was rotated the
same day. The exposed key was verified dead (returns 401). This is noted because
a handover should say what happened, not only what the current state is.

### At transfer

The receiving party creates a key on their own Anthropic account and replaces the
value in Vercel. The outgoing key is then revoked. Billing follows the key, so
this also moves the cost.

---

## GitHub and Vercel

Repository `irsaliendraDF/REBAssistant-` and the Vercel project both sit under
Irene Saliendra's personal accounts, per Section 12 of the build plan, and
transfer to Future Civics.

### At transfer

Repository ownership transfers first, then the Vercel project is re-linked to the
new owner so deployments continue. Environment variables do not travel with a
Vercel project transfer in every case, so check all of them afterwards, in
particular that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
still carry the `NEXT_PUBLIC_` prefix. Omitting it is silent and fatal: the
prefix is what makes a value visible to the browser, and it has already caught
this project once.

---

## The short version for the handover document

Six things the receiving party must do, in this order:

1. Take ownership of the mailbox, change its password, **regenerate its backup
   codes**, and move two-step verification to their own phone
2. Revoke and reissue the Gmail App Password, update it in Supabase
3. Take ownership of the Supabase organisation, rotate the service role key
4. Issue their own Anthropic key, update Vercel, revoke the old one
5. Accept the GitHub repository transfer
6. Re-link Vercel and verify every environment variable, prefixes included

Until all six are done, the previous holder retains working access. That is not a
criticism of anyone; it is just what shared credentials mean, and the only fix is
to complete the list.
