# Slippery — handover

You are picking up a product that is deployed, working, and roughly 60%
finished against its brief. This document is everything you need to
continue without the conversation that produced it.

Read `CLAUDE.md` first — it is the owner's founding brief, saved verbatim,
and it outranks this document wherever the two disagree. Then read
`STRINGS.md`, which is every user-facing word in the product, generated
from source.

**Deliberately not in here: how anything looks.** The owner is redoing the
visual design from scratch. Layout, colour, spacing and component
appearance are yours to decide. What is written down is structure,
behaviour, copy, and the constraints that have already cost money to
learn.

---

## 0. Secrets — read this before you touch anything

Every credential below lives in **Vercel environment variables** for the
project. Read them there. They are not in this repo and must never be.

```
ANTHROPIC_API_KEY        reading slips
TELEGRAM_BOT_TOKEN       the bot, @SlipperyAppBot
TELEGRAM_WEBHOOK_SECRET  proves an update really came from Telegram
CRON_SECRET              authorises the 20-minute results sweep
ADMIN_SECRET             authorises the destructive reset endpoint
GMAIL_USER               outbound mail
GMAIL_APP_PASSWORD       outbound mail
MAIL_FROM                the From address
DATABASE_URL             Neon Postgres, set by the Neon integration
RESEND_API_KEY           created, deliberately unused
FOOTBALL_DATA_TOKEN      never created, results are scraped instead
```

**The repository is PUBLIC.** GitHub's secret scanner auto-revokes anything
committed, which will take the product down. `process.env` only. Never
write a key, a token, a webhook secret, a link code, a session cookie or a
password into a file, a commit, a log line, a test fixture, a chat message
or an error response. `GET /api/sources` is the pattern to copy: it reports
every variable as a boolean, never a value.

If you are told a secret in conversation, do not repeat it back and do not
put it in a file. Ask for it to be set in Vercel instead.

---

## 1. Skills installed in this repo

`.claude/skills/` holds 23 skills. Twelve are tracked in `skills-lock.json`
with their sources:

**From `emilkowalski/skills`** — UI polish and motion judgement, which is
the house style this product was built to:

| Skill | Use it for |
|---|---|
| `animate` | Building an animation from scratch: whether it should animate at all, which properties, which curve, how it interrupts |
| `animation-vocabulary` | Naming a motion effect you can only describe |
| `apple-design` | Gesture-driven UI, spring physics, interruptible transitions, typography, reduced-motion |
| `emil-design-eng` | The philosophy behind UI polish and the invisible details |
| `find-animation-opportunities` | Finding places that should animate and rejecting places that should not |
| `improve-animations` | Auditing a codebase's motion and producing a prioritised plan |
| `review-animations` | Critiquing motion in a diff |
| `pick-ui-library` | Choosing a component library |
| `prototype` | Fast throwaway builds |
| `ask-sonner` | The Sonner toast library |

**From `vercel-labs/agent-skills`**: `web-design-guidelines` — reviewing UI
code against the Web Interface Guidelines.

**From `anthropics/skills`**: `webapp-testing` — driving a local web app
with Playwright, screenshots and console logs.

Eleven more are present without lock entries: `accessibility-audit`,
`banner-design`, `brand`, `design`, `design-system`, `frontend-design`,
`shadcn-ui`, `slides`, `ui-styling`, `ui-ux-polish`, `ui-ux-pro-max`.

Given that the visual design is being redone, `frontend-design`,
`ui-ux-pro-max`, `apple-design`, `animate` and `accessibility-audit` are
the ones that will earn their keep. `webapp-testing` matters because of the
testing constraint in section 6.

---

## 2. betr.pro — the benchmark, and exactly how it is written

The owner supplied a 70-page reference pack (betr.pro's landing page,
pricing, sign up, verify, changelog, dashboard, import) and said: **match
its structure and wording closely, keep our own visual identity.** They
have the author's permission to reproduce structure and wording.

You will not have the pack. Here is what matters about it, which is the
writing rather than the styling.

### 2.1 The repeating section pattern

betr.pro's landing page is one component repeated eight times with a
different accent colour. Every section has exactly these six parts in this
order:

1. **A pill badge** — an icon plus two or three words. `Powered by AI`,
   `Effortless Import`, `Football Analytics`, `Horse Racing Analytics`,
   `Telegram Bot`, `PRO Feature`.
2. **A two-line headline.** Line one is plain, line two is in the section's
   accent colour, and **line two carries the claim while line one is only
   the setup**. `Screenshot to data / in seconds.` — `Switch in seconds, /
   not hours.` — `Every league. Every team. / Automatic insights.` — `From
   race cards to / closing line value.` — `Send a bet on Telegram. / It's
   tracked instantly.` — `Built for tipsters. / Share your edge.`
3. **One paragraph, two sentences maximum.** Never three.
4. **Three or four full-width stacked rows**, each an icon tile, a bold
   title of two to four words, and a grey subtitle of one short sentence.
   **Exactly one row is highlighted.** Examples of the pairing:
   `Upload screenshots` / *Drop one or multiple bet slip images*;
   `AI analyzes` / *Our vision AI extracts all bet details*;
   `Smart autocomplete` / *Find any fixture instantly as you type*;
   `Automatic linking` / *Bets matched to fixtures with fuzzy matching*;
   `Competition P&L` / *See which leagues are most profitable*.
5. **Four checkmark items in a 2×2 grid**, each two to four words:
   `Any bookie supported`, `Batch processing`, `Under 10 seconds`,
   `Works with any tracker`, `Preserves all data`, `Duplicate detection`,
   `GB & Ireland coverage`, `Automatic SP backfill`, `Turf vs AW breakdown`.
6. **A live component demo showing real UI, never a screenshot**, and every
   demo ends with a footer line stating the conclusion, e.g.
   `Best: Good (+8.1%) · Avoid: Heavy (-12.3%)`.

**A chart without a conclusion is decoration.** That line is the owner's
and it is the single most important rule in the whole benchmark. Every
piece of evidence on the page ends with a sentence saying what it means.

### 2.2 Their word choice, precisely

- **Verb-first row titles**: `Export from old tracker`, `Drag to betr.pro`,
  `Instant import`, `Analytics ready`, `Race linking`, `CLV analysis`,
  `Course performance`, `Going analysis`.
- **Sub-lines are declarative fragments, not sentences with subjects**:
  *Download your betting history as CSV or Excel*, *Bets matched to
  official race results*, *Compare your odds to starting prices*.
- **Second person throughout**: "your betting data", "you make money",
  "which quietly bleed your bankroll dry".
- **The hero sub names specific things and ends on what costs you money**:
  *Track every bet, prove your edge with closing line value, and see
  exactly which tipsters, courses, and markets make you money — and which
  quietly bleed your bankroll dry.*
- **CTA pairing is one heavy, one light**: a solid pill button with a
  circular arrow in it, beside a plain underlined text link
  `or see a live demo first`. Never two competing buttons.
- **Eyebrow pill locates the product in one glance**:
  `Bet tracker built for UK & Irish bettors`.
- **Aggregates, never a user count**, in social proof: `£11.7M+ Stakes
  Tracked`, `154.1K+ Bets Analyzed`. Three inline ticks beside them:
  `Cancel anytime`, `Telegram bot included`, `Import from any tracker`.
- **Testimonials are unpolished and anonymous.** No names, no photos, no
  job titles. Real quotes only. Theirs read like messages, e.g. *"Mate -
  your new tracker has been a godsend. It's mental how long I've followed
  loads of groups and staked so much £ blind…"*
- **The changelog is written as what changed for the user, not as commit
  messages**, with `New` / `Improved` / `Fixed` tags and version numbers.
  E.g. *"Races with a non-runner now settle automatically when no Rule 4
  deduction can apply — an ante-post price, or a bet you logged after every
  withdrawal. Anything less certain still waits for you to settle it by
  hand."*
- **Their best trust mechanic, copy the pattern exactly**: on the import
  page, *"We're actively improving extraction accuracy. If a bet is
  extracted incorrectly, tap the flag icon to report it — this helps us
  improve and you'll get a credit back for the trouble."* A flag that
  refunds the credit.
- **Onboarding is six steps**, `Step N of 6`, dot progress, Back / Skip /
  Next, and step five sells with four claims of a headline plus one line:
  *Import 50 bets in 30 seconds / AI-powered screenshot extraction. No
  manual entry.* — *See your true performance / Analytics that reveal which
  strategies actually work.* — *Save 2+ hours every week / Automated
  tracking replaces tedious spreadsheets.* — *Your data, your insights /
  Private by default. Share only what you choose.*

### 2.3 What we deliberately do NOT copy

- **`99.99% accuracy`.** Unmeasured. Claim what can be proved or say nothing.
- **Their palette.** Ours is our own.
- **Their PRO tier's features** — public bankroll pages, priority support,
  multi-bankroll — because we are not building them (section 5).
- **Their pricing.** They are £14.99 and £29.99 monthly. We are far below
  and stay there.

### 2.4 The landing page order the owner specified

Hero, video, AI extraction, bookmaker links, import, football, horse
racing, telegram, tipster tier, feature grid, social proof, testimonials,
FAQ (11+ accordions), app store, final CTA.

**Our order departs from it twice, on purpose.** Capture-at-placement opens
the page, in the slot the benchmark gives to a video, because it is the one
thing nobody can copy and leading with a feature tour argues on their
ground. Settlement follows it, because "it refuses rather than guesses"
only matters once you have accepted that the record should be complete.

---

## 3. What the product is

Slippery is a bet slip tracker. You forward a screenshot of a bet slip to
a Telegram bot **at the moment you place the bet**. It reads the stake,
odds, selection, legs and bookmaker off the image, tracks the bet live,
settles it against results feeds, and shows the real profit and loss on a
calendar. Groups rank friends in **units, not pounds**, so a £10 bettor and
a £500 bettor sit in the same table honestly and neither learns what the
other stakes.

For people who already bet and want to know what their record actually
says rather than what they remember. Not a bookmaker. Takes no bets. Never
handles money. Holds no Gambling Commission licence because it performs no
licensable activity.

- Live: `https://slippery-iota.vercel.app` (stable, the webhook points here)
- Repo: `SlipperyApp/Slippery` — **PUBLIC**
- Bot: `@SlipperyAppBot`
- Deploy: Vercel, automatic on push to `main`, no manual step

### The four locked decisions

Do not change these without asking the owner. Each cost real money or real
trust to learn.

1. **Capture at placement.** Logging at settlement is what turns a tracker
   into a highlight reel of somebody's winners. Everything else follows
   from this.
2. **The settlement rules** (section 4.3). A wrong grade is worse than no
   grade.
3. **The iOS constraints** (section 6.2). Every one came from a device
   failure.
4. **`#86EFAC` profit, `#FCA5A5` loss**, semantic and never
   theme-dependent. No theme accent may sit near either, which is why
   there is no green or red theme.

### Decisions that reversed earlier ones

- **The free tier is 2 weeks OR 35 slips, whichever runs out first** —
  superseding "Free 20 slips" in `CLAUDE.md`. Both halves matter and they
  fail differently, so `trialState()` in `api/_lib/promo.js` reports
  *which* one ran out. `TRIAL_DAYS` and `TRIAL_SLIPS` there are the only
  place the numbers live.
- **Scroll jacking is in**, on the owner's instruction, superseding the
  "already tried, rejected" line in the brief. What was rejected was
  *mandatory* snap.
- **Imports are dated figures, never games** (section 4.4).

### Pricing

£3.49/month or £29.99/year, one paid tier. The recommendation on file is to
keep exactly one: every feature is core to the single idea, so a second
tier would need an invented restriction, and an artificial gate on a £3.49
product costs more trust than it earns.

---

## 4. Architecture

### 4.1 Layout

```
src/                source of truth — edit here, never edit public/
  app.html          all views as <section class="view">
  icons.svg         icon sprite, inlined once at the top of <body>
  styles/           CSS, one file per concern, native nesting
  js/               ES modules, bundled to one IIFE at build time
api/                Vercel serverless functions (Node)
  bets.js           the ledger: list, log, bulk import, settle by hand, delete
  settle.js         the refresh button: look up this user's running bets
  results.js        the cron sweep, every 20 minutes, same job for everyone
  extract.js        slip image or PDF -> structured fields, refuses to guess
  telegram.js       the bot webhook
  groups.js         groups, browse, join requests
  people.js         the Slipper directory and following
  promo.js          promo code redemption
  sources.js        diagnostics: what this deployment can reach
  auth/[action].js  ONE function routing 12 auth actions
  admin/reset.js    destructive reset
  _lib/             shared server code
    routes/         the 12 auth actions
    settling.js     the one grader entry point
    bot-strings.js  EVERY word the bot says
    telegram-setup.js  webhook self-registration
    promo.js        trial, promo codes, subscription state
    espn.js sofascore.js footballdata.js flashscore.js footballdatauk.js
tests/              node:test — 419 tests, `npm test`
tools/
  audit.mjs         real-browser audit: axe, overflow, screenshots
  strings.mjs       generates STRINGS.md, --check fails the build on drift
  gaps.mjs          finds dead scroll by walking text nodes
  apistub.mjs       fakes the backend for the audit
build.mjs           inlines src/ into public/index.html
public/             BUILD OUTPUT — generated, never hand-edit
```

### 4.2 Commands

```
npm run build     src/ -> public/index.html   (Vercel runs this)
npm test          419 tests
npm run verify    build + test + browser audit + STRINGS.md drift check
npm run strings   regenerate STRINGS.md
```

### 4.3 The settlement engine — LOCKED

`src/js/settlement.js` is pure: no DOM, no globals, no side effects. It is
the only module the server shares with the browser. Every change needs a
test.

**Rule: a wrong grade is worse than no grade. Uncertain → `{status:'ask'}`.**

- 90 minutes only. Extra time and penalties never count. No 90-minute score
  in the feed → ask.
- Whole lines PUSH. Over 2.0 on 1–1 is void, not a loss.
- Quarter lines SPLIT the stake. Over 2.25 on 1–1 is half lost.
- Handicaps by bookmaker, from a lookup table, never hardcoded.
  **bet365 = Asian**, whole line pushes. **All others = European**, the
  handicap draw is its own outcome, so −1 behaves like −1.5 and that
  scoreline LOSES.
- Postponed or cancelled = void. Abandoned = ask, because bookmakers differ.
- Always ask: player props, anytime scorer, cards, corners, bet builders,
  same-game multis, "rest of match", "next goal".
- Accumulators: all legs must grade or the whole bet defers. Void legs drop
  and the odds recalculate.
- Cash out is undetectable from a feed. Always a user action.
- Six outcomes: `won`, `lost`, `cash-profit`, `cash-loss`, `cash-flat`,
  `void`. Void = stake returned, £0 profit, neutral colour, never green.

**Racing is never settled automatically.** Place terms, each-way fractions
and Rule 4 deductions are set per race by the bookmaker and are in no feed
we can reach. Racing bets are logged, tracked and counted, and handed back
for manual settlement.

**Settlement writes happen on the server only.** The browser asks and
re-reads. It never grades a bet itself, or there would be two graders.

### 4.4 Money and imports

- **Integer pence internally, everywhere.** Format only at the edge.
- **An import is a dated figure, never a game.** A CSV used to POST every
  row as a bet; those bets could not settle, could not be checked against a
  slip, and polluted every per-market breakdown with unverifiable rows.
  Rows are now summed by date into `pl_entries` and carry their turnover
  and count. Re-importing the same file corrects rather than doubles,
  because the write upserts on `(user_id, on_date, period)`.
- **The overlap rule**: a coarser P/L row is dropped when finer rows fall
  inside it, so a March total and four days in March cannot both count.
- Imported figures move profit and turnover and **never touch the win
  rate**, because a figure with no bets behind it is neither a win nor a
  loss.
- Imported history is **excluded from the capture-rate split**.

### 4.5 Results feeds

Scraped, never an API. `api/_lib/fixtures.js` tries **flashscore →
football-data-uk → espn → sofascore → football-data**. All of them block by
IP reputation and every host answers differently, so
**`GET /api/sources` reports what the running deployment can actually
reach — check it before believing a local probe.** As of the last check
ESPN and SofaScore both return 403 from Vercel; FlashScore and
football-data.co.uk work.

There is a shared fetch with a deadline and a circuit breaker in
`api/_lib/net.js`. A blocked host (403/429/401/451) opens the breaker for
five minutes; a slow host does not.

### 4.6 Hard platform constraints

- **Vercel Hobby allows 12 serverless functions.** Currently **11**. Over
  the limit the build **fails silently** and the old deployment keeps
  serving. This is why `api/auth/[action].js` is one function routing 12
  actions. Add a route to an existing router, not a new file.
- **Vercel's file tracer only follows literal import specifiers.**
  `await import(someVariable)` compiles and then fails in production with
  `Cannot find module`. Import statically and hold modules in a table.
- **Anthropic structured outputs cap union-typed parameters at 16.** Twenty-
  nine of them once made every extraction fail with a 400 that was being
  swallowed, so the slip reader had never worked in production. Sentinel
  values are used instead of nulls; `tests/slip-paths.test.mjs` counts them.

---

## 5. What is built, and what is not

### Working and deployed

- Signup, email verification by six-digit code, login, password reset,
  account deletion. Verified live end to end.
- Telegram webhook, self-registering, secret-enforced, duplicate-safe.
- Account linking, full path matrix (section 5.1).
- Slip extraction, confirm-to-log, drafts with 24-hour expiry.
- Dashboard: calendar, ledger, analysis, social, groups, profiles.
- Groups: every group listed, owner approves joins, browse sorted by
  popularity / newest / alphabetical.
- Imports: CSV, Excel, PDF, screenshots, paste — all to dated figures.
- Public demo on 486 generated sample bets, no account needed.
- Bookmaker pages, four calculators, reference FAQ, roadmap, changelog,
  feedback, utilities.
- Terms and Privacy, 17 sections each, every real processor named.
- Take-a-break, server-enforced, extendable but never shortenable.
- Subscription rules with 15 tests. **No payment processor is connected**;
  the rules exist and the charge does not.

### 5.1 The linking matrix — all eleven paths, each with its own reply

| Path | Behaviour |
|---|---|
| `/start`, unlinked | Full welcome with the how-to |
| `/start`, linked | Names the account, no instructions repeated |
| `/start CODE` (deep link) | Routed to `/link CODE`, same handler, same answers |
| `/link` bare | Asks for the code |
| `/link` valid | Links, stamps `link_code_used_at` |
| `/link` no such code | "did not match" |
| `/link` expired | Distinct message naming ten minutes |
| `/link` already used | Distinct message |
| `/link` chat on another account | **Refuses**, names it, says `/unlink` first |
| `/link` chat on this account | Says so, no-op |
| `/link` account on another chat | **Refuses.** Replacing would let anyone holding a code silently take over where an account's slips arrive |

`/unlink`, `/whoami`, `/help`, `/today`, `/pending`, `/stop` and unknown
commands all have their own replies.

**Link codes**: six characters from `23456789ABCDEFGHJKMNPQRSTVWXYZ` — no
O against 0, no I or L against 1, no U. Generated server-side with
`randomInt`. Ten minutes. Stamped used, not blanked, so "already used" is
distinguishable from "never existed". A confusable character is **refused,
not stripped** — stripping the O from `AB2C3O` leaves five characters and
fails for a reason nobody could work out.

### Not built, and why — do not build these without asking

| | Why |
|---|---|
| Video section on the landing page | No video exists. A play button that does nothing is a fake |
| Google sign-in | Needs OAuth credentials, owner-only |
| Discord | Second bot token, second webhook, owner-only |
| Multi-currency | Needs an FX source and settled-rate storage; faking it corrupts P/L |
| CLV, starting prices, automatic Rule 4 | Need a closing price for every market. No free source publishes it. The *calculators* are built |
| Automatic racing settlement | Needs provable finishing positions. Free sources disagree often enough to be dangerous |
| Public tipster pages, password-shared bankrolls | A public leaderboard of gambling returns needs the Gambling Commission position answered **before** it is built |
| Blog | A content operation, not a product. Left out of the footer rather than linking to an empty page |
| Testimonials | The section renders and `QUOTES = []`. Real quotes only |
| Payment capture | Needs a processor account in the business name. Owner-only |

### Still owed against the brief

Six-step onboarding, the import page rebuilt to the reference (tabs,
credits panel, staged progress, the flag-refunds-a-credit mechanic), daily
analytics with compare-days, the grouped app navigation with a global
period filter, and per-bookmaker SEO pages beyond the template.

---

## 6. Rules that will bite you

### 6.1 Testing

**jsdom has no layout engine.** `offsetWidth` is 0 and CSS never applies. A
previous build passed every jsdom test while scrolling sideways on mobile
with 79 backdrop-filter elements causing scroll stutter. **Render in a real
browser and LOOK at the screenshot.** `npm run verify` does this.

**Verify against production, not locally.** Scrapers behave differently
from a Vercel IP. The last handover-relevant bug was found this way: a link
code was issued and stored correctly and `/api/auth/me` did not return it,
because the session query still selected the column list from before the
feature existed.

**Prove a test can fail.** When you write a test for a control that must
not lie, break the thing deliberately, watch the test go red, then restore
it. Four controls in this codebase once confirmed actions they never
performed.

### 6.2 iOS Safari is primary — LOCKED

- **No `localStorage` or `sessionStorage`.**
- All inputs, selects and textareas **≥16px** or iOS zooms on focus and
  never zooms back.
- **`100svh`, never `100dvh`.** `dvh` recalculates when the toolbar shows
  or hides and a sticky layout visibly breathes.
- **At most ~3 `backdrop-filter` elements** or scrolling stutters.
- **No `content-visibility`** — Safari 18 will not paint SVG text inside it.
- Ship `-webkit-` **and** standard `backdrop-filter` and `mask-image`.
- `viewport-fit=cover` plus `env(safe-area-inset-bottom)` on fixed bottom
  navigation.

### 6.3 Motion and backgrounds

The app should feel alive: animated drifting backgrounds behind content
across the whole site, layered gradients, slow parallax, subtle grain.
Non-negotiable with it:

- **`transform` and `opacity` only.** Never animate width, height, top or
  left.
- Decorative layers inside `overflow:hidden`. Uncontained blobs previously
  caused 47px of horizontal scroll on mobile.
- Honour `prefers-reduced-motion`.
- Must not eat the backdrop-filter budget.
- **A live `filter: blur()` is banned in the background layer.** It is
  re-evaluated every scroll frame whether or not anything animates:
  measured 49.9ms p95 with it, 16.8ms without. Bake the gaussian into the
  SVG with `feGaussianBlur` and use it as a `background-image`.

### 6.4 Class names and selectors

- **Class names are namespaced and `npm run build` fails on a duplicate
  top-level class definition.** This is deliberate: two production bugs
  came from collisions. A sparkline using `.bar` inherited the sticky
  header's `backdrop-filter` and `position:sticky` and pushed 69px of
  overflow; a text line using `.sel` rendered as a dropdown.
- **A delegated selector must not be able to match `<html>` or `<body>`.**
  `[data-theme]` matched every click because the theme lives on
  `<html data-theme>`, and since that branch returned it made every branch
  after it dead code — import, signup, the unit row and both dropzones
  silently stopped working. `tools/audit.mjs` reads the handler's selectors
  out of the source and fails if any reaches the root.
- **An attribute that routes clicks may not also be written as state.**
  `data-book` was added to route bookmaker pages while the slip review card
  already set `card.dataset.book`, so `closest()` swallowed every click
  inside a review card and Confirm silently stopped saving bets. The audit
  now fails on this.

### 6.5 Other standing rules

- **Never hand-edit `public/index.html`.** It is generated.
- **No emoji as an interface element.** They rasterise from the system font,
  cannot take `#86EFAC` or `#FCA5A5`, and differ per platform. Add a
  `<symbol>` to `src/icons.svg` and use `ico(id)`.
- **No em dashes in anything anyone reads.** The audit walks the rendered
  text of every view and fails on one. `settlement.js` and `csv.js` still
  *match* em dashes on the way in, because other people's slips contain
  them.
- **Tabular figures on every money value** or digits jitter and columns
  misalign.
- **Avoid Inter, Geist, Space Grotesk and Plus Jakarta** — they read as
  AI-generated.
- **Mobile first: 320 / 390 / 430px.**
- **There is no demo data in the app.** `src/js/data.js` starts empty and is
  filled by `hydrate()` from `GET /api/bets`. The marketing pages run on
  one labelled worked example in `content.js` and on `src/js/sample.js`;
  neither may ever reach the app.

### 6.6 Bot copy rules

Every word the bot says is in `api/_lib/bot-strings.js`. No copy inline in
handlers. Enforced by `tests/bot-strings.test.mjs`:

- **280 characters maximum**, with two documented exemptions (`welcome`,
  `help`) allowed 600. The test names them so a third cannot be added
  quietly.
- No emoji. No exclamation marks.
- Balanced markdown — an odd number of asterisks makes Telegram refuse the
  whole message with a 400 that surfaces as the bot going silent.
- Every refusal must say what to do next.
- Say what happened, then what to do next. Never claim something was saved
  unless it was.

---

## 7. The definition of done

Every one of these, every time:

- No horizontal overflow at 320, 390 and 430px
- axe-core reports 0 violations
- Contrast passes in every theme
- Settlement tests pass
- No console errors
- No duplicate IDs
- Keyboard operable
- Scroll stays smooth with the background motion running
- **You screenshotted at 390×844 and looked at it**

`npm run verify` covers all but the last, which is yours.

---

## 8. Flag, do not decide

These are the owner's alone:

- The Gambling Commission position on the leaderboard and on any public
  sharing of returns
- ICO registration — required before public launch, still outstanding
- The 18+ gate
- Terms and privacy, including slip image retention — both drafted, both
  need a solicitor before launch
- Responsible gambling: the red/green grid and rankings are engagement
  mechanics. **Nothing may nudge toward more volume.** "Take a break" is
  built
- A payment processor account in the business name
- Anything that changes what the product is

---

## 9. How to work

Fully autonomous. Commit and push each milestone; git history is the
rollback. Stop only for things only the owner can do: a credential, an
account, a payment, or a decision that changes what the product is.

Write commit messages that explain the reasoning, not the diff. The git log
in this repo is a design document and it is the fastest way to understand
why something is the way it is.

---

## 10. The rebuild, and what it changed

The owner asked for the front end to be rebuilt from the ground up. What
follows is what has landed so far. Everything below is deployed on `main`
and verified against production, not just locally.

### Bugs that were live and silent

- **The group directory had never worked, once.** `browse` composed its
  WHERE clause from nested `sql` fragments. postgres.js supports that; the
  Neon HTTP driver this project uses does not, and bound the fragment as a
  query parameter, so the statement was malformed and the function crashed
  before reaching the database. Every request, all three orderings.
  `tests/sql-composition.test.mjs` now walks every server file and fails on
  any interpolation that opens a tagged template of its own.
- **Join requests were unreachable.** `api/groups.js` selected `u.name`;
  the column is `display_name`. `GET /api/groups?requests=1` was a hard
  500, so no owner could see or approve anybody.
- **A LIKE search for `100%` matched every group on the platform.**
  Wildcards in user input are escaped now.
- **Five settings switches flipped and saved nothing.** Three stated locked
  behaviour and now say so; two named things that were untrue or unbuilt
  and are gone.
- **The dashboard told people they were behind pace** on a monthly profit
  target, in loss red. On a gambling tracker that is an instruction to bet
  more to catch up, and the brief forbids it. The pace marker and the
  language are gone and a shortfall is no longer red.

### Security

- `/api/extract` **required no account** and spent money at a model
  provider on every call, behind nothing but an IP bucket. It needs a
  session now, with the IP limit kept as a second layer.
- Cross-origin writes had `SameSite=Lax` and nothing else. Every
  state-changing route now also checks `Origin` against the host.
  `oauth-callback` is the single exemption, because Apple posts it from
  `appleid.apple.com`; a test reads that exemption out of the router and
  fails if it ever widens.

### New

- **Google and Apple sign in**, as `oauth-start` and `oauth-callback` on
  the existing auth router, so still 11 of 12 functions. PKCE, single-use
  state held in `oauth_states`, and full `id_token` verification against
  the provider JWKS with no JOSE dependency. **Inert until credentials
  exist**, and the buttons do not render without them. See section 10.1.
- **A six-step first-run tour**, with `onboarded_at` on `users`. It cannot
  use browser storage: iOS Safari gives this app none, so a client flag
  would replay it every visit. Skip is on every step and writes the same
  flag as finishing.
- **A three-layer token system** and five themes separated on hue,
  background lightness and chroma rather than hue alone. Periwinkle is the
  default and is now the default by definition rather than by override.
  Every theme is declared for `html[data-theme=X]` **and** `[data-t=X]`, so
  the picker can render a live preview of each one. `data-t` paints and
  never routes a click.
- **Liquid navigation**: one glass surface with an indicator that travels
  and stretches, still one `backdrop-filter`, p95 frame unchanged at 16.8ms.
- **`ULTRAS` creates and fills a group.** First redeemer owns it, everyone
  after joins outright. Never costs the plan if the group is full.
- **`{"scope":"seed"}` on `api/admin/reset.js`** creates a verified test
  account, because ordinary signup posts a code to an inbox nobody reads.

### 10.1 Turning federated sign in on

Both are owner-only and the flow stays inert until they exist.

**Google.** A Google Cloud OAuth 2.0 Client ID, type Web application, with
`https://slippery-iota.vercel.app/api/auth/oauth-callback` as an authorised
redirect URI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Apple.** Needs a paid Apple Developer account. Create a Services ID,
enable Sign in with Apple, add the same redirect URI, then create a Sign in
with Apple key and download the `.p8`. Set `APPLE_CLIENT_ID` (the Services
ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` (the whole
`.p8` contents; escaped `\n` is accepted).

Optionally set `PUBLIC_BASE_URL` if the deployment is ever served from a
host other than the one the redirect URI is registered against.

### 10.2 Still owed

Phases 2, 4 and 5 of the rebuild: the component layer, the flow screens and
the marketing pages have had the token and copy work but not the full
visual rebuild. Also outstanding: the compact import review with per
selection add and remove, and dated P/L extraction surfaced as a list.

### 10.3 Two things for the owner

- **Delete `Tester1@Tester.com` and `Tester2@Tester.com` before launch.**
  They are real accounts with known passwords on a public deployment,
  created deliberately for beta testing.
- **Rotate `ADMIN_SECRET`.** It was shared into a session transcript to
  authorise the database wipe, and it authorises destroying production.
- **The monthly profit target is still there.** Its chasing language is
  gone, but whether a profit goal belongs in a gambling tracker at all is a
  responsible-gambling question, and section 8 says those are the owner's
  alone. It has not been removed on anyone else's judgement.

---

# Section 11 — the correctness and design pass

Two stages, on the owner's sequencing: everything under the product had to
be right before anything visual changed.

## 11.1 Stage A, correctness

**The reader and the import pipeline.** Every iPhone photo upload failed
and blamed the server: the picker advertised HEIC, iOS therefore stopped
transcoding, `extract.js` relabelled the bytes `image/jpeg`, Anthropic
400'd, and the catch returned a 500 saying the reader was misconfigured.
Unknown mime types are refused by name now. `SLIP_SCHEMA` gained a `bets[]`
array so three forwarded slips stop becoming one bet selected "Arsenal &
Spurs & Chelsea". `runCsvImport` posts real bets to `createMany`, which had
never had a caller, instead of folding a 200 row file into 34 dated
aggregates and reporting that as success. Duplicate detection is server
side on four fields, and the FAQ describes what it does rather than what it
used to promise.

**Signup.** No `users` row exists until the address is proved. Signups wait
in `pending_signups`; `verify.js` promotes one into an account, stamps the
trial clock at that moment and redeems the promo then. An abandoned signup
used to hold the email and the display name for ever, burn the trial, and
consume a promo code that is UNIQUE per user. `resend.js` and `login.js`
both read the pending table, or the recovery paths would have gone dark.

**Periods.** `S.period` is All time, Yearly, Monthly, Weekly and each one
changes the query. There is a real `S.year`: every helper takes the year it
means, so a bet from last March is no longer counted in this March or
dropped by `buildDayTotals`. Weeks keep all seven days across a month
boundary. The Tracker/Lifetime toggle is gone; it moved one integer while
the figure beside it described a different set of bets.

**Two ledgers.** Bets logged here have a slip behind them; imported figures
are a date and an amount. Both count toward the period total, only one can
be checked, so the ledger has a History tab showing the addition. Imported
figures never reach the win rate, the streak, or the best and worst day,
and there are tests that fail if they do.

**One bookmaker registry**, `src/js/books.js`. It replaced five drifting
copies. Adding a Kambi brand is one row, and that is a test rather than a
claim.

## 11.2 Stage B, design

The demo **is** the dashboard: it loads a fabricated ledger through the
same `hydrate()` and renders through the same renderers. `demo.js` and the
`.d*` shadow design system are deleted. It is only offered to somebody with
no session, and `api.js` refuses every request while `S.demo` is true, so
sample data cannot reach an account. The audit drives it and fails if any
request leaves the browser.

The landing page has the Telegram block, the FAQs and the pricing back, all
built from the product's own components. The hero previews the calendar
rather than a cumulative curve, because the product has no cumulative
curve. Chalk is replaced by Slate and Bronze. Calculators, the roadmap and
two thirds of the changelog are gone. One segmented control replaced six,
and a ResizeObserver replaced the seven manual repaints.

## 11.3 Still owed

- The guided tour is six steps of text. It does not yet overlay the real
  pages, which is what the brief asks for. `demoPayload({full:true})` is
  there for it: two years of seeded history behind the demo's 120 days.
- The dashboard still has no by-odds, by-sport or by-competition
  breakdowns. The plan was to build them; the data is in every bet and
  `.barlist` already exists.
- Section 10.3 below is unchanged and still the owner's.

---

# Section 12 — onboarding, import and the phone

One pass over the part a person actually meets, sequenced so each stage
left the app green.

## 12.1 A bet builder is not an accumulator

`bet_type` was read for display and never stored; the bets table had no
legs column, so a multiple was saved as one row whose selection was its
legs joined by an ampersand. **That is why `settleMulti()` had never run
once in production** — it is written, tested, carries the locked
accumulator rules, and `api/_lib/settling.js` built the `settle()` argument
without legs.

`bets.bet_type` and `bets.legs jsonb` now exist and are written on both save
paths. The sweep matches a fixture per leg by the leg's own event. A bet
builder is refused before anything is parsed, per the locked rules. The
reader was never told the distinction existed: the prompt now names it, and
`bet_type` moved onto each bet rather than describing only the first on the
page. When it cannot tell, the card asks, and Confirm stays disabled.

`betProblem` moved to `src/js/betshape.js`, imported by both sides.

## 12.2 The import you can look at

Every parsed row is on screen with its date, selection, stake and price,
tickable and editable. Selection lives on the row object, never in the DOM.
Every edit re-runs the server's own validator. Duplicates are found against
the loaded ledger on the four fields the server keys on and pre-unticked.
Only ticked rows are posted.

A bet now says where it came from: `source` survives `fromApi`, an imported
row is tagged, and the Bets tab gains a provenance filter on accounts that
hold both kinds.

## 12.3 The bot, the promo codes, the tutorial

`src/js/botsetup.js` is one sheet with four states, opened from setup,
Settings and the tutorial. The code is `SLIP-XXXX`, which also repaired a
latent break: `linkCode()` seeded every account with a format
`looksLikeCode` rejected, with no expiry.

Promo entry moved to the email screen and travels with the signup.
`HBVALUE` joins `ULTRAS`. The admin grant needed `renews:false`, because
every other paid code is "free months then billing" and nobody handed a
free year has agreed to pay for a second one. **The admin code is in source
in a public repo, on the owner's instruction.** Rotating it is an edit and
a push.

`src/js/tour.js` walks the product: six steps that navigate, open what has
to be open, scroll the target into view and cut a hole in the scrim. The
hole is one box-shadow, it travels between steps, and it does not swallow
the tap it is asking for. Replayable from Settings.

## 12.4 The phone

The calendar sits under the figure it explains; running bets moved below
it; the four lifetime tiles moved inside Show more. The whole of a month is
now on the first screen with the headline. Two columns from 900px. Import
opens on a chooser: Add a bet, or Import history.

## 12.5 Still owed

- The reader's per-bet `bet_type` is only as good as the model's reading;
  there is no golden-set evaluation of it against real slips. Worth
  building before trusting the acca auto-settlement widely.
- The payment screen is still a labelled mockup. `billingState()` is ready
  for a processor; nothing calls one.
- Sections 10.3 and 11.3 are unchanged and still the owner's.
