# Slippery: the data and behaviour specification

Recovered from `dee44bd^` and edited so the next session does not have to dig
it out of history.

**There is no prototype.** The original text was written against
`slippery-prototype.html` and deferred to it on anything visual: "the prototype
wins on look", "copy the custom property blocks verbatim", "build every one of
the 59 sheets", "match the prototype's spacing, type scale and animation
timing". That file no longer exists and is not coming back. Every one of those
instructions has been removed. The visual design in this repository is its own.

**This document wins on rules, data and behaviour.** Where it disagreed with
the owner's rebuild brief, the brief won and the change is marked
**SUPERSEDED** with the reason.

No placeholders, no TODOs, no dead controls, no invented features.

## Product

A bettor screenshots a bookmaker slip, forwards it to a Telegram bot (or uploads/types it), Slippery reads it, they confirm, it lands in their ledger and settles itself. Slippery **never** accepts bets, holds money, pays out, or gives tips. This is legally load-bearing.

## Stack

Next.js App Router on Vercel · Postgres on Neon via Drizzle or Kysely · email+password with codes plus Google OAuth · Stripe subscriptions · server-side vision model for slip reading · Telegram Bot API webhook · transactional email. React state only, no Redux.

Server-only env vars: `DATABASE_URL` `AUTH_SECRET` `GOOGLE_CLIENT_ID/SECRET` `STRIPE_SECRET_KEY/WEBHOOK_SECRET` `TELEGRAM_BOT_TOKEN/WEBHOOK_SECRET` `VISION_API_KEY` `EMAIL_API_KEY` `ADMIN_SECRET`. Grep the built bundle for all of them before declaring done.

## Data model (most important section)

**A bet is a container with a settlement ledger, not a row with a result.** The old app stored one result per bet and cannot represent repeated partial cash outs, commission, Rule 4 or late promo refunds. This model absorbs all four through one mechanism.

```sql
accounts(id, email citext unique, password_hash, display_name, handle citext unique,
  unit_pence, currency char(3) default 'GBP', week_start smallint default 1,
  odds_format default 'decimal', show_profit_in default 'currency',
  calendar_dates bool default true, theme default 'periwinkle', bankroll_start_pence,
  link_code unique, trial_ends_at, trial_slips_allowed, trial_slips_used default 0,
  plan, plan_state, age_confirmed_at, created_at)

bets(id, account_id, shape,          -- single|multi_same_fixture|multi_cross_fixture|each_way|system
  side default 'back',               -- back|lay
  stake_pence, liability_pence,      -- liability for lay only
  odds numeric(10,3), currency, fx_rate,
  bookmaker_id, tipster_id, sport_id, competition, course,
  event_name, selection, market_raw, market_group_id,
  event_at not null,                 -- CANONICAL for every period total
  placed_at not null, expected_settle_at,        -- required for antepost
  is_free_bet, is_each_way, ew_place_fraction, rule4_deduction,
  slip_backed bool default false,
  source,                            -- telegram|web_upload|manual|csv_import|shot_import
  arb_group_id, note, created_at, updated_at)

bet_legs(id, bet_id, seq, selection, market_raw, market_group_id, fixture_id, leg_odds, leg_result)

settlement_events(id, bet_id, seq, type,
  -- won|lost|void|placed|push|half_won|half_lost|cash_out_partial|cash_out_full
  -- |rule4|commission|promo_refund|manual_correction
  fraction_eighths smallint,         -- 1..8, cash_out_partial only
  stake_portion_pence, odds, returned_pence, occurred_at,
  entered_by, after_result_known bool default false, note, created_at)

bet_state(bet_id pk, status,         -- open|part_settled|settled
  remaining_stake_pence, realised_pl_pence, returned_pence, units, updated_at)

pl_entries(id, account_id, entry_date, amount_pence, stake_pence, bookmaker_id, note, source)

bookmakers(id, account_id, name, group_name, commission_pct, enabled, is_custom)
tipsters(id, account_id, name, unit_pence_override, channel_ref, hidden, is_bot_default)
sports(id, account_id, name)
market_groups(id, account_id, canonical_name, is_default) / market_aliases(id, market_group_id, alias)
tags(id, account_id, name) / bet_tags(bet_id, tag_id)
groups(id, name, picture_url, join_mode, ranking_period, slip_backed_only,
  show_edit_audit, invite_code, admin_account_id) / group_members(group_id, account_id, joined_at)
follows(follower_id, followee_id)
slip_images(id, account_id, bet_id, storage_key, sha256, uploaded_at, delete_after)
telegram_links(telegram_user_id bigint pk, chat_id, account_id, telegram_username, linked_at)
telegram_updates(update_id bigint pk, seen_at)        -- idempotency guard
audit_log(id, account_id, entity, entity_id, action, before jsonb, after jsonb,
  source, after_result_known, created_at)
reference_slips(id, image_key, bookmaker, expected jsonb, added_at)   -- golden set
```

- `bet_state` recomputes from `settlement_events` in the same transaction on every write.
- **Every displayed figure reads `bet_state`.** Nothing renders from `settlement_events` directly.

## Rulings (do not "improve" these)

**Time and periods**
- `event_at` owns profit and drives all period totals. `placed_at` is stored and filterable, never used for period maths. Everything Europe/London, so a 00:30 kick-off belongs to the day the fixture is listed under.
- Periods: Today, This week, This month, This year, All time, Custom. Week starts Monday or Sunday per account, affecting both the calendar and weekly totals.

**Settlement**
- Partial cash out is a slider in **eighths of remaining stake**, relabelled after each pull, one event per pull, repeatable. Never eighths of the original stake.
- A multi cashed out in play keeps recording leg results for leg stats, but they stop determining the outcome. The cash-out event is terminal.
- Lay bets store `liability_pence`, ROI denominator is liability, never averaged into back-bet odds stats.
- Commission is a per-bookmaker percentage applied as its own event on net winnings only.
- Rule 4 and promo refunds are events. A refund adjusts P&L and bankroll but never the original odds or result.
- Antepost requires `expected_settle_at`, sits in a Long-term open bucket, is exempt from the stale-result nudge, and profits to `event_at`.

**Reporting**
- Voided stakes are excluded from turnover and the ROI denominator everywhere. Where a period contains any void, show: "Turnover and ROI exclude £X of voided stakes."
- Free bets: stake excluded from turnover, returns stake-not-returned, headline splits real money from promo.
- Arb pairs (shared `arb_group_id`) report as one net line and are **excluded from win rate, streaks and average odds**. They still count to net and turnover.
- `pl_entries` count toward net, turnover and the calendar but **never** win rate, streaks, or best/worst day. Say so in the UI wherever they appear.
- Currency per bet with `fx_rate` captured at settlement so history never drifts. GBP and EUR only.

**Data integrity**
- Duplicate detection matches selection + stake + bookmaker + `event_at`, preferring the settled screenshot's data. Image hash only catches identical files.
- Manual and shop bets are first class and set `slip_backed = false`, which is what group verification filters on.
- Tipster attribution is per Telegram channel, not per tipster.
- Every mutation writes `audit_log` with `source` and `after_result_known`. Edits after a known result are flagged in the bet's Change history and, if the group enables it, counted on the group leaderboard.

**Commercial**
- **SUPERSEDED. Trial: 14 days or 35 slips**, whichever runs out first, replacing "5 days or 15 slips". One function owns both numbers and reports which one ran out; the client is told the answer rather than counting, so no two surfaces can disagree. Card required. **The yearly plan starts automatically when the trial ends. There is no trial-end reminder email, deliberately.**
- Referral: the referred person gets the longer trial, the referrer gets nothing, both auto-follow each other.
- Pricing: free trial · £3.49 a month · £29.99 a year against a struck through £34.99 with a "Save £11.89 a year" pill. Yearly is recommended and badged.
- Payment failure: attempt one retries in three days, **two failed attempts means read only**. Read only keeps ledger and export fully live; new slips, imports and the bot pause. **Never delete history for non-payment.** Reversible with a working card.

**Scope**
- Sports: Football, Tennis, Horse racing. Only these three.
- Groups: members see each other's unit size and this cannot be disabled while a member. Outside a group only units show, stakes never. Position renders "4 of 12" with the number gold, silver or bronze for the top three. **Groups cannot be renamed.**

## Screens

- **Public**: Landing, Demo (the example account, handle `@tester123`, with a dismissible note). Plus the six other marketing routes, each with its own title, one h1, its own meta description, a canonical link and an OG image. **SUPERSEDED: the seven marketing paths are seven real routes.** Previously all seven returned byte identical HTML with a single title between them.
- **Auth, six steps with a progress bar**: (1) email, password with live rule ticks for 8 characters / one capital / one special, 18+ and terms, Google **below** the OR divider (2) six-digit code on its own screen with resend and change email (3) display name plus optional referral code which flags the extended trial (4) unit picker with worked examples (5) three sports plus bookmakers in collapsible Flutter/Kambi/Other groups with custom add (6) plan and card with a "Today £0.00" summary. Plus sign in, forgotten password, and the **429 state on both signup and login**.
- **Dashboard**. **SUPERSEDED: one fixed layout.** No Edit overview, no packer, no pinning, no drag reorder, no presets. Every module has a fixed column span and a fixed height token, so rows match by construction rather than by stretching. One global scope bar governs every module; exactly three ignore it and say so in their own header (Running now is live by definition, the calendar is always the month shown, offers versus own is always all time). The four breakdown modules became one with a segmented control. Recent bets is cut, absorbed by Running now as a "settled today" section with a footer link to the ledger. Closing line value is cut entirely, module, settings and marketing: closing prices cannot be sourced and an average over whichever bets happen to be priced overstates itself. *Ledger*: summary strip (staked, returned, net, ROI on the filtered set), Bets/History segment, search, Filters, Sort, Select, outcome facets with live counts, rows, load more.
- **Social**, one page: your groups, Discover (search plus Popular/Newest/A–Z), People with Following/Followers. Plus group detail (verification banner, leaderboard with slip-backed percentages and late-edit flags, challenge) and person profile showing their groups.
- **Add a bet**: entry, crop, analysing, review, type it in, import history, history review.
- **Settings**: six groups, each opening a detail pane. Account · Betting · Data · Sharing · Organising · About. Not 33 flat rows. Destructive actions sit at the bottom of Data behind a rule, in the loss colour, both needing a typed confirmation.
- **States**: new account with onboarding checklist and per-card empty states, empty ledger, empty social, offline with queued bets, save failed showing the arithmetic conflict, unreadable slip showing which fields were read.
- **Billing**: trial, payment declined (attempt 1 of 2), read only.

## Settings must genuinely work

- Odds format converts every displayed price: `1.90` → `9/10` → `-111`.
- Show profit in currency, units or both, changing every value in the ledger and cards.
- Week start reorders the calendar day letters and recomputes weekly totals. Calendar date numbers toggle.
- Unit changes every unit figure; bets already logged keep the unit they were logged with.
- Market groups: master toggle, per-variant remove, add alias, new group, driving the By-market card.
- Bankroll starting balance so growth reads as a percentage. Open exposure shows against it.
- Notifications: seven toggles, billing notices locked on. Security: password change by emailed link, optional two-step, device list with individual and bulk sign-out.
- Export CSV/JSON/PDF works in read only and after cancelling. Reset account (deletes bets, keeps account) and Delete account are separate, both offering export first.
- Destructive actions show a toast with **Undo** for four seconds instead of a confirm dialogue, except account deletion which keeps its confirm sheet.

## Themes

Eight, all of them dark. **SUPERSEDED: there is no light mode and no light
theme.** It was tried and rejected: profit green measures 1.07 to 1 on beige,
which is invisible. The eight names carry forward and nothing about their
appearance does:

`carbon` (default) · `periwinkle` · `ink` · `graphite` · `slate` · `bronze` ·
`cinnabar` · `sage`

`#86EFAC` profit and `#FCA5A5` loss are LOCKED, semantic and declared exactly
once, outside every theme block. No theme may redefine them and no theme accent
may sit near either, which is why there is no green theme and no red theme.
`tests/themes.test.ts` asserts the hue distance.

All colour flows through custom properties and `color-mix()`. There is no
hardcoded hex outside the theme blocks, which the same test asserts.

Theme switching fades out 190ms, swaps, and fades back. **Never tween
`color`**, or text goes unreadable through the middle of the transition.

## Responsive

- **<640px**: full-screen app, bottom tab bar of four (Dashboard · Add a bet · Social · Settings), Add a bet in the accent colour.
- **640–999px**: same single column, comfortable margins.
- **≥1000px**: 210px sidebar with a "Menu" label and active indicator, then a two-column grid. Net card and ledger span both columns. Single purpose screens (add a bet, crop, review, type it in, import history, plan, referrals, person, group, and every empty and error state) render as a **centred column**, auth centres narrower still, and sheets become centred modals.
- App bar is a three-column grid: logo left, avatar plus `@handle` centred, reserved slot right for the running-bets pill. Wordmark text hides below 428px, the mark stays. Calendar cells cap at 52px with 12.5px figures.

## Telegram bot

Setup: BotFather `/newbot`, `/setcommands` for start, today, week, open, last, undo, help, stop, then `setWebhook` with `secret_token` and `allowed_updates:["message","callback_query","my_chat_member"]`.

Three rules that are not optional:
- **Verify `X-Telegram-Bot-Api-Secret-Token` on every request and 401 on mismatch**, or anyone guessing the URL can write into people's ledgers.
- **Return 200 immediately, process after**, deduping on `update_id`. Telegram retries any non-200 and a slow read otherwise creates duplicate bets.
- **`answerCallbackQuery` on every callback**, or the button spins forever despite the write succeeding.

Photo path: verify secret → 200 → dedupe → look up link → unlinked? ask for code and stop → check plan state → `sendChatAction typing` → `getFile` and download the largest size immediately (links expire ~1h) → sha256 and duplicate check → vision read → classify shape → mark low-confidence fields rather than guessing → reply with a field table plus inline keyboard → store pending read with TTL → on Confirm write bet and events and reply.

| Incoming | Response |
|---|---|
| `/start` unlinked | Ask for the code, one line |
| Valid `SLIP-XXXX` | Link, confirm, invite first slip |
| Invalid code | "Not a code I recognise." Never reveal whether it exists |
| Code linked elsewhere | Offer to move, needing re-confirmation in the app |
| `/start` linked / `/stop` | Confirm which account and offer `/stop` / unlink, confirming bets untouched |
| Bot blocked or removed (`my_chat_member`) | Mark link dormant, stop sending, never delete |
| Photo, linked, quota fine | Field table + Confirm / Edit |
| Photo, unlinked | Ask for the code. **Do not read the image** |
| Album (shared `media_group_id`) | Buffer ~1.2s, read together, reply once |
| PDF or image document / other file type | Same as photo / decline and list what is accepted |
| Forwarded photo | Treat normally, this is the main use case |
| Text resembling a bet | Parse it, same field table |
| Unreadable / partially readable | Name **which field** is missing and how to fix it / show gaps and disable Confirm until filled |
| Reply with a value after unreadable | Merge into the pending read, re-show |
| Duplicate | Show the existing bet, Add anyway / Ignore |
| Several bets in one image | One reply listing each, Confirm all / Review in app |
| Photo that is not a slip | Say so, do not guess |
| Group message from a linked member | Extract, attribute to the sender, log |
| `Confirm` / `Edit` | Save and reply with open count and exposure / deep link to that bet |
| Confirm on an already-confirmed read | "Already saved" plus a link, never double-write |
| `/today` `/week` `/open` `/last` `/help` | Figures, running bets, last bet, commands |
| `/undo` | Remove the last bet from this chat within 24h, confirming what went |
| Unknown text | One line pointing at `/help` |
| Trial exhausted or expired / read only / rate limited | Say what ran out with a link / say paused with a billing link and read nothing / say when to retry with a number, never go silent |
| Reader unavailable | "Cannot read slips right now, nothing lost, send it again shortly" |

Outbound unprompted: `FT` result with P&L and today's total when a Telegram-sourced bet settles, **batched into one message** if several settle within a minute; a request for the result if none found three hours past expected finish; one message when a target is met, once per period. No trial-end reminder.

Voice: fixed scannable prefixes `READ` `TRACKING` `FT` `UNREADABLE` `DUPLICATE` `PAUSED` `LINKED`. No greetings or exclamation marks. `callback_data` is 64 **bytes**, so keep it short and key state in the database. **Never log slip contents**, only chat ID and a short outcome line, as the privacy policy commits you to.

## Compliance

Slippery takes no stakes and settles nothing, so it sits outside UKGC licensing (the Commission's guidance on gambling software excludes performance analytics). **This holds only while it never accepts stakes, places or settles bets, or acts as an intermediary. Add no feature that crosses that line.**

Required: 18+ acceptance stored with a timestamp; a footer on every public page carrying 18+, BeGambleAware.org and "National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day"; no copy implying guaranteed winnings or that betting solves money problems; full Terms and Privacy pages, whose final wording is an owner task; slip images deleted after 90 days or immediately on request; export always available.

**No store badge is drawn by hand.** Apple and Google both forbid redrawing or recolouring their artwork and both require a live listing. Until there is one, the landing page ships a single line of text, "iOS and Android coming soon. The web app works today", linking to a waiting list. `brand/store-badges/README.md` says exactly where to drop the official downloaded files and what the clear space rules are. Neither company permits a modified "coming soon" badge, which is why that line is separate text.

## Old defects, do not recreate

- **`settleMulti()` was written, unit-tested and never called in production.** Multiples were stored as one row with legs joined by `&`. The event model exists to prevent this. Prove it with an end-to-end test, not a unit test, because a passing unit test is what hid it.
- **Link codes were seeded in a format the bot's own validator rejected.** One format, one validator, one test asserting a generated code passes it.
- **No `429` branch on signup or login**, just the raw rate-limit string in a toast with no countdown.
- **Counts disagreed across the product**: banner 486 bets, ledger 482, facets summing to 474. Every count derives from one query, zero-count facets are hidden, and the facet total equals the row total.
- **Email validation accepted `a@b..com`.** Use a real validator.
- **Hardcoded £100 unit against £25–£50 actual stakes, and a £2,500 target nobody set.** Nothing the user can set is hardcoded.
- **A "Check results now" button that did nothing.** Every control works or is not shipped.

## Migration

Existing multiples are wrong because `settleMulti()` never ran. Migrate by re-deriving legs from the ampersand-joined selection string, sending anything that cannot be split reliably (a team or market name containing an ampersand) to **Fix problem bets → Combined selections** rather than guessing, re-settling clean splits into proper `settlement_events`, and reissuing link codes in the single valid format. **Dry run first and report counts before writing.**

**Also: wipe the owner's signed-up account back to a clean state. Keep the Tester accounts and their group membership intact.**

## Build order and gates

1. Schema, migrations, `bet_state` recompute, tests · 2. Auth all six steps including 429 · 3. Themes, layout shell, breakpoints, navigation · 4. Manual bet entry and ledger · 5. Settlement events in order: won/lost/void/placed/push/full cash out, then **partial cash out in eighths**, then Rule 4, commission, promo refund · 6. Dashboard cards and charts · 7. Slip reading: upload, crop, analysing, review, confirm · 8. Telegram bot, every route · 9. Social, groups, verification, challenges · 10. Stripe, trial, two-attempt rule, read only · 11. Import history, market groups, calculators, export · 12. Empty, offline and error states, onboarding checklist · 13. Reader accuracy screen ready for the golden set · 14. Legal pages, compliance footer, badges.

**Stop and report after 1, 4, 5 and 8. Do not continue past a failing gate.**

## Definition of done

Automated, actually executed in **real Chromium**, never jsdom: every route at
390, 430, 1024 and 1440, across all eight themes. Assert zero console errors,
`body.scrollWidth <= clientWidth` at every mobile width, axe-core clean, no
duplicate IDs, keyboard operable, every button clicked twice with something
observable happening, and every view rendering more than 40 characters.
Screenshot at 390x844 and look at it.

Odds convert 1.90 to 9/10 to -111 and 2.50 to 6/4. Profit display switches
between currency and units. Week start reorders the day letters. The calendar
shows the correct day count with **no future day carrying a value**. The
eighths slider computes against remaining stake and two consecutive partial
cash outs leave the correct remainder. A grep of the production bundle finds
none of the environment variable values.

Owner tasks to hand back, not to attempt: the 50 to 100 reference slips for
the golden set, a real Telegram message end to end, anything needing a payment
card, credential rotation, the Gambling Commission position on the
leaderboard, ICO registration, and the final wording of Terms and Privacy.

## Rules of engagement

- **British spelling. No em dashes anywhere.** No emoji as an interface
  element: they rasterise from the system font, cannot take the profit or loss
  colour, and differ per platform. Use an SVG symbol.
- Other Slippery users are **Slippers**, never "users". "Members" is kept for
  people inside a specific group, because that is a role rather than an
  identity.
- Every control works or is not shipped. No dead buttons, no TODO, no "not
  built yet", no placeholder strings.
- A chart without a conclusion is decoration, but the commentary is cut: a
  module shows a figure and a label, the figure leads and the label captions
  it. Definition survives and interpretation dies.
- Found a genuine bug in this document? Say so and propose a fix, never
  diverge silently.
