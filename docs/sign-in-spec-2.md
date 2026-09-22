# Sign-in, third pass: email and password

**Decided 2026-09-21 by Irene Saliendra**, the same day the second pass shipped.
Her words: a normal email and password, and remove the workarounds.

Not yet built. Staged below, same as `docs/sign-in-spec.md`, which this
supersedes for the sign-in mechanism and leaves standing for everything else.

## Why this replaces the magic link

The magic link accumulated remedies. A six-digit code, a browser-reset button,
and separate messages for four different ways a link can die. Each was a fix for
a way a link fails, and together they are a sign-in screen that needs explaining.

**One of those reasons did not survive checking.** The code was justified partly
by Microsoft 365 spending single-use links by scanning them, which was written
down as established on 24 August and never observed here. See `docs/decisions.md`.

A password has none of those failures. It cannot be spent by a mail scanner,
it does not care which browser it is typed into, and it does not need an inbox at
the moment of use.

## What this does not fix, stated once

**A paused Supabase project refuses a password sign-in exactly as it refuses a
link.** Both outages, 26 August and 19 September, would have looked identical
under this design. That is a billing decision and it is recorded in
`docs/handover.md`.

## What was verified before writing this, 2026-09-21

Against the live project, no email sent and nothing created.

**Email and password is already enabled.** `external.email` is true and
`disable_signup` is false, so no project setting has to change.

**Email confirmation is on.** `mailer_autoconfirm` is false, so a new account is
not usable until the person clicks a confirmation link. **Keep it on.** Turning
it off would let anyone register an address they do not own, which on a research
ethics tool is not a trade worth making.

**Supabase will not say whether an address has an account.** A wrong password and
an address with no account both return exactly this:

```
{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}
```

That is deliberate on Supabase's part and it cannot be worked around from the
sign-in screen. **It has a consequence worth naming:** the unknown-address screen
built this morning cannot exist on the password path. The guidance it carried,
that work stays with the address it was started under, moves to the two places
that can still carry it: the sign-up screen, and the empty dashboard, which
already names the signed-in address.

## So email does not disappear, it moves

**Twice in an account's life, instead of every sign-in.**

1. **Confirming a new account.** One click, once.
2. **Forgetting the password.** This product is used hard for a week and returned
   to months later, which is the exact usage pattern that forgets passwords, so
   this path is built properly rather than as an afterthought.

**Ordinary sign-in touches no inbox at all**, which is the whole point of the
change.

## The screens

1. **Sign in.** Email, password, and a link to the reset. One error message,
   because Supabase gives only one.
2. **Create an account.** Email, password, then "check your email to confirm".
   If the address already has an account, say so here rather than silently
   doing nothing.
3. **Forgot your password.** Email, then "check your email".
4. **Set a new password.** Reached from the emailed link.

## What comes out

- `signInWithMagicLink`, `signInWithCode`, `createAccount`
- The six-digit code box
- "Clear sign-in data on this device"
- `lib/auth/callback.ts` reasons about dead links, and the four messages for them

## What stays, and why

- **The outage detection in `lib/auth/send-outcome.ts`.** A password sign-in
  against a project that is not answering fails identically, and it must still
  say so rather than blaming the password.
- **The clock-skew wait in `lib/data/clock-skew.ts`.** A password sign-in mints a
  session the same way a link does.
- **"Signed in as" in the header, and the note on the empty dashboard.** These
  stop being a nice addition and become the only place the wrong-account problem
  can be caught, given Supabase will not distinguish the errors.
- **`app/(auth)/callback/route.ts`, in a reduced form.** It cannot be deleted:
  confirming a new account and resetting a password both arrive as an emailed
  link that has to land somewhere. It stops handling sign-in and handles those
  two only.

## The four accounts that already exist

They were created by magic link and have no password. **Nobody's work is touched
and no account is recreated.** Each person uses "Forgot your password" once to
set one, which is the only route that does not involve a password being generated
for them and sent to them.

## Staged build

**Stage 1. Verify, write nothing. Done 2026-09-21**, results above.

**Stage 2. The four screens and the actions behind them. Done 2026-09-21.**
Sign in, create an account, forgot password, set a new password, sharing one
frame in `components/auth-page.tsx`. Out went the six-digit code box, the browser
reset, and the four messages for four ways a link dies. Checked against the live
database: a real account with a wrong password gives the right message, no
account was created and no email sent.

**Stage 3. The reduced callback. Done 2026-09-21.** Two links reach it, handled
identically because they are the same operation, and only the destination
differs. **A recovery link lands on the password form whether or not `next`
survived the mail client**, because landing it on the dashboard would leave the
person signed in holding the password they came to change. `magiclink` is gone
from the link types.

**Stage 4. Deploy, verify on production, then the three of them set a password
through "Forgot your password".** That last part is the only one that needs
anybody told anything, and it is a message from Irene rather than a build step.
