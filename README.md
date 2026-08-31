# Slippery

A bet tracker for UK and Irish bettors. You place a bet, screenshot the slip,
and forward it to a Telegram bot or upload it or type it in. Slippery reads it,
shows you what it found, writes it to the ledger when you confirm, settles it
when the result lands, and reports what the record says.

**Capture happens at placement, not at settlement.** That is the whole idea: a
record made before you know how it went cannot quietly become only the bets you
wanted to remember.

Slippery never accepts bets, holds money, pays winnings or gives tips. That is
legally load bearing, not a disclaimer, and no feature may cross the line.

Live at **https://slippery-iota.vercel.app**.

---

## The one thing to understand before changing anything

**A bet is a container with a settlement ledger, not a row with a result.**

`settlement_events` is append only. `bet_state` is a fold over it, recomputed
by exactly one function inside the same transaction as every write. Every
figure in the product reads `bet_state`. Nothing reads `settlement_events` for
display.

This is why repeated partial cash outs, exchange commission, a Rule 4
deduction and a promo refund that lands a week later are all representable
through one mechanism, when a single result column could hold none of them.

```
lib/domain/fold.ts          the fold. The only writer of bet_state.
lib/settlement/engine.ts    the grader. Pure, shared by the button and the cron.
tests/fold.test.ts          the rules that cost money to get wrong.
```

## Layout

```
app/
  (marketing)/     the public site: landing, how, pricing, faq, themes,
                   groups, import, terms, privacy. Static.
  app/             the product: dashboard, ledger, social, import, you,
                   settings, billing, states. Dynamic.
  api/             route handlers: sources, telegram, stripe, cron, extract
  styles/          the design system, one file per concern
components/        the view layer
lib/
  domain/          types, the fold, the trial
  settlement/      the grader
  data/            reference data, the example account, analytics
  server/          codes, validators
migrations/        checked in SQL, applied forward only
tests/             node:test
tools/             the real browser audit
```

## Commands

```
npm run dev        develop
npm run build      build
npm test           the rule tests
npm run audit      every route, four viewports, eight themes, in real Chromium
npm run db:migrate apply the checked in migrations
```

`npm run audit` needs the built app running (`npm run build && npm start -- -p
3100`) and Chromium. It writes screenshots to `test-results/`.

## Environment

Server only, every one of them. None may appear in a client component.
`ENVIRONMENT.md` is the canonical list.

| Variable | Without it |
|---|---|
| `DATABASE_URL` | The app renders from the example account and every write route answers 503 honestly |
| `AUTH_SECRET` | Sessions fall back to a development secret. Set it. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign in says it is not set up |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments say they are not set up |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | The plan cannot be started |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | The webhook 401s everything, which is the safe direction |
| `VISION_API_KEY` | Slip reading is down. `ANTHROPIC_API_KEY` is read as a fallback. |
| `EMAIL_API_KEY` | Codes are not sent, and are still never logged |
| `ADMIN_SECRET` | The admin levers refuse |
| `CRON_SECRET` | The sweep accepts unsigned calls. Set it. |

`GET /api/sources` reports which of these a running deployment has, **by name
and boolean only**, so "why is slip reading down on production" is one request
rather than an hour of guessing.

## Deploying, and the four things that bite

0. **`vercel.json` states the build settings on purpose, and must stay schema
   clean.** Vercel copies `framework`, `buildCommand`, `installCommand`,
   `outputDirectory` and `regions` into the project's own settings the first
   time it sees them, and deleting them from the file does not delete them
   from the dashboard. The values here override the dashboard, which makes the
   build reproducible from the repository rather than from a settings page
   nobody can diff.

   **Vercel rejects any top level key outside its schema and fails the whole
   deployment in about fifteen seconds, before a build starts, pointing at the
   project configuration docs rather than naming the key.** A `$comment` key is
   enough to do it. `$schema` is the only non setting key it allows, which is
   why this explanation is here and not in the file.

1. **`public/sw.js` is a tombstone, not a service worker.** A previous build
   installed a cache first worker at that path. Anybody who added the web app
   to their home screen still has it, and it will keep serving the old shell
   from disk regardless of what is deployed. The file at that path now clears
   every cache, unregisters itself and reloads once. **Do not delete it until
   the installs have turned over.**

2. **Migrations are files, applied forward only.** The old app ran DDL from
   inside request handlers, so no deployment could say what its database
   looked like. `npm run db:migrate` reads `migrations/*.sql` in order and
   records what it applied.

3. **Vercel's file tracer only follows literal import specifiers.**
   `await import(someVariable)` compiles fine and then fails in production with
   `Cannot find module`, because the file was never bundled. Import server
   modules statically and hold them in a table.

## Compliance

18+ acceptance is stored with a timestamp. Every public page carries 18+,
BeGambleAware.org and the National Gambling Helpline number. Slip images are
deleted after 90 days by the cron, or immediately on request, and the gallery
shows an honest "image removed after 90 days, bet kept" state rather than a
broken thumbnail. Export always works, including in read only and after
cancelling, because a betting record belongs to the person who kept it.

The store badges are **not** drawn by hand. Apple and Google both forbid
redrawing or recolouring their artwork and both require a live listing, so the
landing page ships one line of text instead. `brand/store-badges/README.md`
says exactly where to drop the official downloaded files and what the clear
space rules are.

## The specification lives in the repository

`SPEC.md` is the data and behaviour specification: the model, the rulings, the
screens, the bot's reply table and the compliance requirements. `CLAUDE.md` is
the founding brief with its LOCKED rules. `DECISIONS.md` records every
judgement call and why.

**There is no prototype.** SPEC.md's original text repeatedly deferred to
`slippery-prototype.html` on anything visual. That file no longer exists and is
not coming back. The visual design in this repository is its own; SPEC.md still
wins on rules, data and behaviour.
