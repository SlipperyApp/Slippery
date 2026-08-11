# Slippery — project brief

This is the founding brief for Slippery, saved verbatim as the source of truth.
Everything in `## LOCKED` may not change without asking the owner first.

---

## PRODUCT
Bet slip tracker. Forward a slip screenshot to a Telegram bot when you
PLACE it. Bot reads stake/odds/selection/bookmaker/result off the image,
tracks it live, settles it, shows real P/L on a calendar. Groups rank
friends in units not pounds.
Capture at placement, not settlement — that's what stops people logging
only their winners. Core idea, don't lose it.
Free 20 slips, then £3.49/mo or £29.99/yr. Friends first, App Store later.

## ENV
Repo   SlipperyApp/Slippery — PUBLIC
Live   https://slippery-iota.vercel.app  (stable, use for webhooks)
Bot    @SlipperyAppBot
Deploy Vercel, auto on push to main. No Vercel access needed.
Vars   ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN — already set in Vercel.
       process.env only. NEVER into a file/commit/log/message. Public repo,
       GitHub secret scanner auto-revokes.

## LOCKED, do not change without asking
  - Settlement rules below. Every one is a bug that would corrupt real P/L.
  - iOS constraints below. Each came from a real device failure.
  - #86EFAC profit / #FCA5A5 loss as semantic colours.
  - Capture-at-placement as the core product idea.
  - Single deployable output that Vercel serves. Multiple files fine, build
    step fine, but it must deploy on push with no manual step.
Everything else is open.

## MOTION AND BACKGROUNDS
The app should feel alive. Animated, drifting backgrounds behind content
across the whole site, not just the landing hero. Layered gradients, slow
parallax, subtle grain, ribbons that respond to scroll, colour that shifts
per theme.
Non-negotiable with it:
  - transform and opacity only. Never animate width/height/top/left.
  - Decorative layers inside overflow:hidden. Uncontained blobs previously
    caused 47px of horizontal scroll on mobile.
  - Honour prefers-reduced-motion.
  - Must not eat the backdrop-filter budget (see constraints).
  - Must not hurt scroll performance on a real iPhone. Profile it.

## SETTLEMENT — DO NOT SIMPLIFY.
Rule: A WRONG GRADE IS WORSE THAN NO GRADE. Uncertain → {status:'ask'}.
- 90 mins only. ET/pens never count. No 90-min score in feed → ask.
- Whole lines PUSH. Over 2.0 on 1-1 = void, not loss.
- Quarter lines SPLIT stake. Over 2.25 on 1-1 = half lost.
- Handicaps by bookmaker (lookup table, not hardcoded):
  bet365 = Asian, whole line pushes.
  All others = European, handicap draw is its own outcome, so -1 acts
  like -1.5 and that scoreline LOSES.
- Postponed/cancelled = void. Abandoned = ask (bookmakers differ).
- Always ask: player props, anytime scorer, cards, corners, bet builders,
  same-game multis, "rest of match", "next goal".
- Accas: all legs must grade or whole bet defers. Void legs drop, odds
  recalculate.
- Cash out is undetectable from a feed. Always a user action.
6 outcomes: won, lost, cash-profit, cash-loss, cash-flat, void.
Void = stake returned, £0 profit.

## CONSTRAINTS — learned the hard way
TESTING: jsdom has no layout engine (offsetWidth=0, CSS never applied). A
previous build passed every jsdom test while scrolling sideways on mobile
with 79 backdrop-filter elements causing scroll stutter. Render in a real
browser and LOOK at the screenshot.

iOS Safari is primary:
- No localStorage/sessionStorage.
- All inputs/selects/textareas >=16px or iOS zooms on focus and never back.
- 100svh not 100dvh (dvh recalcs on toolbar show/hide → sticky layouts
  visibly breathe).
- Max ~3 backdrop-filter elements or iPhone scroll stutters.
- No content-visibility — Safari 18 won't paint SVG text inside it.
- Ship -webkit- AND standard backdrop-filter + mask-image.
- viewport-fit=cover + env(safe-area-inset-bottom) on fixed bottom nav.

Design:
- #86EFAC profit, #FCA5A5 loss. Semantic, never theme-dependent. No theme
  accent may sit near either — that's why there's no green/red theme.
- Avoid Inter, Geist, Space Grotesk, Plus Jakarta — read as AI-generated.
- Tabular figures on every money value or digits jitter and columns misalign.
- Mobile first. 320/390/430px.

Hygiene: two real bugs from class collisions — a sparkline using .bar
inherited the sticky header's backdrop-filter + position:sticky (69px
overflow); a text line using .sel rendered as a dropdown. Check a class is
free before reusing.

Already tried, rejected: true light theme (profit green = 1.07:1 on beige,
invisible). True scroll jacking (CSS scroll-snap proximity instead;
mandatory traps users).

## DONE means all of:
no h-overflow at 320/390/430 · axe-core 0 violations · contrast passes in
every theme · settlement tests pass · no console errors · no duplicate IDs
· keyboard operable · scroll stays smooth with the background motion running
· you screenshotted at 390x844 and looked at it

## FLAG, DON'T DECIDE
Gambling Commission position on the leaderboard · ICO registration · 18+
gate · terms/privacy inc. slip image retention · responsible gambling:
red/green grid + rankings are engagement mechanics, nothing should nudge
toward more volume, "take a break" worth building.

## HOW TO WORK
Fully autonomous. Commit + push each milestone; git history is the rollback.
Stop only for things the owner alone can do: credential, account, payment,
or a decision that changes what the product is.

---

# Working notes for future sessions

## Repo layout
```
src/            source of truth — edit here, never edit the built output
  app.html      body markup
  icons.svg     the icon sprite, inlined once at the top of <body>
  styles/       CSS, one file per concern, native nesting
  js/           ES modules, assembled into one IIFE at build time
api/            Vercel serverless functions (Node runtime)
  bets.js       the ledger: list, log, bulk import, settle by hand, delete
  settle.js     the refresh button: look up this user's running bets now
  results.js    the cron sweep, same job for everyone every 20 minutes
  extract.js    slip image or PDF -> structured fields, refuses to guess
  telegram.js   the bot webhook
  sources.js    diagnostics: which scrapers and vars this deployment has
  _lib/         shared server code (db, auth, mail/smtp, rate limits, feeds)
    settling.js the one grader entry point — button, sign-in and cron share it
    espn.js sofascore.js footballdata.js   the scraper chain, tried in order
tests/          node:test — run with `npm test`
build.mjs       inlines src/ into public/index.html
public/         BUILD OUTPUT — generated, do not hand-edit
```

## Commands
```
npm run build     src/ → public/index.html   (Vercel runs this)
npm test          settlement + unit + integration tests
npm run verify    build, test, then real-browser audit (axe, overflow, screenshots)
node tools/icons.mjs   re-rasterise the PWA icons and og.png after art changes
node tools/preview.mjs one self-contained slippery-preview.html to open anywhere
```

## Rules for this codebase
1. Never hand-edit `public/index.html`. It is generated.
2. Settlement engine lives in `src/js/settlement.js` and is pure — no DOM,
   no globals, no side effects. It is the only module the server shares.
   Every change to it needs a test.
3. Class names are namespaced. `npm run build` fails on a duplicate class
   definition. This is deliberate: two production bugs came from collisions.
4. Money is always integer pence internally. Format only at the edge.
5. Secrets come from `process.env` and are never logged or echoed.
6. There is no demo data. `src/js/data.js` is a store that starts empty and
   is filled by `hydrate()` from GET /api/bets. The marketing pages run on
   one labelled worked example in `content.js` (SAMPLE) which must never
   reach the app. `tools/apistub.mjs` fakes the backend for the audit.
7. Settlement writes happen on the server only. The browser asks and
   re-reads; it never grades a bet itself, or there would be two graders.
8. No emoji as an interface element. They rasterise from the system font,
   so they cannot take #86EFAC or #FCA5A5 and they differ per platform.
   Add a `<symbol>` to `src/icons.svg` and use `ico(id)` from `data.js`.

## Decisions that reversed an earlier one
- **Scroll jacking is now in**, on the owner's explicit instruction, and it
  supersedes the "already tried, rejected" line in the brief. What was
  rejected was *mandatory* snap, which traps people. The landing sequence
  in `src/styles/09-jack.css` is jacked without trapping: a real 300svh
  track, a `position:sticky` stage rather than fixed, proximity snap, no
  intercepted wheel or touch events, and a full collapse under
  prefers-reduced-motion. `tools/audit.mjs` asserts all of that. If you
  change it, keep those five properties — they are the entire difference
  between this and the version that was rejected.
- **A live `filter: blur()` is banned in the background layer.** It is
  re-evaluated every scroll frame regardless of whether anything animates:
  measured 49.9ms p95 with it, 16.8ms without. Bake the gaussian into the
  SVG with `feGaussianBlur` and use it as a `background-image` instead.

- **A delegated selector must not be able to match `<html>` or `<body>`.**
  `[data-theme]` matched every click, because the theme lives on
  `<html data-theme>`, and since that branch returns it made every branch
  after it dead code — import, signup, the unit row and both dropzones all
  silently stopped working. `tools/audit.mjs` now reads the handler's
  selectors out of the source and fails if any reaches the root.
- **Results come from SofaScore by default**, because it publishes period
  scores and so can prove the 90-minute score on a knockout tie.
  football-data.org is the automatic fallback for SofaScore's 403s, which
  is what a datacenter IP gets. Neither is a paid feed; if settlement
  becomes load-bearing, buy one.
- **Vercel's file tracer only follows literal import specifiers.**
  `await import(someVariable)` compiles fine and then fails in production
  with `Cannot find module '/var/task/...'`, because the file was never
  bundled. Import server modules statically and hold them in a table.
- **Results are scraped, never an API.** `api/_lib/fixtures.js` tries ESPN,
  then SofaScore, then football-data.org. All three block by IP reputation
  and every host answers differently, so `GET /api/sources` reports what
  the running deployment can actually reach. Check it before believing a
  local probe.
