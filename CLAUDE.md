# Slippery, the founding brief

Recovered from `dee44bd^` and edited so the next session does not have to dig
it out of history. Three things in the original are now stale and have been
corrected in place, each marked **SUPERSEDED** with the reason.

Everything under `## LOCKED` may not change without asking the owner first.

---

## PRODUCT

Bet slip tracker. Forward a slip screenshot to a Telegram bot when you
**place** it. Slippery reads stake, odds, selection and bookmaker off the
image, tracks it live, settles it, and shows real profit and loss on a
calendar. Groups rank friends in units, never in pounds.

**Capture at placement, not settlement.** That is what stops people logging
only their winners. It is the core idea. Do not lose it.

Slippery never accepts bets, holds money, pays winnings or gives tips. That is
legally load bearing, not a disclaimer, and no feature may cross the line.

Free trial, then £3.49 a month or £29.99 a year.

## ENVIRONMENT

| | |
|---|---|
| Repo | `SlipperyApp/Slippery`, **public** |
| Live | https://slippery-iota.vercel.app |
| Bot | `@SlipperyAppBot` |
| Deploy | Vercel, automatically on push to `main` |
| Secrets | `process.env` only. Never into a file, a commit, a log or a message. |

`ENVIRONMENT.md` lists every variable by name. The values live in Vercel.

## LOCKED, do not change without asking

- The settlement rules below. Every one is a bug that would corrupt real
  profit and loss.
- The iOS constraints below. Each came from a real device failure.
- `#86EFAC` profit and `#FCA5A5` loss as semantic colours, never theme
  dependent.
- Capture at placement as the core product idea.
- A single deployable output that Vercel serves on push, with no manual step.

Everything else is open.

## SETTLEMENT. DO NOT SIMPLIFY.

**The rule above all the others: a wrong grade is worse than no grade.**
Anything uncertain resolves to `ask` and never to a guess.

- 90 minutes only. Extra time and penalties never count. No 90 minute score in
  the feed means ask.
- Whole lines **push**. Over 2.0 on a 1-1 is a void, not a loss.
- Quarter lines **split** the stake. Over 2.25 on a 1-1 loses half.
- Handicaps differ **by bookmaker**, from a lookup table, never hardcoded.
  bet365 is Asian, so a whole line pushes. The others are European: the
  handicap draw is its own outcome, so a -1 acts like a -1.5 and that
  scoreline loses.
- Postponed and cancelled are void. Abandoned asks, because bookmakers differ.
- Always ask: player props, anytime scorer, cards, corners, bet builders, same
  game multis, rest of match, next goal.
- Accumulators defer until every leg grades. Void legs drop and the odds
  recalculate.
- Cash out is undetectable from a feed and is always a user action.
- Six outcomes: won, lost, cash-profit, cash-loss, cash-flat, void. Void means
  stake returned and zero profit.

Implemented in `lib/settlement/engine.ts`, which is pure: no DOM, no globals.
Covered by `tests/settlement.test.ts`.

## THE DATA MODEL IS THE MOST IMPORTANT THING IN THE BUILD

A bet is a container with a settlement ledger, not a row with a result.
`settlement_events` is append only. `bet_state` is a fold over it, recomputed
by exactly one function inside the same transaction as every write. Every
displayed figure reads `bet_state`; nothing reads `settlement_events` for
display.

That is what makes repeated partial cash outs, exchange commission, a Rule 4
deduction and a promo refund landing a week later all representable through
one mechanism, where a single result column could hold none of them.

Partial cash out is in **eighths of remaining stake**, relabelled after each
pull, repeatable, and never eighths of the original stake.

`lib/domain/fold.ts` is the fold and the only writer of `bet_state`.

## MOTION AND BACKGROUNDS

The app should feel alive: animated drifting backgrounds behind content across
the whole site, not just the landing hero. Layered gradients, slow parallax,
subtle grain, colour that shifts per theme.

Non negotiable with it:

- `transform` and `opacity` only. Never animate width, height, top or left.
- Decorative layers inside `overflow: hidden`. Uncontained blobs previously
  caused 47px of horizontal scroll on a phone.
- Honour `prefers-reduced-motion` everywhere.
- Do not eat the `backdrop-filter` budget (see the constraints below).
- Profile scroll on a real mobile viewport.

**A live `filter: blur()` is banned in the background layer.** It is
re-evaluated every scroll frame regardless of whether anything animates:
measured 49.9ms p95 with it, 16.8ms without. The gaussian is baked into an SVG
with `feGaussianBlur` and used as a mask instead.

**SUPERSEDED: scroll jacking is in.** The brief originally listed it under
"already tried, rejected". What was rejected was *mandatory* snap, which traps
people. The landing sequence keeps the five properties that are the entire
difference: a real tall track, a `position: sticky` stage rather than fixed,
proximity snap, no intercepted wheel or touch events, and a full collapse
under `prefers-reduced-motion`.

## CONSTRAINTS, LEARNED THE HARD WAY

**Testing.** jsdom has no layout engine: `offsetWidth` is 0 and CSS is never
applied. A previous build passed every jsdom test while scrolling sideways on a
phone with 79 `backdrop-filter` elements causing scroll stutter. Render in a
real browser and look at the screenshot.

**iOS Safari is the primary target.**

- No `localStorage` and no `sessionStorage`.
- Every input, select and textarea at 16px or larger, or iOS zooms on focus
  and never zooms back.
- `100svh`, never `100dvh`: dvh recalculates when the toolbar shows or hides
  and sticky layouts visibly breathe.
- At most about three `backdrop-filter` elements. A previous build shipped 79
  and stuttered.
- No `content-visibility`: Safari 18 will not paint SVG text inside it.
- Ship both the `-webkit-` prefixed and the standard `backdrop-filter` and
  `mask-image`.
- `viewport-fit=cover` plus `env(safe-area-inset-bottom)` on the fixed bottom
  nav.
- Mobile first. Check 320, 390 and 430.

**Design.**

- `#86EFAC` profit, `#FCA5A5` loss. Semantic, never theme dependent. No theme
  accent may sit near either, which is why there is no green theme and no red
  theme.
- **SUPERSEDED: there is no light mode at all.** It was tried and rejected:
  profit green measures 1.07 to 1 on beige, which is invisible. All eight
  themes are dark.
- Do not use Inter, Geist, Space Grotesk or Plus Jakarta as the UI face. They
  read as AI generated.
- Tabular figures on every money value, or digits jitter and columns misalign.
- No emoji as an interface element. They rasterise from the system font, so
  they cannot take the profit or loss colour, and they differ per platform.
  Use an SVG symbol.
- British spelling. No em dashes anywhere.

**Hygiene.** Two real bugs came from class collisions: a sparkline using
`.bar` inherited the sticky header's `backdrop-filter` and `position: sticky`
for 69px of overflow, and a text line using `.sel` rendered as a dropdown.
Check a class is free before reusing it.

## THE TRIAL

**SUPERSEDED: the free trial is 14 days or 35 slips**, whichever runs out
first, replacing "20 slips" here and "5 days or 15 slips" in SPEC.md. Both
halves matter and they fail differently, so `trialState()` in
`lib/domain/trial.ts` reports *which* one ran out and every surface shows that
one sentence. `TRIAL_DAYS` and `TRIAL_SLIPS` there are the only place the
numbers live; the client is told the answer rather than counting, so the
counter on the dashboard cannot disagree with what blocks an upload.

## DONE MEANS ALL OF

No horizontal overflow at 320, 390 and 430 · axe-core with zero violations ·
contrast passes in every theme · settlement tests pass · no console errors ·
no duplicate IDs · keyboard operable · scroll stays smooth with the background
motion running · you screenshotted at 390x844 and looked at it.

## FLAG, DO NOT DECIDE

Rotating credentials · anything needing a payment card · the 50 to 100
reference slips for the reader's golden set · sending a real Telegram message ·
the Gambling Commission position on the leaderboard · ICO registration · the
final wording of Terms and Privacy.

## RESPONSIBLE GAMBLING

A red and green grid and a ranked leaderboard are engagement mechanics.
Nothing may nudge toward more volume. Never send a notification about not
having bet, or framed as losing your place, or late at night. "Moving to
League One next month", never "RELEGATED". State the number and stop.
Celebrate app actions, never betting outcomes. There is a "take a break"
control.

## HOW TO WORK

Fully autonomous. Commit and push each milestone to `main`; git history is the
rollback. A branch that is never merged is never deployed. Stop only for the
things in FLAG above.

---

## Repo layout

```
app/                    routes, App Router
  (marketing)/          the public site, static
  app/                  the product, dynamic
  api/                  route handlers
  styles/               the design system, one file per concern
components/             the view layer
  app/                  product components
  marketing/            landing components
lib/
  domain/               types, the bet_state fold, the trial
  settlement/           the grader, pure, shared by button and cron
  data/                 reference data, the example account, analytics
  server/               codes, validators, everything the server knows
  format.ts             every format in one place
  odds.ts               the fractional ladder
tests/                  node:test, run with `npm test`
tools/                  the browser audit and screenshot tools
migrations/             checked in SQL, applied forward only
```

## Commands

```
npm run dev        develop
npm run build      build
npm test           the rule tests
npm run audit      the real browser sweep: every route, every viewport, eight themes
npm run db:migrate apply the checked in migrations
```

## Rules for this codebase

1. `lib/domain/fold.ts` is the only writer of `bet_state`. Every change to it
   needs a test.
2. `lib/settlement/engine.ts` is pure and is the only grader. The browser
   never grades a bet itself, or there would be two graders.
3. Money is integer minor units with a currency code. Format only at the edge,
   through `lib/format.ts`. Pounds and euros are never summed.
4. Secrets come from `process.env` and are never logged or echoed.
5. Every count derives from one query. The facet total equals the row total.
6. Vercel's file tracer only follows literal import specifiers.
   `await import(someVariable)` compiles and then fails in production with
   `Cannot find module`. Import server modules statically and hold them in a
   table.
