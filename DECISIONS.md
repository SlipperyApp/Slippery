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
