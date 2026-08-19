# Slippery — state of the project

A description of what exists today. Not a plan, not a set of instructions.
Everything below is a fact about the codebase as it currently stands.

---

## 1. What the product is

A bet slip tracker. You forward a screenshot of a bet slip to a Telegram bot
**at the moment you place the bet**. The bot reads the stake, odds, selection,
bookmaker and result off the image, tracks the bet live, settles it against a
results feed, and shows the real profit and loss on a calendar. Groups rank
friends in units rather than pounds.

The load-bearing idea is capture at placement rather than at settlement. That
is what stops a record becoming only the bets somebody wanted to remember.

Free trial is **two weeks or 35 slips, whichever runs out first**, then
£3.49/month or £29.99/year. The numbers live in `api/_lib/promo.js`
(`TRIAL_DAYS`, `TRIAL_SLIPS`) and nowhere else; the client is told the answer
rather than counting, so the dashboard counter cannot disagree with what
actually blocks an upload.

---

## 2. Environment

| | |
|---|---|
| Repo | `SlipperyApp/Slippery`, **public** |
| Live | https://slippery-iota.vercel.app |
| Bot | `@SlipperyAppBot` |
| Host | Vercel, auto-deploys on push to `main` |
| Runtime | Node ≥20, ESM throughout |
| Database | Neon Postgres over the HTTP driver (`@neondatabase/serverless`) |
| Model | Anthropic SDK, structured outputs, for slip extraction |
| Deps | 2 runtime (`@anthropic-ai/sdk`, `@neondatabase/serverless`), 3 dev (`esbuild`, `playwright-core`, `axe-core`). No framework, no CSS library, no bundler config. |

`vercel.json` sets the build command, security headers (HSTS, nosniff,
DENY framing, a restrictive Permissions-Policy), a daily cron at 06:00 UTC
hitting `/api/results`, and 60s/1024MB limits on `api/results.js` and
`api/settle.js`.

### Environment variables

Names only. Values are in Vercel and are never written to a file, a commit,
a log or a message — the repo is public and GitHub's secret scanner
auto-revokes anything committed.

**Required for the core product**
`DATABASE_URL` · `ANTHROPIC_API_KEY` · `TELEGRAM_BOT_TOKEN`

**Mail** (verification codes, password resets)
`GMAIL_USER` · `GMAIL_APP_PASSWORD` · `MAIL_FROM` · `SMTP_HOST` · `RESEND_API_KEY`

**Federated sign-in**
`GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `APPLE_CLIENT_ID` ·
`APPLE_TEAM_ID` · `APPLE_KEY_ID` · `APPLE_PRIVATE_KEY`

**Operations**
`ADMIN_SECRET` (authorises `/api/admin/reset`, which can destroy production) ·
`CRON_SECRET` · `TELEGRAM_WEBHOOK_SECRET` · `PUBLIC_BASE_URL` ·
`PUBLIC_ORIGIN` · `PUBLIC_URL`

**Results feeds and tuning**
`FOOTBALL_DATA_TOKEN` · `RESULTS_PROVIDER` · `SOFASCORE_UA` ·
`FLASHSCORE_SIGN` · `SCRAPE_UA` · `EXTRACT_MODEL`

**Supplied by Vercel**
`VERCEL_ENV` · `VERCEL_URL` · `VERCEL_REGION` · `VERCEL_GIT_COMMIT_SHA` ·
`VERCEL_GIT_COMMIT_REF` · `VERCEL_PROJECT_PRODUCTION_URL`

`GET /api/sources` reports at runtime which feeds and variables the running
deployment can actually reach. That is more reliable than reading this list,
because the scrapers are blocked by IP reputation and a local probe does not
predict what a Vercel datacenter IP gets.

---

## 3. Repo layout and build

```
src/                 source of truth
  app.html           all body markup, every view, ~1,700 lines
  icons.svg          SVG sprite, inlined once at the top of <body>
  styles/            11 CSS files, ~3,450 lines, native nesting, one per concern
  js/                20 ES modules, ~9,900 lines
api/                 Vercel serverless functions (Node runtime)
  _lib/              shared server code, including _lib/routes/* sub-handlers
tests/               42 files, 568 tests, node:test
tools/               audit.mjs, apistub.mjs, strings.mjs, gaps.mjs, icons.mjs, preview.mjs
build.mjs            inlines src/ into public/index.html
public/              BUILD OUTPUT, generated
```

`build.mjs` concatenates the CSS, bundles the JS with esbuild into one IIFE,
inlines the sprite and the markup, and writes a single self-contained
`public/index.html` (~397kB) plus the manifest and service worker. There is no
runtime module loading and no external asset except the two preloaded fonts.

**Commands**

```
npm run build     src/ → public/index.html
npm test          568 tests, node:test
npm run verify    build, test, browser audit, string check
npm run strings   regenerate STRINGS.md
node tools/audit.mjs      real Chromium: axe, overflow, console, screenshots
node tools/icons.mjs      re-rasterise PWA icons and og.png
node tools/preview.mjs    one self-contained preview file
```

---

## 4. Data model

18 tables, all created by an idempotent `ensureSchema()` in `api/_lib/db.js`
that runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` on every cold start. There are no migration files.

**Core**

- `users` — identity, credentials, plan, `plan_until`, `promo_code`,
  `trial_ends_at`, `verified`, `onboarded_at`, unit size, privacy, theme,
  Telegram link fields (`telegram_id`, `link_code`, `link_code_expires_at`,
  `link_code_used_at`), `break_until`.
- `bets` — the ledger. `event`, `selection`, `market`, `bookmaker`, `odds
  numeric(10,4)`, `stake_pence integer NOT NULL`, `profit_pence`, `outcome`,
  `status`, `fixture_id`, `placed_at`, `settled_at`, `settle_reason`,
  `source NOT NULL DEFAULT 'upload'`, plus `capture_stage`, `bet_type` and
  `legs jsonb` added by ALTER.
- `pl_entries` — imported or typed profit/loss figures with no bets behind
  them. `on_date`, `period`, `profit_pence`, `turnover_pence`, `bets`, `note`,
  `source`. UNIQUE on `(user_id, on_date, period)`, so re-importing corrects
  rather than doubles.
- `slips`, `slip_drafts` — stored slip images and in-progress reads.

**Auth**

`auth_sessions` · `verification_codes` · `password_resets` ·
`pending_signups` · `oauth_identities` · `oauth_states`

**Social and commerce**

`groups` · `group_members` · `group_requests` · `follows` ·
`promo_redemptions` (UNIQUE on `(user_id, code)`)

**Infrastructure**

`rate_limits` · `telegram_updates` (webhook idempotency)

### Two important distinctions in the data

**`bets.source`** is `'upload'`, `'telegram'` or `'import'`. The first two have
a slip behind them; the third is a row from somebody's spreadsheet. The client
keeps this and shows an "imported" tag.

**`bets` vs `pl_entries`** is the sharper line. A bet is a bet; a `pl_entries`
row is a date and an amount with no bet behind it at all. Both count toward
profit and turnover for the period they fall in. Neither the win rate, the
streak, nor best/worst day ever sees a `pl_entries` row, because there is no
result to describe. The Ledger has a History tab showing the addition.

---

## 5. Server

Eleven serverless functions. Vercel's Hobby plan caps at twelve, and going
over the cap fails the build **silently** — no error, the functions simply do
not deploy. This is why `api/auth/[action].js` is one route dispatching to
fourteen sub-handlers in `api/_lib/routes/`, and why `api/bets.js` handles
bets, bulk import, P/L rows and deletion on one path.

| Route | Job |
|---|---|
| `api/bets.js` | list, create, bulk `createMany`, settle by hand, delete, P/L rows |
| `api/extract.js` | slip image or PDF or text → structured fields |
| `api/settle.js` | the refresh button: grade this user's running bets now |
| `api/results.js` | the cron sweep, same job for everyone, daily |
| `api/telegram.js` | bot webhook |
| `api/auth/[action].js` | signup, verify, resend, login, logout, me, profile, forgot, reset, link, break, close, oauth |
| `api/groups.js` | groups, membership, requests, public directory |
| `api/people.js` | follows |
| `api/promo.js` | redeem a code |
| `api/sources.js` | diagnostics: which feeds and vars this deployment has |
| `api/admin/reset.js` | destructive admin operations, gated on `ADMIN_SECRET` |

### Shared server library

`db.js` (schema + connection) · `auth.js` (hashing, sessions, codes, pending
signups) · `http.js` (JSON, method guard, cross-origin check) · `rate.js`
(database-backed rate limits) · `promo.js` (codes, trial, billing state) ·
`mail.js` + `smtp.js` · `oauth.js` (PKCE S256, JWKS verification via
`node:crypto`, Apple ES256 client secrets) · `settling.js` (the one grader
entry point shared by the button, sign-in and the cron) · `groups-core.js` ·
`bot-strings.js` (every bot message and the link-code rules) ·
`fixtures.js` + `espn.js` + `sofascore.js` + `footballdata.js` +
`footballdatauk.js` + `flashscore.js` (the results chain) · `net.js` (shared
fetch with a circuit breaker).

### Notable server behaviours

- **Neon's HTTP driver cannot compose nested `sql` tagged-template fragments.**
  Writing `` sql`WHERE ${cond ? sql`a` : sql`b`}` `` compiles and then throws at
  runtime. `tests/sql-composition.test.mjs` scans for it.
- **Vercel's file tracer only follows literal import specifiers.**
  `await import(someVariable)` compiles and then fails in production with
  `Cannot find module`. Server modules are imported statically and held in a
  table.
- Settlement writes happen on the server only. The browser asks and re-reads.
- Money is integer pence everywhere. Formatting happens at the edge.
- Session cookie `slippery_session`, HttpOnly, SameSite=Lax, 30 days, plus an
  explicit cross-origin check on writes (Apple's OAuth callback is the one
  legitimate cross-site POST).

---

## 6. Client

One bundle, no framework. State lives in `src/js/state.js` (`S`) and
`src/js/data.js` (the hydrated stores: `LEDGER`, `PENDING`, `PL`, `DAY_TOTALS`,
`PEOPLE`, `GROUPS`, `ME`, `TRIAL`, `CAPTURE`). `hydrate()` fills them from
`GET /api/bets`. Every displayed figure is derived from those stores.

| Module | Lines | What it is |
|---|---|---|
| `main.js` | 3,280 | Router, one delegated click handler, import flows, settlement UI, wiring |
| `render.js` | 1,367 | Every render function for the signed-in app |
| `content.js` | 853 | Marketing copy and the landing page's rendered blocks |
| `settlement.js` | 680 | The grading engine. Pure. Imported by browser and server |
| `auth.js` | 495 | Signup, login, verification, reset, the wizard's step 0 |
| `sample.js` | 407 | The fabricated demo dataset, seeded and deterministic |
| `stats.js` | 385 | Period scoping, reconciliation, all derived figures |
| `data.js` | 340 | The stores and hydration |
| `tour.js` | 296 | The interactive walkthrough |
| `pages.js` | 281 | Reference pages: bookmakers, FAQ, changelog, utilities |
| `botsetup.js` | 247 | The Telegram connection flow |
| `csv.js` | 235 | Spreadsheet parsing and column mapping |
| `motion.js` | 199 | The scroll engine, parallax, scroll-jack driver, count-up |
| `dom.js` | 151 | `$`, `$$`, `esc`, segmented control, focus trap, `RM` |
| `betshape.js` | 132 | Bet validation and classification. Pure, shared with the server |
| `books.js` | 124 | The bookmaker registry. Pure, shared with the server |
| `api.js` | 121 | One `{ok, status, body}` shape for every call; image downscaling |
| `sports.js` | 110 | Sport detection |
| `money.js` | 99 | Formatting |
| `state.js` | 88 | `S` |

**Four modules are imported by both the browser and the serverless
functions**: `settlement.js`, `books.js`, `betshape.js`, `sports.js`. They are
pure — no DOM, no globals, no I/O, no clock reads.

### Views

Seventeen `<section class="view">` elements in one HTML file, switched by
`go(id)` with `history.pushState`:

`landing` `setup` `howto` `pricing` `pay` `dash` `prof` `imp` `settings`
`help` `terms` `privacy` `books` `faqs` `log` `feedback` `util`

`dash` has three panes (Overview, Ledger, Social). The bottom tab bar is
Dashboard · Import · Settings. `tests/routes.test.mjs` asserts every
`data-nav` points at a view that exists and every view is reachable without
typing a URL.

---

## 7. Subsystems

### Settlement (`src/js/settlement.js`)

Turns a selection plus a fixture result into an outcome, or an honest
`{status:'ask'}`. The governing rule is **a wrong grade is worse than no
grade**; every unknown path asks.

- 90 minutes only. Extra time and penalties never count. No provable 90-minute
  score in the feed means ask.
- Whole lines push. Over 2.0 on 1–1 is void, not a loss.
- Quarter lines split the stake.
- Handicaps by bookmaker from a lookup table: bet365 is Asian (whole lines
  push), everyone else European (the handicap draw is its own outcome, so −1
  behaves like −1.5).
- Postponed and cancelled are void. Abandoned asks, because bookmakers differ.
- Always asks: player props, anytime scorer, cards, corners, bet builders,
  same-game multis, "rest of match", "next goal", racing.
- Accumulators: every leg must grade or the whole bet defers; void legs drop
  out and the odds recalculate on the survivors.
- Cash out is undetectable from a feed and is always a user action.

Six outcomes: `won`, `lost`, `cash-profit`, `cash-loss`, `cash-flat`, `void`.
Void returns the stake at £0 profit.

`settle()` receives `betType` and `legs`. A `bet_builder` or `system` bet is
refused before anything is parsed. An accumulator routes to `settleMulti()`,
which reads a fixture per leg.

`tests/settlement.test.mjs` is the largest test file in the project.

### Extraction (`api/extract.js`)

Anthropic structured outputs. The schema uses **sentinel values rather than
nullable unions** (`''`, `'unknown'`, `0`, `returns:-1`) because the API caps
a schema at **16 union-typed parameters** and an earlier version had 29, which
made every request 400. `oneOf()` emits a plain string enum, which costs zero
unions. `tests/extract.test.mjs` counts the budget on every run.

`SLIP_SCHEMA` carries `doc_type` (`bet_slip` / `bet_list` / `pnl_summary` /
`other`), a `bets[]` array where each entry has its own stake, odds, returns,
bookmaker, date, result, capture stage and `bet_type`, and each bet has a
`selections[]` array of legs. `bet_count` equals `bets.length`.

The distinction between a bet and a leg is the stake: legs share one, separate
bets each have their own. The distinction between a bet builder and an
accumulator is the fixture: legs in one fixture are correlated and are a
builder; legs across fixtures are an accumulator. When the reader cannot tell,
`bet_type` is null, named in `unreadable_fields`, and the review card asks.

`sanitise()` turns every sentinel back to null, range-checks every number,
folds bookmaker names through the registry, and names anything it rejected.

Accepted uploads: PNG, JPEG, WebP, PDF, CSV/TSV/TXT, and pasted text. An
unrecognised mime is refused by name rather than relabelled.

### Import

Two jobs behind a chooser on `#imp`:

- **Add a bet** — a slip photo, PDF or pasted text. The reader produces one
  card per bet, each fully editable, each confirmed on its own. A multiple
  keeps its legs and asks for its type if the reader could not tell.
- **Import history** — a spreadsheet, statement or another tracker's profit
  screen. Every parsed row is listed with its date, selection, stake, price
  and bookmaker, individually tickable and editable in place. Edits re-run
  `betProblem()` from `betshape.js`, which is the same function the server
  validates with. Duplicates are detected client-side against the loaded
  ledger on date + selection + stake + bookmaker, the same four fields the
  server keys on, and pre-unticked with the reason shown. Only ticked rows are
  posted. Typed daily/weekly/monthly totals also live here.

`createMany` on the server caps at 1,000 rows, reports
`{imported, detected, duplicates, duplicateRows, rejected}` with per-line
reasons, and hard-codes `source = 'import'`.

### Periods

`S.period` is `a` (all time), `y`, `m`, `w`, or `d` (a single day, reached by
tapping the calendar). `S.year` exists, and every helper takes the year it
means. Each period genuinely changes the query. Weeks are seven days and cross
month and year boundaries.

`reconcile(S)` in `stats.js` returns the public addition: logged bets plus
imported figures equals the net for the period. The Ledger's History tab
renders it.

### Promo codes and billing

Codes are a lookup table in `api/_lib/promo.js`, matched case-insensitively
with spaces and dashes stripped.

| Code | Grant |
|---|---|
| `AK5WRD` | Lifetime. Never pays. |
| `ULTRAS` | 2 months, then monthly. Joins the **Ultras** group. Carries the verified tick. |
| `HBVALUE` | 2 months, then monthly. Joins the **HBValue** group. |
| `SLIPNKWHAVPXTZ5Z` | 12 months of the yearly plan, no card, `renews:false`. |
| `GIFT1` / `GIFT2` | 1 or 2 months. |

`renews:false` means `firstChargeAt()` returns null and `billingState()`
reports `reason:'granted'` with no `dueAt`, so nothing can fall due and the
account lapses to free rather than to a debt when the period ends.

The admin code is in source in a public repository, by the owner's decision.
Anyone reading the repo can grant themselves a year. Rotating it is an edit
and a push.

A code entered at signup travels with the signup and is redeemed by
`verify.js` once the email is proved, so an abandoned signup cannot consume
one. Group joining is handled by `ensurePromoGroup()`: the first redeemer
creates and owns the group, everyone after joins outright.

**There is no payment processor connected.** `#pay` is a labelled mockup with
a disabled card form. `billingState()`, `canSubscribe()` and `firstChargeAt()`
are pure functions ready for one; nothing calls a processor. `cardAdded` is a
placeholder boolean.

### Telegram

Codes are `SLIP-XXXX` — four characters from a 30-character alphabet with no
confusable glyphs, ten-minute TTL, single use, twelve issues per ten minutes.
Stored folded (`SLIP4F2K`), shown with the dash. `normaliseCode()` accepts the
bare four characters too.

`src/js/botsetup.js` is one sheet with four states: explain, code (with a copy
button, a live countdown and a `t.me/SlipperyAppBot?start=CODE` deep link),
waiting (polls `/api/auth/me` ten times at six seconds, with a manual
re-check), and connected. Opened from the setup wizard, from Settings, and
from the last tutorial step. Skippable everywhere but the last state.

The bot distinguishes five link failures: no match, already used, expired,
this chat is on another account, this account is on another chat.

### The tutorial

`src/js/tour.js`. Six steps, each a data descriptor naming a view, a pane, a
CSS selector, an optional `before()` that opens whatever must be open, and
which side the card sits on. Each step navigates, scrolls the target into
view, and cuts a hole in the scrim around it.

The hole is one absolutely positioned div with `box-shadow: 0 0 0 9999px`, so
the dim and the cut-out are the same element. It travels between steps. It has
`pointer-events:none`, so the highlighted control stays live. A target taller
than the space available is framed from its top so the card never covers it.

Completion is `users.onboarded_at`, written through
`POST /api/auth/profile {onboarded:true}`. Skip and finish are the same write.
Settings can replay it.

### The demo

`data-nav="demo"` is intercepted rather than routed. It loads
`demoPayload()` — 486 fabricated bets across 120 days, seeded and
deterministic — into the real store through the same `hydrate()` a real
account uses, and renders through the real renderers. There is no second
implementation of any screen.

It is only offered to somebody with no session. While `S.demo` is true,
`api.js` refuses every request at the single choke point every call goes
through, so no sample bet can reach an account. Leaving empties the store and
repaints. Two years of history sit behind the demo's 120-day window
(`demoPayload({full:true})`) for anything that needs a Yearly period.

### Themes and motion

Six themes: **Periwinkle** (default), **Graphite** (marked as recommended),
**Ink**, **Tide**, **Slate**, **Bronze**. Each supplies fourteen tokens
declared under both `html[data-theme=X]` and `[data-t=X]` — the second is what
lets the settings picker render a live miniature dashboard in each theme.

`#86EFAC` is profit and `#FCA5A5` is loss. They are semantic, never
theme-dependent, and no theme accent sits near either. Zero is never green.

Motion tokens: `--d-press` 140ms, `--d-tip` 160ms, `--d-pop` 200ms,
`--d-sheet` 280ms, `--d-slow` 420ms; `--ease-out` `cubic-bezier(.23,1,.32,1)`,
`--ease-in-out`, `--ease-drawer`, `--ease-spring`. There is deliberately no
`--ease-in`.

`motion.js` owns the only two scroll listeners in the app, both rAF-batched,
and never reads layout inside them. The animated background lives inside
`.sky`, which is `overflow:hidden` and `contain:strict`. The landing page has
a scroll-jacked three-beat sequence on a 150svh track with a sticky stage and
proximity snap, which collapses entirely under reduced motion.

---

## 8. Testing and tooling

**568 tests across 42 files**, `node:test`, no test framework. Most open with
a comment explaining the specific bug they exist to prevent, so the suite
doubles as a history of what has gone wrong.

Coverage includes: the settlement engine (largest file), the extraction schema
and sanitiser, bet type classification, CSV parsing, bulk import and
duplicates, the import review, imported-vs-logged separation, periods, promo
codes and billing, bot setup and link codes, OAuth, CSRF, the tutorial,
routes, controls (no button may be inert), copy truth, motion rules, the
bookmaker registry, the demo sample, and every results provider against
recorded payloads.

**`tools/audit.mjs`** drives real Chromium via playwright-core against the
built page, with `tools/apistub.mjs` intercepting the API and returning
deliberately awkward fixtures. It checks 15 views at 320/390/430px across 6
themes for horizontal overflow, axe violations, console errors, duplicate ids
and em dashes; measures scroll frame times; and drives real journeys — signup,
login, promo, import including the per-row review, Telegram linking, the
tutorial through all six steps, the demo including an assertion that it never
writes, the social directory, routing and history, and the scroll-jack beats.
It writes screenshots to `tools/screens/`.

It exits non-zero on failure. Piping it into `tail` returns tail's exit code,
which has hidden a red audit in this project before.

**`tools/strings.mjs --check`** fails when `STRINGS.md` drifts from the
product. **`tools/gaps.mjs`** finds dead scroll. **`tools/icons.mjs`**
re-rasterises the PWA icons and `og.png`.

Current state: build 0, 568/568 passing, audit 0, strings in sync, scroll p95
16.8ms with no frames over 50ms.

---

## 9. Platform facts that have caused failures here

Recorded because each one was discovered by hitting it.

- **jsdom has no layout engine.** `offsetWidth` is 0 and CSS never applies. A
  previous build passed every jsdom test while scrolling sideways on mobile
  with 79 backdrop-filter elements. Layout and paint questions are only
  answerable in a real browser.
- **Vercel Hobby caps at 12 serverless functions.** Eleven exist. Exceeding it
  fails the build silently.
- **The Anthropic schema caps at 16 union-typed parameters.** Exceeding it
  makes every request 400.
- **Neon's HTTP driver cannot compose nested `sql` fragments.**
- **Vercel's file tracer only follows literal import specifiers.**
- **iOS Safari has no localStorage or sessionStorage in this app's context.**
  All persisted preference state is a column on `users`.
- **iOS zooms on any input under 16px and never zooms back.**
- **`100dvh` recalculates when the toolbar shows or hides**, so sticky layouts
  visibly breathe. `100svh` is used throughout.
- **Roughly three backdrop-filter elements is the iPhone budget** before
  scroll stutters.
- **Safari 18 will not paint SVG text inside `content-visibility`.**
- **A live `filter: blur()` in the background re-evaluates every scroll
  frame** whether or not anything animates: 49.9ms p95 with it, 16.8ms
  without. Gaussian blur is baked into the SVG instead.
- **`build.mjs` fails on a duplicate top-level CSS class** across files. Two
  production bugs came from class collisions: a sparkline using `.bar`
  inherited the sticky header's `position:sticky` and pushed 69px of overflow,
  and a text line using `.sel` rendered as a dropdown.
- **A delegated selector that can match `<html>` or `<body>` kills every
  branch after it.** `[data-theme]` matched every click, because the theme
  lives on `<html data-theme>`, which silently disabled import, signup, the
  unit row and both dropzones. `tools/audit.mjs` reads the handler's selectors
  out of source and fails if any reaches the root.
- **A transform on every child of a container makes each a containing block**,
  which changed how one card measured at 320px and put a pixel of horizontal
  scroll on the dashboard. Caught by the audit during the most recent pass.

---

## 10. What is finished, what is partial, what does not exist

**Working end to end**

Signup with email verification (no `users` row exists until the address is
proved), Google and Apple sign-in, password reset, the Telegram bot and its
link flow, slip extraction from images/PDF/text, single and multi-bet reads,
the import review, bulk CSV import with duplicate detection, typed and
imported P/L figures, automatic settlement on a daily cron and on demand,
manual settlement, the six settlement outcomes, periods, groups and follows,
promo codes, the demo, the tutorial, six themes, take-a-break, account
deletion and data export.

**Partial**

- **Payments.** No processor. `#pay` is a labelled mockup; the billing state
  machine is written and unused.
- **Results feeds.** ESPN, then SofaScore, then football-data.org, tried in
  order. All three block by IP reputation, and none is paid. `GET /api/sources`
  reports what the running deployment can reach. Settlement is reliable enough
  for football; racing is never settled automatically.
- **The dashboard has no by-odds, by-sport or by-competition breakdowns.** The
  data is in every bet and the `.barlist` component exists.
- **There is no cumulative profit chart anywhere in the product**, and nothing
  in the interface claims one. A test enforces that.
- **The reader's per-bet `bet_type` has no golden-set evaluation** against real
  slips. The classification logic is sound and it asks when unsure, but the
  model's accuracy on real bet-builder screenshots is unmeasured.
- **No DOM-level unit tests.** Client behaviour is covered either by
  source-level assertions or by the browser audit.

**Deliberately absent**

No demo data in the app (`data.js` starts empty). No analytics, no tracking,
no third-party scripts — the CSP is `script-src 'self' 'unsafe-inline'`,
`font-src 'self'`, `connect-src 'self'`. No App Store or Play Store presence.

**Known open items**

- `Tester1@Tester.com` and `Tester2@Tester.com` are real accounts with known
  passwords on the public deployment, created for beta testing.
- `ADMIN_SECRET` has been shared into a session transcript and authorises
  destroying production.
- The admin promo code is in public source.
- Flagged as needing a decision rather than an implementation: the Gambling
  Commission position on the leaderboard, ICO registration, an 18+ gate,
  terms and privacy covering slip image retention, and whether a monthly
  profit target belongs in a gambling tracker at all given that red/green
  grids and rankings are engagement mechanics.

---

## 11. Other documents in the repo

- **`CLAUDE.md`** — the founding brief verbatim, the locked sections, the
  constraints, and the working notes. The authoritative statement of intent.
- **`HANDOVER.md`** — three chronological work passes (sections 10, 11, 12),
  each describing what was broken and what changed, each ending with what was
  still owed.
- **`STRINGS.md`** — every user-facing string, generated.
- **`tests/`** — the executable specification.
- `git log` — commit messages are long and explain reasoning.
