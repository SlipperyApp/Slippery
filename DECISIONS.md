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
