# Slippery: full rebuild

Rebuild **Slippery**, a bet tracker for UK and Irish bettors. Full rebuild, not a refactor. The old deployment's defects are listed below and several are architectural.

You are given **`slippery-prototype.html`**: one self-contained file with all 35 views, 59 sheets, 8 themes, final copy, and exact layout at mobile and laptop widths. **Read it in full and click every harness button before writing code.**

**The prototype is the visual and copy specification. This document is the data and behaviour specification. Prototype wins on look, this document wins on rules.**

No placeholders, no TODOs, no dead controls, no invented features. If something cannot be built, stop and say so.

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
- Trial: 5 days or 15 slips, whichever runs out first. Valid referral makes it 14 days or 40 slips. Card required. **The yearly plan starts automatically when the trial ends. No trial-end reminder email, deliberately.**
- Referral: the referred person gets the longer trial, the referrer gets nothing, both auto-follow each other.
- Pricing: free trial · £3.49/month · £29.99/year against a struck-through £34.99 with a green "Save £11.89 a year" pill. Yearly is recommended and badged.
- Payment failure: attempt one retries in three days, **two failed attempts means read only**. Read only keeps ledger and export fully live; new slips, imports and the bot pause. **Never delete history for non-payment.** Reversible with a working card.

**Scope**
- Sports: Football, Tennis, Horse racing. Only these three.
- Groups: members see each other's unit size and this cannot be disabled while a member. Outside a group only units show, stakes never. Position renders "4 of 12" with the number gold, silver or bronze for the top three. **Groups cannot be renamed.**

## Screens

- **Public**: Landing, Demo (example account, handle `@tester123`, dismissible note).
- **Auth, six steps with a progress bar**: (1) email, password with live rule ticks for 8 characters / one capital / one special, 18+ and terms, Google **below** the OR divider (2) six-digit code on its own screen with resend and change email (3) display name plus optional referral code which flags the extended trial (4) unit picker with worked examples (5) three sports plus bookmakers in collapsible Flutter/Kambi/Other groups with custom add (6) plan and card with a "Today £0.00" summary. Plus sign in, forgotten password, and the **429 state on both signup and login**.
- **Dashboard**, two tabs only. *Overview*: reorderable cards, each above the fold or under Show more, covering net and target · calendar · profit curve · recent bets · all time · month by month · staking discipline · by bookmaker, market, tipster, tag, sport, competition, course, odds range, day of week. *Ledger*: summary strip (staked, returned, net, ROI on the filtered set), Bets/History segment, search, Filters, Sort, Select, outcome facets with live counts, rows, load more.
- **Social**, one page: your groups, Discover (search plus Popular/Newest/A–Z), People with Following/Followers. Plus group detail (verification banner, leaderboard with slip-backed percentages and late-edit flags, challenge) and person profile showing their groups.
- **Add a bet**: entry, crop, analysing, review, type it in, import history, history review.
- **Settings**: Account · Appearance · Betting · Slips · Privacy and data · Help · Danger zone.
- **States**: new account with onboarding checklist and per-card empty states, empty ledger, empty social, offline with queued bets, save failed showing the arithmetic conflict, unreadable slip showing which fields were read.
- **Billing**: trial, payment declined (attempt 1 of 2), read only.
- **59 sheets**, all in the prototype. Build every one.

## Settings must genuinely work

- Odds format converts every displayed price: `1.90` → `9/10` → `-111`.
- Show profit in currency, units or both, changing every value in the ledger and cards.
- Week start reorders the calendar day letters and recomputes weekly totals. Calendar date numbers toggle.
- Edit overview reorders by drag or arrows; the toggle moves a card between the overview and Show more. Persists per account.
- Unit changes every unit figure; bets already logged keep the unit they were logged with.
- Market groups: master toggle, per-variant remove, add alias, new group, driving the By-market card.
- Bankroll starting balance so growth reads as a percentage. Open exposure shows against it.
- Notifications: seven toggles, billing notices locked on. Security: password change by emailed link, optional two-step, device list with individual and bulk sign-out.
- Export CSV/JSON/PDF works in read only and after cancelling. Reset account (deletes bets, keeps account) and Delete account are separate, both offering export first.
- Destructive actions show a toast with **Undo** for four seconds instead of a confirm dialogue, except account deletion which keeps its confirm sheet.

## Themes

Eight, darkest to lightest: **Periwinkle** (default), Ink, Graphite, Slate, Tide, Bronze, Light, Linen. Copy the custom-property blocks verbatim from the prototype. Each theme defines its own `--pos`, `--neg`, `--a`; the two light themes need darker green and red. All colour flows through custom properties and `color-mix()`, no hardcoded hex outside the theme blocks. Theme switching fades out 190ms, swaps, fades back. **Never tween `color`** or text goes unreadable mid-transition.

## Responsive

- **<640px**: full-screen app, bottom tab bar of four (Dashboard · Add a bet · Social · Settings), Add a bet in the accent colour.
- **640–999px**: same single column, comfortable margins.
- **≥1000px**: 210px sidebar with a "Menu" label and active indicator, then a two-column grid. Net card and ledger span both columns. Settings uses balanced `columns:2` with `break-inside:avoid` so it never goes gappy. Single-purpose screens (add a bet, crop, review, type it in, import history, plan, referrals, person, group, all empty and error states) render as a **centred 560px column**, auth centres at 470px, sheets become centred modals, the expanded month calendar spans both columns.
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

Required: 18+ acceptance stored with a timestamp; a footer on every public page carrying 18+, BeGambleAware.org and "National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day"; no copy implying guaranteed winnings or that betting solves money problems; the full Terms (15 sections) and Privacy policy (14 sections) shipped verbatim from the prototype; slip images deleted after 90 days or immediately on request; export always available.

The prototype draws the App Store and Google Play badges to specification, but **replace them with the official downloaded assets before launch**. Both forbid recolouring or modification, both require clear space of one quarter the badge height, Apple requires 40px minimum onscreen, and neither permits a modified "coming soon" badge, so that stays as separate text.

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

Automated, actually executed: Playwright at 360, 390, 430, 1024, 1280 and 1440 (mobile widths with touch), visiting every route, **clicking every button twice**, opening and closing every sheet, across all eight themes. Assert zero console errors, zero horizontal overflow (`body.scrollWidth <= clientWidth`), no app-bar collisions, and every view rendering more than 40 characters. The guided tutorial completes all ten steps at 390 and 1440 with a non-zero spotlight each step. Odds convert `1.90 → 9/10 → -111`; profit display switches between `+£9.00` and `+0.36u`; week start reorders day letters; the calendar shows the correct day count with **no future day carrying a value**; the eighths slider computes against remaining stake and two consecutive partial cash outs leave the correct remainder. A grep of the production bundle finds none of the env vars.

Manual, by you: forward a real slip screenshot end to end and confirm correct figures land; fail a Stripe payment twice and confirm read only with ledger and export still working; cancel during the trial and confirm nothing is charged.

Owner task to hand back, not to attempt: supply the 50 to 100 reference slips for the golden set.

## Rules of engagement

- Match the prototype's spacing, type scale, copy and animation timing. Do not redesign.
- Copy is final. British spelling. **No em dashes anywhere.** If a string is in the prototype, use it exactly.
- Report progress against the build order with gate results, not narrative.
- Found a genuine prototype bug? Say so and propose a fix, never diverge silently. Requirement ambiguous? Ask before building. Do not guess and do not build both.
