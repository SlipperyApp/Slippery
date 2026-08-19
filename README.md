# Slippery

A bet tracker for UK and Irish bettors. You place a bet, screenshot the slip,
and forward it to a Telegram bot or upload it or type it in. Slippery reads
it, shows you what it found, writes it to the ledger when you confirm,
settles it when the result lands, and reports what the record says.

**Capture happens at placement, not at settlement.** That is the whole idea:
a record made before you know how it went cannot quietly become only the bets
you wanted to remember.

Slippery never accepts bets, holds money, pays winnings or gives tips. That is
legally load bearing, not a disclaimer, and no feature may cross the line.

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
lib/db/recompute.ts     the fold. The only writer of bet_state.
lib/server/bets.ts      appendEvent: the only path that adds an event.
tests/recompute.test.ts eighteen rules that cost money to get wrong.
```

## Layout

```
app/                  routes and route handlers
  [[...slug]]/        every view, prerendered, one URL each
  api/                the server: auth, bets, extract, telegram, stripe, cron
  proto.css           the design system, ported from the prototype
  fonts.css           three faces, self-hosted
components/           AppShell, the bridge between the view layer and Next
lib/
  db/                 schema, migrations, the bet_state recompute
  proto/              the view layer and the route table
  server/             everything the server knows
  settlement/         the grader, pure, shared by the button and the cron
drizzle/              checked-in migrations, applied forward only
tests/                node:test, plus the browser audit under tests/e2e
```

## Commands

```
npm run dev        develop
npm run build      build
npm test           unit and rule tests
npm run e2e        the browser audit: six viewports, every route, eight themes
npm run db:migrate apply the checked-in migrations
npm run verify     build, test, audit
```

`npm run e2e` needs the built app running (`npm run build && npm start`) and
Chromium. It writes screenshots to `test-results/`.

## Environment

Server only, every one of them. None may appear in a client component, and
the audit greps the built bundle for all of their names and values.

| Variable | Without it |
|---|---|
| `DATABASE_URL` | The app renders and every data route answers 503 honestly |
| `AUTH_SECRET` | Verification codes fall back to a development secret. Set it. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign in says it is not set up |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments say they are not set up |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | The plan cannot be started |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | The webhook 401s everything, which is the safe direction |
| `VISION_API_KEY` | Slip reading is down. `ANTHROPIC_API_KEY` is read as a fallback. |
| `EMAIL_API_KEY` | Codes are not sent, and are still never logged |
| `ADMIN_SECRET` | The reset and webhook levers refuse |
| `ADMIN_PROMO_CODE` | The admin grant does not exist. It is not in source: this repository is public. |
| `CRON_SECRET` | The sweep accepts unsigned calls. Set it. |

`GET /api/sources` reports which of these a running deployment has, by name
and boolean only, so "why is slip reading down on production" is one request
rather than an hour of guessing at a local probe with a residential IP.

## Deploying, and the three things that bite

1. **`public/sw.js` is a tombstone, not a service worker.** The previous build
   installed a cache-first worker at that path. Anybody who added the web app
   to their home screen still has it, and it will keep serving the old shell
   from disk regardless of what is deployed. The file at that path now clears
   every cache, unregisters itself and reloads once. **Do not delete it until
   the installs have turned over.**

2. **The Telegram webhook is repointed by hand.** `POST /api/admin/webhook`
   with the `x-admin-secret` header. The old deployment called `setWebhook`
   from inside its results cron, so the first deployment whose cron fired took
   the bot over. That is a coin toss, not a cutover.

3. **Migrations are files, applied forward only.** The old app ran DDL from
   inside request handlers, so no deployment could say what its database
   looked like. `npm run db:migrate` reads `drizzle/*.sql` in order and
   records what it applied.

## Wiping and reseeding

`POST /api/admin/reset` with `x-admin-secret`. **A dry run is the default**: it
reports the counts it would delete and writes nothing. Send `{"confirm":true}`
to actually wipe every account and recreate `Tester1@Tester.com`.

## Compliance

18+ acceptance is stored with a timestamp. Every public page carries 18+,
BeGambleAware.org and the National Gambling Helpline number. Slip images are
deleted after 90 days by the cron, or immediately on request. Export always
works, including in read only and after cancelling, because a betting record
belongs to the person who kept it.

**The store badges in the landing page are drawn to specification and must be
replaced with the official downloaded assets** from Apple's Marketing
Resources and Google's Partner Marketing Hub before launch. Both forbid
modification, both require clear space of a quarter the badge height, and
Apple requires a 40px minimum onscreen height. Neither permits a modified
"coming soon" badge, which is why that line is separate text.
