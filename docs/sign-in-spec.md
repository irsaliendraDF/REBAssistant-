# Sign-in, second pass

**Decided 2026-09-21 by Irene Saliendra after the second paused-project outage.**
Not yet built. Staged below so each step is approved before the next.

## The problem this solves

Sign-in creates an account for any address typed into it, silently, because
`signInWithOtp` is called with `shouldCreateUser: true`. Nothing fails. The
person gets a link, signs in, and lands on an empty dashboard.

That is not hypothetical here. One researcher reached the product under three
addresses and had work under two of them. From her side that reads as "I cannot
sign in" or "my work is gone", and it reaches the builder as a login complaint,
which is where the last month of sign-in fixes came from.

`docs/decisions.md` already names the goal: *"one identity per researcher, so
their saved details are reused rather than fragmented across two accounts they
did not realise were different."* Silent creation is what defeats it.

## The decision

**Keep sign-up open. Stop creating accounts as a side effect of a typo.**

Rejected: an invite list, and a `@dal.ca` domain rule. Both were considered on
2026-09-21. The domain rule fails on its own client contact, who is on
`futurecivics.ca` and holds the only completed application in the system. The
invite list puts a support task on the builder for every new researcher.

## How it behaves

1. Researcher types an address and submits.
2. The app asks Supabase for a link with **`shouldCreateUser: false`**.
   - **Known address:** the email goes, and the screen is what it is today.
   - **Unknown address:** no account is created and no email is sent. The screen
     says there is no account for that address yet, shows the address back, and
     offers two things: correct it, or create an account for it.
3. Creating an account is a **second, deliberate submit** on that screen. Only
   then is the call repeated with `shouldCreateUser: true`.

A person who mistypes gets the correction path. A person who genuinely is new
gets in, in one extra click. Neither one ends up with a second silent account.

## What this trades away

**It tells an anonymous visitor whether a given address has an account.** That is
user enumeration and it is a real cost, stated here rather than discovered later.
It is accepted because the alternative is the failure above, the user base is a
named set of Dalhousie researchers, and the accounts hold no participant data by
design. **If the product ever opens beyond a known cohort, reopen this.**

## Staged build

Each stage is reported before the next begins.

**Stage 1. Verify, write nothing.** Confirm the Supabase error for an unknown
address with `shouldCreateUser: false` is distinguishable in code from a rate
limit and from an unreachable project. The whole design rests on telling those
three apart, and the last two outages were both misread failures. Report the
exact error shape.

**Stage 2. The sign-in flow.** `signInWithMagicLink` passes
`shouldCreateUser: false`, a new `unknown_address` state on the sign-in screen,
and `createAccount` as a separate server action. Tests for each branch.

**Stage 3. Say which account you are in.** The dashboard and the app shell name
the signed-in address. An empty dashboard under the wrong address currently
looks identical to lost work. **Cuttable if Irene wants stage 2 alone.**

**Stage 4. Deploy and verify on production**, with the callback probe below.

## The one-request test for "is the database up"

Not part of this build, recorded because it cost a morning twice.

```
curl -s -o /dev/null -w "%{redirect_url}\n" \
  "https://reb-assistant.vercel.app/callback?token_hash=probe000000000000000000000000000000&type=email"
```

- `error=link_expired` means Supabase is answering. The problem is elsewhere.
- `error=exchange_failed` means it is not. Check whether the project is paused.

It sends no email and creates nothing. For about two minutes after a restore the
host answers `521, web server is down`, which is the expected middle state.

## Still not done, and it is the bigger one

**Supabase is on a plan that pauses when idle.** It has taken the product down on
26 August and again on the weekend of 19 September. `docs/handover.md` names
moving off that plan as the cheapest reliability improvement available here, and
calls this product's usage pattern the worst possible fit for it: researchers use
an ethics tool hard for a week and come back months later.

**No sign-in change in this document prevents that outage.** It is a billing
decision and it is separate from this build.
