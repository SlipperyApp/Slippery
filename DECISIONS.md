# Decisions

Every judgement call, one line each, newest section last. This is the morning
reading.

## Recovering the rulebook

- Recovered `CLAUDE.md`, `SPEC.md` and `README.md` from `dee44bd^` and restored
  them edited, so the next session does not dig them out of history again.
- Removed every instruction in SPEC.md that deferred to `slippery-prototype.html`
  and marked the three superseded rulings in place with the reason, rather than
  deleting them silently: a reader needs to know the old rule existed.

## Stack

- **Next.js 15.5 App Router, TypeScript, React 19.** 15.5 rather than 16 for
  the same reason a bookmaker settles at 90 minutes: the known quantity is
  worth more than the newer one on a build that has to go green unattended.
- **No ORM.** `pg` with checked in SQL migrations applied forward only. One
  dependency, no codegen step, and the schema is diffable.
- **Stripe, Telegram and the vision model are called over `fetch`**, not
  through SDKs. Three fewer packages that can drift, and nothing to bundle.
- **Fonts are self hosted woff2**, not `next/font/google`. A build that fetches
  fonts is a build that can fail on a network hiccup, and this one has to go
  green while the owner is asleep.

## Type

- **Archivo** for the interface, 400 body, 600 labels and titles, 800 figures.
  Not Inter, Geist, Space Grotesk or Plus Jakarta, all of which read as AI
  generated. Archivo is a grotesque with real figures and it holds at 800.
- **IBM Plex Mono** for codes, prices and anything that has to align in a
  column. Verified for tabular figures in the audit rather than assumed.
- One weight per role, and no 650: no static face provides it.

## Colour

- Eight dark themes, no light mode, because profit green measures 1.07 to 1 on
  beige.
- `#86EFAC` and `#FCA5A5` are declared **once**, outside every theme block, and
  a test asserts no theme block redefines them.
- A test asserts every theme accent is at least 40 degrees of hue from profit
  green and 35 from loss red, or is under 25% saturation and therefore cannot
  be confused with either. That is the rule "no theme accent may sit near
  either" made mechanical.
- **Cinnabar keeps its name through its ground, not its accent.** Cinnabar the
  pigment is a red, and a red accent is exactly what the rule forbids, so the
  ground carries the oxide and the accent is a pale porcelain gold. Bronze is
  the saturated gold; cinnabar is the pale one, on a warm ground.
- **Carbon is the default**, not periwinkle. It is the quietest of the eight,
  and a default should not be the loudest thing a new Slipper sees.

## Motion

- The gaussian for the background blobs is **baked into an SVG mask**, so the
  themed colour still flows through `background-color` while no live
  `filter: blur()` runs in the background layer.
- The headline glow is a **real `aria-hidden` span**, not a `::before` with
  `content: attr()`. The brief asked for `aria-hidden="true"` on it, and a
  pseudo element cannot carry an attribute. It is `user-select: none`, so
  selection and copy still return one copy of the word.
- The sheen is clipped by an `overflow: hidden` wrapper and fades out at the
  end, so it cannot leave a bar parked beside the word after it has run.

## Data model

- **Each way is two linked rows, not one row with a flag.** The brief calls it
  "two linked parts settling independently", and modelling it that way means
  the fold needs no special case at all: the place row simply carries the place
  price.
- **Every event contributes exactly two numbers**, a stake portion and a signed
  return, and the fold is one line. That is what lets a Rule 4, exchange
  commission, a promo refund and a repeated partial cash out share one
  mechanism.
- **`settleMulti` is the only settlement path, and a single is a one leg
  multiple.** Its predecessor was written, unit tested and never called. There
  is now no second code path to forget to call.
- **The example account is generated through `recompute()`**, the same function
  production uses, so the demo cannot drift from the product. It is seeded per
  calendar day, so it is stable within a session and alive across days.

## Counting

- `select()` produces one array and everything else counts that same array. A
  test asserts the facet total equals the row total for every period, which is
  the defect that had a banner saying 486, a ledger 482 and facets 474.

## Product

- **Signed out visitors see the example account at `/app`**, labelled in a
  dismissible banner and with `@tester123` in the top bar. The alternative was
  a wall of sign in redirects, which would have made every product route
  unviewable and unverifiable.

## Two ways to make a deployment vanish without a build log

Both have the same shape: a config file that is valid JSON, passes every local
check, and makes the whole deployment disappear with nothing to read.

- **`vercel.json` must stay schema clean.** Vercel rejects any top level key
  outside its schema and fails the deployment in about fifteen seconds, before
  a build starts, pointing at the project configuration docs rather than
  naming the key. A `$comment` key is enough to do it. `$schema` is the only
  non setting key it allows.
- **A Hobby account is limited to one cron run per day per expression.**
  `*/20 * * * *` is rejected at deployment *creation* time with
  `cron_jobs_limits_reached`. The failure is silent from the git side: **no
  deployment is created at all**, nothing appears in the dashboard, and there
  is no build log, so a green local build and a successful `git push` both
  look completely normal. Two pushes to `main` produced zero deployments
  before the owner read the reason out of the Vercel API.

  The results sweep is therefore **`0 6 * * *`**, once daily, which is what
  the previous build used and is known good. Retention stays at `17 3 * * *`,
  already daily. Anything that needs settling sooner than the next morning
  goes through the on demand refresh path rather than a second cron: a daily
  sweep plus a refresh a Slipper can trigger catches up on everything a
  twenty minute sweep would have caught, a few hours later.

  **How to tell this apart from a failed build:** a failed build appears in
  `list_deployments` with `state: ERROR` and has logs. This appears as
  nothing at all. If a push to `main` produces no new deployment within a
  couple of minutes, suspect `vercel.json` before suspecting the webhook.

## /404 and /500

`app/404/page.tsx` and `app/500/page.tsx` cannot exist: Next reserves both at
export time and the build dies renaming `500.html`. Both pages therefore live
under `/error-pages/` and are reachable at 200 there.

Both are aliased back to their public paths by `middleware.ts`, as 308
redirects rather than rewrites: Next answers a bare `/404` with its own 404
status whatever a *rewrite* serves, at both the config and the middleware
layer. As redirects they land on the real page at 200.

A genuinely missing route still gets a real 404 from `app/not-found.tsx`,
which renders the same pane. That is the difference between looking at the
404 page and hitting one.

**A note on how that looked while it was broken:** for a while `/404` kept
answering 404 with the right content and no explanation. The cause was not
the routing at all: a Next server left running from an earlier launch was
still serving a stale build, so it had no idea the middleware existed. See
the next entry.

## A stale server looks exactly like a hydration bug

Every chart on the dashboard rendered blank, and the console showed 400s on
`/_next/static/chunks/*.js`. Nothing was wrong with the charts: a Next server
from an earlier launch still held port 3100, the new one failed to bind, and
the old one kept serving HTML that referenced chunk hashes no longer on disk.

`pkill -f "next start"` is not the fix, and it is actively dangerous here: the
calling shell's own command line contains the pattern, so the pattern kill
takes the shell with it and the command exits 144 with nothing done.
`tools/serve.mjs` reads `/proc/*/cmdline` and kills only processes whose
command line BEGINS with the server, then waits for the port to answer before
returning. If a rendered page ever looks unhydrated again, check the chunk
hashes in the HTML against `.next/static/chunks` before suspecting the code.

## The calendar ramp

The obvious fill cannot work and it is worth writing down why, because the
build before this one hit the same wall and solved it in a way that cost the
module its point.

Laying the semantic colour over the cell at an opacity that tracks the size of
the day sweeps the cell through mid luminance. Across all eight themes,
`--ink` fails 4.5:1 above alpha 0.24, `--bg` does not reach 4.5:1 until 0.60,
and nothing is readable between the two. The previous build jumped that dead
band with two fixed tiers, and said so in its own commit message: 112 and 148
landed in different tiers and read as different worlds.

So the ramp varies **chroma**, not lightness. The semantic colour is mixed 45%
into `--bg` first, which gives a dark saturated anchor, and that is what fades
in. Lightness barely moves, so one text colour is readable at every step of a
continuous ramp.

Measured, all eight themes, every step: worst `--ink` on a filled cell is
4.80:1 in graphite at full strength; the weakest full fill against an empty
cell is 2.20:1, so it is plainly a fill; `--ink-2` on a filled cell is 2.25:1,
which is why text up there is `--ink` and never `--ink-2`. 45% is the most
colour that still fits under 4.5:1 at the top, so it is not a number to raise.

`tests/calendar-ramp.test.ts` walks every step in every theme, and its third
assertion is a guard rather than a check: it asserts that the NAIVE ramp still
fails. If that ever starts passing, the palette changed and the decision can
be revisited deliberately instead of by accident.

Four other things the module needs and one of them is not obvious:

- The figure is **signed**, not left to the colour. At the bottom of the ramp
  the tint is deliberately faint, and a faint red and a faint green are
  precisely the two things a red-green colour blind reader cannot separate.
- A past day with no bets has its date **struck through**. A day that has not
  happened is **recessed and never struck through**: "you did not bet" and "it
  has not happened yet" are different facts, and a line through tomorrow is a
  lie. The strikethrough is never the only signal, because every cell carries
  a full sentence for a screen reader.
- Six rows always, 42 cells, height driven. Sizing cells from their width put
  a six week month past the bottom of the card where `overflow: hidden` ate it
  silently, and a grid that changes height between months moves every module
  in its row with it.
- The peak of the ramp is the month's own biggest day, so a quiet month uses
  the full range instead of being washed out by a loud one three months ago.

## Gate 4

The sweep runs in real Chromium, never jsdom, because jsdom has no layout
engine and a previous build passed every jsdom test while scrolling sideways
on a phone.

**Result: clean.** 55 routes at 320, 390, 430, 1024 and 1440; all eight themes
on seven routes; 178 buttons clicked twice with none dead; 111 controls
reached by Tab across four routes with a visible focus ring on every one;
axe-core clean at 390 on every route and at 1440 on every public one; no
duplicate ids; `body.scrollWidth <= clientWidth` at every mobile width; every
view over 40 characters; tabular figures verified by measuring "111111"
against "000000" in the live font rather than assuming the face ships them.

It took four passes to get there, and most of what the first pass reported was
the harness being wrong about the product rather than the product being wrong.
The five rules that fixed that are written at the top of `tools/audit.mjs`,
and the one that mattered most: a control clicked TWICE ends where it started
if it is radio-like, so comparing only the second click called every segmented
control in the product dead.

**Live verification is `tools/check.mjs`, not the browser sweep.** Driving
Chromium over the network from this container is not reliable enough to tell a
dropped connection from a defect: a live run reported 89 navigation failures on
routes that plain `fetch` answered at 200 four times in a row. So the browser
sweep is the local gate against a given commit, and the live check proves the
deployed build IS that commit (via the sha in `/api/sources`) and that every
route answers 200 with a real title, exactly one h1, real content and the
compliance footer.

## The two result colours mean money, or they mean nothing

Nine places had drifted into using #86EFAC for "read cleanly", "stage done",
"badge earned", "check passed" and "unchanged", and #FCA5A5 for "not on the
slip" and "field missing". None of them is wrong on its own. Together they put
seven meanings on two colours, on screens that are about to write money into a
ledger.

Confidence now takes `.readmark--ok`, `--ask` and `--gap`, which are the
accent and two inks. `tests/contrast.test.ts` fails on any `.pos` or `.neg`
class that is not deciding on an outcome, a money figure, the sign of a number,
the calendar ramp, or one of the two places the brief explicitly specifies a
result colour: the "Save £11.89 a year" pill and the destructive block.

## The fourth way a colour reaches a screen, and it was the stylesheet

The section above holds for `className`, and a later pass closed the same hole
for `style={{}}`. Both read `.tsx` files, so neither could see a colour applied
by a rule, and three had settled there and stayed:

- `.factlist svg` painted a tick in profit green for "this sentence is true",
  which is the "read cleanly" meaning taken out of nine other places.
- `.field__err` painted every form error in the loss colour, on nine forms
  including login and signup. That is "field missing", by another name.
- `.banner--neg` painted six banners in it: the slip reader is down, this
  browser cannot open a HEIC, the slip is in the wrong currency, the bet is
  already in your ledger, and new slips are paused. Five faults and a state.

The tick takes the accent, which is what the same mark on the marketing pages
has always used, and the other two take `--warn`, which is the token for
attention and what a cash out already draws in. A third test reads the
stylesheets the way the other two read the components: a rule naming #86EFAC
or #FCA5A5 has to be a bar, a meter, the calendar ramp, an outcome pill, a
swatch that explains the colours, or the destructive block.

A fourth was in a component and the test's own allowance let it through. The
import's dry run painted "Cannot split reliably: 14" in the loss colour
through `DRY_RUN[r.k] > 0 ? 'neg'`, and the rule that excuses "the sign of a
number picks the colour" read that as a sign test. A count above zero is not a
loss. The allowance is written out per direction now: above zero is never the
loss colour and below zero is never the profit one.

## What the polish pass did not get to

Written down for whoever picks this up, in the order I would take them.

- **Four import screens are a phone layout on a monitor.** `/app/import/
  history/dry-run`, `/done`, `/resolve` and `/review` are an 860 pixel column
  down the left of a 1288 pixel content area with nothing beside them. The
  upload screen was given a second column and is one screen now; the other
  four want the same treatment, and each needs a different second column,
  which is why they are still like this. `/changelog`, `/terms` and
  `/privacy` have the same shape and a better excuse: they are prose, and
  prose has a measure.

- **The dashboard's breakdown clips its third row at 1024 and 1440.** The
  module is sized from the window, which is what makes the dashboard one
  screen at any height, and the row that does not fit is cut in half rather
  than left out. It is the one place on the dashboard that reads as an
  accident rather than a decision. Either the list takes whole rows only, or
  the cut edge needs to say it is a cut edge.

- **The demo page's tiles lose their sparklines by one pixel.** `.tile` drops
  the line under 236px of content box, which is measured and right; the
  marketing wrap gives each tile 235. The tiles are otherwise the dashboard's
  own, module for module.

- **`/app/history` is 120 rows and 8,000 pixels.** The ledger loads fifty and
  offers a button. Nothing is wrong with the page, but it is the longest
  scroll in the product.

## The migration that ran, failed, and looked fine

`0001_init.sql` uses `create table if not exists`, which is correct for a file
that may be re-run. Against a database that already held the previous build's
tables, with the same NAMES and different SHAPES, "if not exists" quietly kept
the old ones, and the first `create index ... (email, ...)` then failed with
`column "email" does not exist`. The whole file rolled back.

Nothing looked wrong. The build was green, because the runner is deliberately
not fatal: a deployment that cannot reach its database should still deploy and
say so rather than leaving nothing at all. Every route answered 200, because
the read path renders from the example account. The only thing that knew was
`GET /api/sources`, reporting `schema.applied: []`, and it took three
deployments before anybody read it.

Two fixes. `0000_drop_legacy.sql` drops the previous build's tables by name,
which the brief explicitly permits, and it names only the tables this schema
owns: dropping one nobody asked about is not a migration, it is a guess. And
the runner's summary line said "1 already present" for a file that had just
failed, which is the opposite of what happened; it now counts applied, already
present, failed and not reached separately.

**The lesson worth keeping:** a build that goes green is not a deployment that
works, and the honest-degradation design that keeps the site up is exactly
what hides a failure like this. `/api/sources` exists for that, and it is only
useful if somebody looks at it after every deploy that touches the schema.

## What is not finished, and what I would do next

Written last, and honestly. Everything in the route map is live and every
control on it works, but "works" is not the same as "has been through a real
account", and several things below are the difference.

### Flagged, because they are yours and not mine

- **The 50 to 100 reference slips for the reader's golden set.** The table is
  there (`reference_slips`) and the reader is written to be measured against
  it. Nothing can be claimed about its accuracy until real slips exist, and no
  accuracy figure appears anywhere in the product for exactly that reason.
- **A real Telegram message, end to end.** That needs the bot token, which I
  must never hold. Everything up to the wire is built and tested: the secret
  is verified in constant time, `update_id` is deduped, `answerCallbackQuery`
  runs in a `finally`. What has never happened is a real slip arriving from a
  real phone. `POST /api/admin/webhook` repoints the webhook when you want to.
- **Anything needing a payment card.** Checkout, the portal and the webhook are
  written and the signature verification is tested against a forged signature
  and a replay, but no card has been declined twice on this deployment, so the
  two-attempt path has not been walked.
- **Credential rotation**, if any of the values in Vercel have ever been
  exposed.
- **The Gambling Commission position on the leaderboard**, **ICO registration**,
  and **the final wording of Terms and Privacy**. Both legal pages carry a
  banner at the top saying they are the working text, rather than presenting
  themselves as settled.

### Real gaps I would close first

1. **The app renders from the example account, not from Postgres.** The schema
   is applied (see the entry above for the two deploys where it was not), `appendEvent` and the fold write through it, and every write
   route refuses honestly without a session. But the read path on every page
   still goes to `lib/data/demo.ts`. The next commit is a repository behind
   `getViewer()` that returns the signed-in account's rows when there is a
   session and the example account when there is not, with the same shape
   either way. Everything above it is already written against that shape.
2. **`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` and `STRIPE_WEBHOOK_SECRET`
   are not set on the deployment.** `/api/sources` says so. Until they are,
   the plan step says payments are not set up rather than spinning.
3. **`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_API_KEY` and
   `EMAIL_FROM` are not set either.** Google sign in says it is not set up;
   verification codes are generated, hashed, stored and not sent. Nobody can
   complete a signup on production until the email variables exist.
4. **The reader has never read a real slip.** The prompt is written to report
   what it can see and to return null rather than infer, and the review screen
   is built around per-field confidence, but the whole path from image to
   fields is untested against an actual bookmaker screenshot.
5. ~~**Duplicate detection has no UI.**~~ Closed, and the check underneath it
   was wrong as well. See "The profit and loss was wrong in three places"
   below: the match is on the parsed bet rather than on the image file, and
   both the analysing screen and the review screen now ask rather than
   deciding.
6. **The slip image is a state, not a file.** The bet sheet says honestly
   whether an image exists, was typed in, or was deleted after 90 days, and the
   retention sweep does the deleting. What is missing is the storage: images
   are read and discarded rather than kept, so the 90 day clock has nothing to
   run down yet.

### Things I would change if I were carrying on

- **The dashboard defaults to This month, which is nearly empty on the 1st.**
  That is honest, and it is also a poor first thing to see twelve times a year.
  I would not add a rolling window without asking, because the period list is a
  ruling in SPEC.md, but it is worth a decision.
- **The example account regenerates daily from a seed.** That keeps it alive
  and deterministic within a day, and it means the figures move overnight. If
  the demo is ever used in a screenshot, freeze the seed.
- **`/404` is the one route in the map that answers 404 rather than 200**, and
  the reason is written above. It serves the real designed page.

## The profit and loss was wrong in three places

This product is a profit and loss tracker first and everything else second,
and three separate defects each put a wrong number on the screen.

### Commission is charged, and it rounds up

- **The fold has understood a `commission` event since the first migration and
  nothing ever appended one.** `bets.commission_pct` was on the table, the
  bookmakers carried their rates, and neither `/api/settle` nor the cron sweep
  contained the word. Every winner on Betfair Exchange, Smarkets, BETDAQ or
  Matchbook was reported 1.5 to 2 per cent above what the exchange paid, and
  it compounded through return, units, the calendar and every breakdown,
  because they all read the same realised figure. The example account builds
  its own events and DID charge commission, which is why the screenshots
  looked right while real ledgers did not.
- **`appendResult()` in `lib/server/bets.ts` is the one place that decides.**
  Both settlement paths go through it. It appends the graded result, asks
  `commissionDue()` whether a charge is owed, and appends a second event if it
  is. A second event rather than a smaller first one: the ledger is append
  only, and somebody looking at a bet that returned £150 and paid £98 is owed
  the line that says where the other £2 went.
- **The base is net winnings, never turnover.** £50 at 3.00 returns £150, of
  which £100 is winnings, and 2% of that is £2.00. Not 2% of the £150 back and
  not 2% of the £50 staked. A losing bet owes nothing, which is why nothing is
  appended for one: a zero row in somebody's settlement history is a line they
  have to ask about.
- **A part penny rounds UP, away from the person.** £5.10 at 3.00 on Matchbook
  wins £10.20 and 1.5% of that is 15.3 pence, so the charge is 16 pence.
  Betfair rounds its own charges up, and it is the only direction that cannot
  overstate profit: rounding a charge down reports money the exchange never
  paid out, which is the same defect as never charging it, one penny smaller.
  The rate is taken in thousandths, which is the precision the column stores,
  so a rate with no exact binary form cannot push an exact charge a penny high
  through the multiply. `tests/fold.test.ts` pins all of it.
- **`POST /api/bets` had a literal `0` in the insert for `commission_pct`**, so
  even once settlement learned to charge, every bet had nothing to charge. It
  reads the account's own rate for that bookmaker and freezes it on the bet,
  like the unit beside it, so changing a rate later never rewrites history.

### A place is a place, and it counts as neither a win nor a loss

- **`placed` is the seventh outcome.** There were six and none of them was
  this one, so the fold collapsed a place to `realised >= 0 ? 'won' : 'lost'`.
  A £10 each way at 4.00 on a fifth the odds, third of twelve, is a win part
  that loses £10 and a place part that wins £6: the bet is £4 down, and the
  ledger said Lost on one row and Won on the other. Both are true about the
  cash and neither is the race.
- **THE RULING: a place is neither a win nor a loss.** It is out of the win
  rate on both sides, exactly like a void, and it has its own count, its own
  facet and its own pill. Two reasons, and the second decided it. A place is
  not a claim about winning, so calling it one puts a horse that came third in
  the same column as one that came first. And an each way bet is TWO rows
  here: count the place as a win and one bet lands in both columns at once, so
  one horse, third of twelve, would read as a 50% win rate off a single bet.
  Out of both, the pair reads 0 wins and 1 loss, which is the true statement
  that the selection did not win, and the money is reported by net, return and
  units, which is where money belongs.
- **The pill takes neither colour.** A place can land either side of zero
  depending on the terms, and the figure on the right of the row already
  carries the profit green or the loss red. A green pill on a place that cost
  £4 is a row arguing with itself.
- **`places_paid` sits beside `ew_place_fraction`.** Both halves or neither:
  a fifth the odds means nothing without knowing how many places were paid,
  and a place count means nothing without knowing what a place was worth.
  `ewTerms()` prints the pair the way a slip prints it, and whichever half was
  not read is left out rather than guessed at.

### A duplicate is the same BET, not the same file

- **`slip_images.sha256` was the only check.** Two screenshots of one slip are
  two different files: crop a pixel, share it through a chat that recompresses
  it, or take the shot twice, and both saved. The bet was then in the ledger
  twice and every aggregate counted it twice, with nothing on any screen
  saying so.
- **The fingerprint is over the parsed bet**: bookmaker, selection, stake,
  price, event and event time, normalised for casing, punctuation and seconds,
  and versioned so a change of recipe cannot silently pair up bets taken under
  the old one. `identityOf()` builds it, and both `/api/extract` and
  `/api/bets` use that one recipe, because a fingerprint taken one way at
  upload and another way at save would never match itself.
- **The window is 24 hours.** Two shots of one slip arrive within hours; the
  same fingerprint a week later is a different occasion. The query is handed
  the cutoff `duplicateCutoff()` returns, so the boundary the test pins at 23
  and 25 hours is the boundary the database applies.
- **It ASKS, both times.** The image hash stays in front as a fast path,
  because an identical file can be caught before the reader is called and that
  saves a slip off somebody's allowance, but it now offers "read it anyway"
  instead of ending the journey. The fingerprint match rides back attached to
  the read, and Confirm on the review screen stays off until the person says
  whether it is the same bet. Silently skipping loses a real second bet and
  silently saving is the defect being replaced.
- **The index is not unique, deliberately.** Two genuinely separate bets on one
  fixture at one price DO collide, and a unique index would refuse the second
  one instead of asking about it.

## The social side, and the one rule the feed has

Three things were asked for after a look at a competitor: a leaderboard, a
groups system that works end to end, and a feed of what people are tracking.
The last of those is the one with a rule in it, so it is first here.

### Only bets captured before kick off, and never a result

- **The gate is two clauses and both are absolute.** An item is a bet whose
  capture timestamp is before its event's start, whose event has not started,
  from somebody who turned this on. A bet posted after the off is not a
  prediction, it is a claim, and this product exists because a record written
  afterwards is a record of the bets somebody felt like writing down.
- **The TYPE carries no outcome and no money**, which is the enforcement.
  `TrackedBet` has no field a result could go in and no field a stake in
  pounds could go in, so no screen reading it can print either, and a future
  session cannot add one to a component without adding it to the type first.
  A test asserts the exact key list.
- **It ages out and is never revisited.** When the event starts the item
  goes. There is no list anywhere of things that have started, which is what
  makes a result impossible rather than merely absent.
- **No tail button, no copy this bet, nothing counting who looked at what.**
  A control that turns somebody else's bet into your bet is a tip with an
  extra step. A test fails if the words appear on the page.
- **Opt in, off by default**, and the default is one constant,
  `TRACKING_DEFAULT_ON` in `lib/data/settings.ts`, that both the settings pane
  and the feed read. A default of true would have disclosed every account's
  open bets on the day it shipped, which cannot be taken back.
- **Capped at twelve.** A list that never ends is an engagement mechanic.
- **Two tabs rather than two sections**, and the reason is in a comment on the
  page: only one of the two lists expires, and the boundary between them is
  what carries the rule. Stacked as sections, somebody scrolling past the
  first reads the second as a continuation of it.
- **The example data deliberately contains what the gate has to refuse**: one
  bet per opted-in Slipper captured a quarter of an hour after the off. A gate
  with nothing to refuse in the data is a gate nobody can see working, and the
  test asserts those candidates exist before asserting they are absent.

### One list of bets per Slipper, counted many ways

- The old `Slipper` carried `unitsMonth` and `unitsAllTime` drawn straight
  from a seed. A leaderboard row needs a return, a win and loss record and a
  count beside those units, and drawing each of them from its own seed
  produces a row saying plus eighteen units beside a return that could not
  have produced it. Each Slipper now has one generated list of bets and
  `recordOver()` folds it; every figure on every row is one pass over one
  array. That is rule 5 of the codebase applied to a table.
- **The viewer's own row is folded by `select()` and `summarise()`**, the
  product's one query and one count, so the leaderboard cannot disagree with
  the dashboard that produced it.
- **`seeded()` is linear in its salt** and that mattered. Two salts a fixed
  distance apart give values a fixed distance apart, so the price of a bet and
  the roll that settled it were the same number plus a constant: every Slipper
  won nearly everything or lost nearly everything, and the table read plus
  forty nine per cent against minus fifty six. The salt now goes through one
  round of an integer hash first.

### All time is the default, and This month is a tab

- A monthly table on the second of a month is a table of two days. Eleven of
  twelve rows read no bets and 0.0u and the twelfth read plus four hundred and
  ninety two per cent off one winner. It is all true and it looks broken
  twelve times a year for reasons that have nothing to do with the reader.
  The month is one tap away and a group still ranks over whatever period the
  group chose, so nothing is hidden.
- **A return over fewer than five bets is left out.** It is not a return, it
  is the price of one of those bets. The row is marked down the left edge,
  which is the treatment the breakdown already uses for the same reason, and
  the note explaining the mark lives inside the table component so it cannot
  drift away from the rows it explains.
- **Ties break on bets, then on handle.** Everybody with nothing in the window
  sits on exactly 0.0u, and ranking them above a Slipper who is a unit down
  for having played would be a table that rewards not turning up.

### The podium

- Three plinths, a numeral in the medal colour and the bet count under it. No
  cup, no laurel, no emoji: an emoji rasterises out of the system font, so it
  cannot take the profit or the loss colour, and a leaderboard drawn with them
  would print a losing figure in a colour that says nothing at all.
- DOM order is rank order and CSS `order` puts second, first, third on the
  screen, so anything reading the list in sequence reads it correctly.
- **The pinned row appears only when the podium is not already carrying you.**
  Shown either way, a viewer in the top three was on the page three times.
  `pinnedRow()` is the rule and a test pins it.

### Groups

- Every route works: the group page, joining by code, leaving, and a group
  that does not exist. A missing id used to fall through to the first group in
  the list, so a stale link showed somebody a different group's table under
  the name they clicked.
- **The three join modes are three different answers** and every surface says
  which before anything is pressed. "Joined" and "Asked to join" are not the
  same event, and printing the first when the second happened puts somebody in
  a table they are not in.
- **A slip backed group says what it left out, with the number.** Quietly
  counting fewer bets than the profile behind each row is how a member ends up
  asking why the table disagrees with their own ledger.
- **Leaving takes nothing with it**, and the screen says so: units are folded
  from your own ledger, so they were never the group's to keep. An admin
  cannot leave and take the group with them; handing it over comes first.
- **`POST /api/social/groups` did not exist.** `CreateGroup` has been posting
  to it since it was written and getting a 404, falling back to its own local
  code. That fallback is right for a signed out visitor and was covering a
  missing route for everybody else. It exists now, with `PATCH` for the two
  things an admin may change, and `/api/social/membership` for join and leave.
- **The create screen issued codes from its own alphabet**, which contained an
  L that `isInviteCode()` rejects. A code that screen handed somebody would
  have been refused by the join screen it was made for. One alphabet now, and
  a test asserts the two literals stay the same string.
- **Matching a code happens on the server.** The obvious version hands the
  browser every group and its code, which is a directory of every group's key.
  The form is a plain GET, so the only code the browser holds is the one
  somebody typed.

### Responsible gambling

- `divisionMove()` states the move and stops: "Moving to League One next
  month", never a word for going down, and nothing at all about what to do
  next. Under four Slippers nothing moves and it says so rather than promoting
  the only member of a group of one.
- The sharing switches in settings were hardcoded to render pressed whatever
  the account said. That is a picture of a control, not a control, and one of
  them now discloses an open bet to strangers.

### Still open

- **The example account is up 55.9% over 385 bets**, which no plausible
  Slipper matches, so the viewer tops every all time table by a factor of two.
  That is the demo ledger's shape rather than the leaderboard's, and changing
  it would move every screenshot and several tests, so it is left alone and
  written down here.

## Two regulatory questions, and neither of them is mine to answer

`CLAUDE.md` has a FLAG, DO NOT DECIDE list, and the Gambling Commission
position on the leaderboard is on it. It is recorded there as five words. This
section states both questions in the form somebody can take to a solicitor:
what is actually being asked, what would settle it, and what the product does
in the meantime. Neither is answered here, and the flag stays where it is.

### The leaderboard, and whether the Gambling Commission has a view on it

**The question.** Slippery ranks real people by their real betting returns,
in monthly divisions, and publishes the table to everybody in the group. It
accepts no stakes, holds no money, pays no winnings and gives no tips, so it
is not a facility for gambling under section 33 of the Gambling Act 2005 and
no licence is being applied for. The question is the next one along: whether a
ranked table of betting performance, published by an unlicensed third party,
is something the Commission expects to be designed a particular way, and
whether the advertising codes treat a league position as an inducement to
gamble. A related question sits underneath it: whether the mitigations in the
design, ranking in units rather than pounds and moving divisions quietly,
count as mitigations to a regulator or only to us.

**What would settle it.** Written advice from a gambling law solicitor on a
description of the mechanic as built, obtained before any launch that includes
the leagues, covering the three points above. The Commission's own view, if
its advice line will give one on a product it does not license, is worth
having beside that advice rather than instead of it.

**What the product does in the meantime.** The leagues are live and the
mechanics are the ones the brief specifies. Ranking is in units so a larger
balance is not a higher score, and stakes are never visible outside a group. A
division change reads "Moving to League One next month" and never uses a word
for going down. No notification is sent about not having bet, none is framed
around a league position, and none is sent late at night. What other Slippers
are tracking is opt in and off by default, shows only bets captured before
kick off, never shows a result, and carries no control that turns one of their
bets into one of yours. Age is confirmed at 18 and stored with the time it was
confirmed, the take a break control pauses notifications and the leagues
without touching a ledger, and BeGambleAware and the National Gambling
Helpline are in the footer of every public page.

### The trial that converts with no reminder, under the DMCC Act 2024

**The question.** `SPEC.md` specifies, and the plan step repeats on screen,
that the plan starts automatically when the trial ends and that there is no
trial end reminder, deliberately, because a reminder is a nudge. The
subscription contract regime in the Digital Markets, Competition and Consumers
Act 2024 is built the other way round: pre contract information, reminder
notices before a renewal or before a free trial converts, and cooling off
rights. So the question is whether a card required free trial that converts
silently is lawful under that regime as commenced, and, if a notice is
required, what it has to say and how far in advance it has to be sent. Behind
that is the question the product has to answer for itself either way: whether
a notice about money is a nudge in the responsible gambling sense at all, or
whether it is a contractual notice that happens to arrive by email.

**What would settle it.** Advice from a consumer law solicitor on the
subscription provisions of the 2024 Act and their commencement regulations,
applied to this trial: card required, fourteen days or thirty five slips,
converting to the yearly plan. The same conversation should cover the
struck through £34.99 on the pricing card, because that price has never been
charged to anybody and a reference price that was never the selling price is
the kind of thing the advertising codes and the unfair trading rules are
about. It is recorded here rather than fixed because `SPEC.md` specifies both
numbers, so changing them is a change to the specification.

**What the product does in the meantime.** "A reminder that the trial is about
to end" is in the list of things Slippery never sends, which is on screen in
the notification pane. Billing notices are the exception in that pane and are
locked on, because an account that cannot be told its card failed is an
account that goes read only without warning, so the mechanism a reminder would
use already exists and is already exempt from the no nudging rule. Every
surface that shows the trial says which of the two limits is about to run out
rather than making anybody count. Nothing has been charged to anybody on this
deployment: the Stripe price and webhook variables are not set, `/api/sources`
says so, and the plan step says payments are not configured rather than
spinning.

## The app overhaul

The signed-in product was overbuilt. Six screens, every one of them longer
than the window it is read in, each explaining its own mechanics in a
paragraph beside the figure it was explaining. The dashboard was the only
route in the build sized to a screen and everything else ran past the bottom
of it: the ledger measured 2,946 pixels at 1440 by 900 and Social 2,209, so
two thirds of both was never seen by anybody who did not go looking for it.
This section is what was removed and why.

### Take a break is gone, and the owner asked for it

`CLAUDE.md` carried "There is a 'take a break' control" inside the section
marked LOCKED. The owner asked for the control to be removed and said so
explicitly, overriding that line, and the line has been rewritten to match
rather than left to contradict the build.

**What went is not a safeguard.** The control set `break_until` on the
account, which paused every notification and took the account out of the
monthly leagues. It touched no ledger, no export and no history, and it was
never any form of self exclusion, because there is nothing here to be
excluded from: Slippery accepts no bets, holds no money, pays no winnings and
gives no tips, which is the whole legal position the product is built on. A
control named for a gambling intervention on a product that cannot take a
gambling transaction is a safeguard that looks like a safeguard, and that is
worse than not having one, because somebody who needs an exclusion could
reasonably read it as having got one.

**Everything genuine stays**, and each is now asserted rather than described:
18+ on the safer gambling page and at sign up, BeGambleAware, the National
Gambling Helpline on 0808 8020 133, and the safer gambling page itself, linked
from the footer of every public page and now from the Account pane as well.
`tests/responsible.test.ts` had a test called "the break control stays
reachable"; it is now "the genuine safeguards stay on screen" and it fails if
any of the four goes missing, and also if the break control comes back.

**The plumbing went with the control.** The `break` branch of
`POST /api/settings`, the `onBreak` field on the account, the `break_until`
read in `lib/server/book.ts` and the "is taking a break" line in the social
feed are all gone, because a route that still accepts a field no screen can
send is a way to put an account into a state nothing can show or clear. The
`break_until` column stays in the schema: migrations here are forward only,
and dropping a column is not the same as removing a control.

**Two sentences about it are still on the marketing site**, on
`/safer-gambling` and `/(marketing)/social`, and they are not touched here
because `app/(marketing)/` belongs to another branch working at the same time.
They describe a control that no longer exists and need deleting there.
`lib/content/faq.ts` is not under that directory and was corrected: the answer
to "I want to stop for a while" now says that nothing here has to be closed
and that no notification is ever sent about not having bet, and it carries
the helpline.

### Slippery tracks bets at any time

Every sentence implying a slip has to be sent before kick off is gone. The
product's argument is that a record written afterwards is a record of the bets
somebody felt like writing down, and the way to hold that line is to state,
per bet, whether it reached the record before its event started. That is a
fact about a bet. It was being printed as a rule about what may be sent, which
is a different claim and a false one: an import of four hundred rows from a
spreadsheet is bets recorded years late, and this product has a whole screen
for doing it.

So `slipBacked` is described as "came off a slip rather than a keyboard"
wherever it is shown, "Before kick off only" has gone from the tracking
module, and the import no longer opens with "Send it now, while you still do
not know". What the social feed's gate does is unchanged and is still absolute:
an item there is a bet captured before its event started, whose event has not
started, from somebody who opted in. That is a rule about what may be
PUBLISHED to other people, not about what may be recorded.

### The import, and who paid for the stake

**Three flags, three different profits, and only the slip knows which.** Take
a £25 stake at 3.0 that returned £50. If the £25 was the account holder's
money the bet made £25. If it was a free bet, the token bought nothing back
and the bet made £50, and losing it would have cost nothing. If it was bonus
funds, the whole £75 converts and the bet made £75 off no capital at all.
Every one of those is a true reading of the same row, and three weeks later
nothing in the ledger can tell them apart. That is why the flags are set at
ingestion and why the reader now looks for them.

**What was there.** `isFreeBet` and `isBoosted` were asked of the model as
bare booleans with no evidence attached, `isBonusFunds` existed as a column,
a field on the bet and a switch on the review screen and was **hardcoded
false at every point a read could set it**. The fold gave bonus funds no
behaviour of its own, so a bonus stake was folded as the bettor's own money:
a real loss where there was none, and a return computed over a stake that was
never put up. Manual entry had no bonus funds control at all.

**Detection is a phrase table beside the model, and both show their working.**
`detectPromotions` in `lib/data/importing.ts` is pure and reads the chrome the
reader transcribes: free bet, Bet Credits, stake not returned, SNR, risk free;
bonus funds, bonus balance, bonus money, staked from a bonus, wagering
requirement; price boost, enhanced odds, Power Price, a crossed out price
raised. The model is asked as well and the two are OR-ed, because a model can
miss a greyed token in a footer and the table can miss a promotion it has
never seen. Neither is believed silently: the phrase that fired rides to the
review screen and sits beside the switch, so a wrong read is one press to
undo.

**The bonus funds phrases are the narrow ones, deliberately.** bet365 prints
"BONUS 1/4 2x" on a Lucky 15, which doubles the odds on a single winner and is
not a penny of bonus money. Reading the bare word "bonus" as bonus funds would
take a real stake out of turnover and stop a real loss counting, on a slip
shape this product's own worked example uses. A bonus funds match needs the
word beside something that names a balance, and a test pins the Lucky 15
string.

**Free bet beats bonus funds when a slip says both**, in the table and again
in the reader. "Free bet placed from your bonus balance" is a token that
happened to sit in the bonus wallet, and the stake of a free bet is not
returned, which is the fact the arithmetic turns on.

**The arithmetic, in `lib/domain/fold.ts`, is two questions and not one.**
`ownMoney()` says whether the stake cost anything and `stakeReturns()` says
whether it comes back:

| | risk | a win returns | a loss costs | in turnover |
|---|---|---|---|---|
| own money | S | S x odds | S | yes |
| free bet | 0 | S x (odds − 1) | nothing | no |
| bonus funds | 0 | S x odds | nothing | no |
| boost | S | S x odds | S | yes |

A void or a pushed half follows `ownMoney`, not `stakeReturns`: a voided bonus
funds bet puts the restricted balance back where it came from, which is not
money arriving. Read off the wrong one it paid the whole stake out as pure
profit on every void, and a test pins it.

**Turnover excludes both.** A return is a return on what you put up, and
neither a free bet stake nor a bonus stake was yours to put up. `turnoverPence`
asked only about free bets before.

**A deduction is charged on winnings, and a free bet's winnings are the whole
return.** A Rule 4 and an exchange commission both take a percentage of what a
bet won, and the fold worked that base out as the return less the stake
consumed. That is right for every bet whose return HAS the stake inside it and
wrong for the one kind that does not. A £25 free bet at 3.0 wins £50; the fold
read its winnings as £25 and a 25p in the pound Rule 4 took £6.25 where the
bookmaker takes £12.50, and the same slip on a 2% exchange was charged 50p
instead of a pound. Both errors ran the same way, in the account holder's
favour, which is the direction that does not get reported. Bonus funds do
return the stake and were already right. `winningsOn` is now the one place
that answers it, called by the Rule 4 and commission branches inside the fold
and by `commissionDue` outside it, so the base a charge is computed on cannot
disagree with the base the fold charges it on. Five tests pin it: the two
deductions on a free bet, the two on bonus funds, and one asserting a winning
free bet and the same bet in cash profit the SAME after an identical Rule 4,
which is the assertion that failed before.

**A boost changes no arithmetic and the flag says so on screen.** The stake is
the bettor's own and the price on the slip is the price the bet was struck at.
Nothing in this product records what the price would have been unboosted, so
nothing can compute an uplift, and a flag that guessed one would put an
invented number into a return. Where a boost pays as a separate credit it
arrives as a `promo_refund` event, which the fold already carries. For the
same reason a boosted bet is no longer counted into `netPromoPence`: that
figure is profit made with money that was not yours, and counting the WHOLE
profit of a boosted bet into it overstated the promotional half by everything
the bet would have won anyway.

**The review screen states the consequence in money.** Under the three
switches it prints what the bet as flagged returns on a win, what that is as
a profit, and what losing it costs, and the figures move as the switches do.
It is drawn only for a bet that is ONE line: a Lucky 15 is fifteen bets off
four selections and what it pays depends on how many win, so multiplying the
four prices and applying them to the whole stake states a return the bet
cannot produce. That was on screen for a minute before the guard went in.

**And the import stopped telling anybody when to send.** It opened with "Four
ways in. Send it now, while you still do not know." The third of those four
ways is a CSV of bets placed years ago.

### One screen, measured on every route rather than on six

"Every page fits one desktop screen with no page scroll" was built as two
rules that are not the same rule, and only the first was being checked. The
document never scrolls on any app route: `.main--fit` is the window less the
header and `.mainbody` inside it is the scroller, so `scrollHeight` equals
`clientHeight` at 1440 by 900 on all fifty of them and always did. That
measurement passes while the page runs off the bottom of the screen, because
what scrolls is the body and not the document, and it hides two different
defects.

**The first is content past the window with nothing to say so.** The
dashboard's three rows came to 718 pixels against the 674 the window leaves,
so the cumulative net and the win rate ran twenty pixels below the fold. A
twenty pixel overflow draws a scrollbar nobody notices on a page whose whole
claim is that it ends at the window. The row gap is no longer the column gap
on that grid, the period selector sits closer to what it governs, and the two
row floors come down by fourteen each: sixty pixels found against a deficit
of forty four.

**The second is a region that was never allowed to scroll.** The ledger's
list carries `overflow-y: auto` and had nothing to overflow, because its
parent was a plain block and a block child of a definite height block has no
definite height of its own. The list grew to all 218 rows and 3,671 pixels,
the ledger's body to 3,900 against a window of 824, and the header and the
filter row scrolled away with it. A column flex on `.lgr` is the whole fix,
and it had to go in components.css because `.lgr { display: block }` there is
the same specificity in a later file.

**Then the same measurement, on every route.** Twenty eight of the fifty were
scrolling their own body. Each now marks the part that is long and keeps the
part that says what the long part is: the table on change history and on the
crossed analyser, the grid of slips, the sheet and the movements on balances,
both leaderboards, the feed, the review of a read and every step of a history
import, the plan cards, the two billing states and the two device states.
`.fitcol--scroll` in layout.css is the region; `.mainbody:has(> .fitcol) >
:not(.fitcol)` stops everything else giving way, which it was doing, and had
squeezed the leaderboard's period links from 44 pixels to 28 with the words
cut through the middle. Fifty routes, nought scrolling, nought clipped.

**Two of those were shape rather than fit.** The loading placeholder was the
dashboard from before the overhaul, four tiles over four rows against seven
cards over three, so it measured 1,135 for a page that fits 824 and moved
everything the moment it was replaced, which is the one thing a placeholder
exists to prevent. The empty dashboard put the third of the three modules a
new account is shown below the fold.

### What a sweep finds that a measurement does not

`npm run audit` at 1440 by 900 turned up four defects, all of them in the
overhaul's own new work.

The ledger scrolled sideways by thirteen pixels at 320. Five period chips are
317 pixels wide against the 288 that phone leaves, and the strip sits in the
ledger's header as a flex item, whose automatic minimum size is its content.
It carries its own `overflow-x` and its own snap already; `min-width: 0` is
permission to use them.

Two links measured twenty pixels, the height of their text: the open bets
count above the ledger and the three names in the leaderboard strip on
Social. The floor is 24 on a mouse and 44 on a thumb, and symmetric padding
is what reaches it, because a ring drawn three pixels outside a box leaves
the box twenty pixels tall.

And **the win rate spilled the ring it is supposed to be inside.** The dial
takes what the card's height leaves, so at 1024 by 800 it came out 68 pixels
across while the figure stayed at `--t-fig-m`: "49.0%" needs 74 of them and
five pixels of the percent sign painted over the track. A media query cannot
see it, because the width that went wrong is the height of a grid row, so the
dial is a container and the figure steps down at 118 and 88 pixels, measured
off "100.0%" as the longest figure a ring here can hold. The module then
reads across rather than down: four columns of the bottom row is 430 pixels
wide and 96 tall, and a ring stacked over its denominator had 73 pixels with
a number in the middle smaller than the caption under it. Side by side the
ring is 100 and the figure is a figure. The dial needed `flex: 0 0 auto` to
get there, because the `flex: 1 1 auto` that makes it take the height in a
column makes it take the width in a row: the box went to 200 pixels with a 98
pixel ring drawn inside it, and the container query, which measures the box,
went on believing there was room.
