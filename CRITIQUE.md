# Slippery: a critique

Branch `verify-main` at `/tmp/slipnew`, built and served from the production build on
port 3305, walked route by route at 390x844 and 1440x900 with Chromium, every
screenshot read. 475 unit tests pass. The browser sweep is clean: no console errors,
no duplicate ids, no horizontal overflow at any mobile width, no route under three
`backdrop-filter` elements, one h1 per page, real titles everywhere. The type system
is disciplined (thirteen font, size and weight combinations across the whole ledger
screen, all Archivo and Plex Mono). The export is 41 columns of real data and is
better than anything the competitors ship. The settlement engine, the fold and the
calendar ramp are the work of somebody who understood the problem.

None of that is what is wrong. What is wrong is that the loop does not close. This
is a beautifully finished shell around a product that cannot yet do the four things
it says it does: read a slip from the bot, put it in your ledger, let you settle it,
and show you your own numbers. Every finding below that carries weight is a version
of that sentence.

---

## The five I would fix first

1. **A signed-in account is shown the example account's ledger with the "Example"
   label removed.** `getViewer()` reads `demoData()` unconditionally; the session
   cookie only switches off the banner. Send a cookie and the dashboard says
   `@tester123`, +£2,631.37, 259 bets, and nothing says it is not yours.

2. **Nothing anywhere in the interface can settle a bet.** The only settlement event
   the front end can write is `cash_out_partial`. Won, lost, void, placed, push,
   Rule 4, commission, promo refund and manual correction have no control, and
   `POST /api/settle` has no caller in the entire codebase.

3. **The Telegram bot answers every photograph with "cannot read slips right
   now"**, unconditionally, whether or not the reader is configured. The core
   product, capture at placement by forwarding a slip, is not wired on this branch.

4. **The trial's slip counter is incremented nowhere and `/api/extract` checks no
   plan, no trial and no read-only state**, so the one call that costs money per
   use is ungated for anybody, and the flag button refunds slips without limit.

5. **"Slips", "IMAGE HELD 90D" and "Delete the image now" all describe an image
   that is never stored**, and the delete button only changes its own label to
   "Requested" without sending anything anywhere.

---

## 1. What a bettor would abandon over

Walking the first hour in order: land, sign up, link the bot, send a slip, look at
the ledger, settle something, look at the dashboard.

### 1.1 The ledger you are shown is not yours

**Where.** `lib/data/session.ts:62`, `const whole = demoData(now)`, with
`const signedIn = ...` on line 84 used only for `demo: !signedIn`.

**What happens.** I set `slip_session` to an arbitrary value and loaded `/app`. The
"Example" pill in the top bar and the dismissible banner both disappeared, because
they key off the session. The data did not, because it does not. The dashboard
served `@tester123`, +£2,631.37 all time, 259 bets, a calendar of somebody else's
months and a leaderboard placing me first with 385 bets. `DECISIONS.md` records
this as open gap 1 and describes the honest version, an example account clearly
labelled for signed-out visitors. What actually ships is worse than that: the
labelling is removed at exactly the moment the data becomes a lie.

**Why it matters.** This is not "the read path is not wired yet". A new customer
who has just typed in a card sees a stranger's profitable ledger presented as their
own record. The first thing they do is either believe it, which is catastrophic for
a product whose entire claim is that its numbers are true, or disbelieve everything
else on the screen. Every write path is honest (503 without a database, 401 without
a session); the read path is the only dishonest thing in the build, and it is the
one people look at.

**What I would do.** Until the repository behind `getViewer()` exists, make the
demo data conditional on `!signedIn` and give a signed-in account with no rows the
`/app/states/new-dashboard` screen, which is already built, already good, and
already the right answer. That is a five line change and it converts the worst
defect in the product into a correct empty state. The repository itself is the real
fix and it is the next commit either way.

### 1.2 You cannot settle a bet

**Where.** `components/app/BetSheet.tsx`. Opening the bet the product itself flags
under "Waiting on a result", Newcastle v Brighton, Over 1.5 goals, £50 at 3.42 with
Coral, the sheet offers exactly three controls: "Delete the image now", "Record it"
(a closing price), and "Cash out 4 of 8 for £61.30".

**Why it matters.** The sidebar has a row called "Waiting on a result" with a warning
icon and a count. The ledger explains it: "The event finished and the score has not
settled these yet. Slippery asks rather than grading one wrong." The product
therefore creates this state deliberately, names it, badges it, and routes you to
it, and then the destination has nothing you can do. Worse, the only terminal
action offered on a match that finished yesterday is Cash out, which no bookmaker
would offer on a finished event, so the single available action writes a false
record. A profit and loss tracker where profit and loss cannot be recorded is not a
tracker. The landing page steps a visitor through "the six outcomes" in a widget
(`components/SettleDemo.tsx`); four of the six have no control in the app.

**Why it is worth pausing on.** `SPEC.md` lists under "Old defects, do not
recreate": "`settleMulti()` was written, unit-tested and never called in
production." The defect has recurred in the same shape one layer up.
`app/api/bets/[id]/events/route.ts` accepts thirteen event types and is documented
as "the ONLY path that appends a settlement event". One client calls it, with one
type. `app/api/settle/route.ts` is called by nothing at all. 475 tests pass over
this.

**What I would do.** Add a settle block to the sheet for any bet whose event has
passed: Won, Lost, Void as three buttons, plus Placed when the bet is each way,
posting the matching type to the events route that already accepts them. That is a
day's work against an endpoint and a fold that are both finished and tested. Put
Rule 4, commission and promo refund behind a "Something else happened" disclosure
in the same block rather than in the primary row. And add one end to end test that
places a bet and settles it through the interface, because a unit test is what hid
this the last time.

### 1.3 The bot cannot read a slip

**Where.** `app/api/telegram/route.ts:176-184`.

```
if (msg.photo?.length || msg.document) {
    if (!link) { await sendMessage(chatId, REPLIES.askForCode); return; }
    ...
    await sendMessage(chatId, REPLIES.readerDown);
    return;
}
```

`REPLIES.readerDown` is "UNREADABLE / Cannot read slips right now. Nothing is lost,
send it again shortly." There is no `getFile`, no download, no hash, no vision call,
no field table, no inline keyboard and no pending read. `REPLIES.paused` and
`trialExhausted()` are written and have no caller. `/today`, `/week`, `/open`,
`/last` and `/undo` share one canned reply: "TRACKING open it in the app for the
figures: /app/ledger". `/undo` in particular is advertised through `/setcommands`
and does nothing.

**Why it matters.** This is the product. The landing page's second step is "You
forward the slip. Four seconds." The onboarding checklist's first item is "Link the
Telegram bot. One code, once. After it, sending a slip takes four seconds." A person
who does exactly what the product asks gets a chat that links successfully and then
refuses every slip they send it, forever, with a message that says to try again
shortly. That is the worst possible failure mode: it does not look broken, it looks
like bad luck, so they will try again tomorrow and then leave.

**What I would do.** The ingestion branch recorded in the project doc has this
built and tested. It is unmerged, unpushed and living in a bundle, which means the
single most important system in the product is not in the thing that deploys. Merge
it, or if it cannot be merged this week, at minimum make the honest reply honest:
the bot should say the reader is not yet available on this account and offer the web
upload, rather than "send it again shortly", which is a promise the branch cannot
keep.

### 1.4 On the deployment as it stands, nobody can sign up

`/api/sources` reports `EMAIL_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `GOOGLE_CLIENT_ID` and
`VISION_API_KEY` all unset, which matches what `DECISIONS.md` says about the live
deployment. Step 2 of signup needs a six digit code that is generated, hashed,
stored and not sent. Step 6 says "Payments are not configured on this deployment, so
this button will say so rather than pretending". The honesty is admirable and the
outcome is that the funnel terminates at step 2. This is an owner task rather than a
build defect, and it is listed as one, but it belongs at the top of this section
because it is the literal first hour and it does not exist. An investor who clicks
"Start free" on the live site will find this out in ninety seconds.

### 1.5 "Add a bet" gives a phone desktop instructions

**Where.** `/app/import` at 390px. The primary panel reads "Drop a slip here. A
screenshot from the bookmaker app, a photograph of a shop slip, or a PDF. Paste one
straight in with Ctrl or Cmd and V", above a button labelled "Choose a file".

iOS Safari is the stated primary target. There is no drag and drop and no Ctrl+V on
an iPhone. The two things a phone can actually do, open the camera and pick from the
photo library, are not named. The screen is one of the four that the onboarding
checklist sends people to.

**What I would do.** Branch the copy and the primary control on a coarse pointer:
"Take a photo" and "Choose from your photos" on touch, the drop zone and the paste
hint on a pointer. One media query and two strings.

### 1.6 The controls that do nothing

Three, in order of how much they matter.

**"Delete the image now"** in the bet sheet (`components/app/BetSheet.tsx:265`) is
`onClick={() => setImageGone(true)}`. It sets local React state, relabels itself
"Requested", and sends nothing. It sits next to the sentence "The image is deleted
after 90 days, or now if you ask", which is a privacy commitment the privacy policy
repeats. Pressing it is the user exercising a data right, and it is a no-op.

**The seven notification switches** in Settings, About
(`components/app/SettingsPanes.tsx:471-484`), call `setNotifs({...})` and nothing
else. No save, no request, no persistence. Reload the pane and they revert.
`DECISIONS.md` records the same defect being found and fixed on the sharing
switches, with the line "That is a picture of a control, not a control". It survives
one pane away.

**Two sidebar links point at a route that does not exist.** `AppShell.tsx:122` and
`:129` link "Settlements to confirm" and "Questions to answer" to `/app/review` and
`/app/review?kind=proposal`. There is no `app/app/review` directory and the route
404s. Both rows are hidden today because the demo has zero of each, which means this
will appear on the day the ingestion branch lands and starts producing them.

**What I would do.** Wire the image delete to the settings route that already does
this (`app/api/settings/route.ts:60` updates `slip_images` on request), persist the
notification toggles through `/api/settings` the way the break toggle already does,
and either build `/app/review` or point those two rows at the ledger filters until it
exists.

### 1.7 The dashboard's biggest module is blank for the first days of every month

The calendar always opens on the current month (`components/app/Calendar.tsx:92`,
`useState(0)`, an offset from now) whatever is in it. Today is 2 September and the
example account's records run February to August, so the largest module on the
dashboard, 661 by 444 pixels, is an empty grid with two struck-through dates and the
words "Nothing settled". The same empty grid is the second module on the public
shared balance page at `/b/sb-...`, which is the link people send to friends.

`DECISIONS.md` notes the related problem (the scope defaulting to This month) and
declines to change the period list without asking, which is right. This is a
different thing and does not touch the ruling: the calendar is explicitly exempt
from the scope bar, so what month it opens on is its own decision. Opening on the
most recent month that has anything in it, with the month name in the header saying
so, would cost nothing and would stop the product looking empty twelve times a year
and on every shared link sent in the first week of a month.

---

## 2. What an investor would ask, and what we could not answer

### 2.1 Unit economics of the vision model. No answer, and the meter is not connected.

`trial_slips_used` is written in exactly one place in the entire repository, and
that place **decrements** it: `app/api/reads/flag/route.ts:18`. Nothing increments
it. So `trialState()`, the function whose whole reason for existing is that "one
function owns both numbers and reports which one ran out", computes `slipsLeft = 35 -
0` forever. The slips half of the trial cannot run out. Every surface that shows the
sentence "14 days left, or 35 more slips, whichever runs out first" is reporting a
counter that never moves.

`/api/extract`, the call that spends money, checks nothing. Not the trial, not the
plan, not read-only. Its only guard is `limitOr429(req, 'extract', 20, 900)`, and
`lib/server/ratelimit.ts` is an in-memory `Map` keyed on the forwarded IP, described
in its own docstring as "per instance, so it is a speed bump rather than a
guarantee". On Vercel that is per lambda, so under any concurrency it is not a limit
at all. An unauthenticated caller with a script can run the vision model at will.

The flag path makes it worse in the paid direction. `POST /api/reads/flag` decrements
the counter, writes an audit row, and returns "the read goes for a human look". It
does not check that the read belongs to the account, that it exists, or that it has
been flagged before, so the same `readId` can be flagged repeatedly, twenty times per
fifteen minutes per IP, each one refunding a slip. And there is no human: the audit
row is written to a table nothing reads and there is no queue, no notification and no
admin screen. The escape hatch offered on the most trust-critical screen in the
product goes nowhere.

The commercial shape this leaves: the pricing page promises "Unlimited slips, every
bet type" at £29.99 a year, which is £2.50 a month. A Sonnet-class vision read of a
slip screenshot is on the order of a penny to two pence at current prices. A bettor
placing thirty bets a week is roughly 130 slips a month, so the model alone is
plausibly two thirds of the revenue before Vercel, Neon and Stripe. I would not put
weight on my price arithmetic, but I would put weight on this: there is no cost
telemetry anywhere in the repository, no per-account slip count that works, no cap,
and a printed promise of "unlimited". The honest answer to the question today is
that nobody knows what a heavy user costs and nothing would tell you.

**What I would do, in order.** Increment `trial_slips_used` inside the same
transaction as the read in `/api/extract` and in the bot path. Gate `/api/extract` on
`trialState().active || plan === 'active'` and return the 402 copy that
`trialExhausted()` already writes. Bind the flag refund to a read id that exists,
belongs to the account, and has not been refunded. Log input and output token counts
per read against the account so that in a month there is a real cost per active user
to put on a slide. None of that is more than a day and all of it is asked for
somewhere in `SPEC.md` already.

### 2.2 The wedge against auto-sync. Answered well in the argument, given away in the copy.

The argument is genuinely strong and it is written down properly: Pikkit, Betstamp
and Juice Reel all sync from the sportsbook account, that is a US phenomenon because
UK books do not offer it, and Juice Reel's own pitch attacks screenshots on the
grounds that people post the winners and delete the losers. Capture at placement
answers that better than sync does, because sync tells you what you bet and capture
tells you what you believed before you knew.

The hero of the landing page then says: **"Forward a slip to the bot before kick off,
in play, or after it settled."** That single line gives the wedge away. A tracker
that accepts a slip after settlement is a tracker with the same defect as the
spreadsheet, and the product knows it: the social feed's gate refuses any bet whose
capture timestamp is after the off, on the recorded grounds that "a bet posted after
the off is not a prediction, it is a claim". The FAQ's second answer is a clean
statement of exactly the right position. The hero contradicts both.

**What I would do.** Take "or after it settled" out of the hero and put it in the
FAQ where it belongs, as the answer to "can I add an old bet". The hero should say
the thing nobody else can say: you record it before you know.

### 2.3 What happens when a bookmaker changes its slip layout. Half an answer.

The design is right. `lib/server/vision.ts` detects the bookmaker from a signature
table over the transcribed text rather than trusting the model's prose, refuses to
accept a price the model scored low, and cross-checks the model's stake against the
line arithmetic. The review screen is built around per-field confidence and shows
"Not read" as an empty box rather than a plausible guess, which is the correct
behaviour and rare.

What does not exist is the loop that would tell you a layout had changed. There is a
`reference_slips` table and no rows in it, no accuracy figure anywhere in the
product, no alerting on a rise in low-confidence fields or in flags per bookmaker,
and the flag itself, as above, goes into an audit table nobody reads. So the honest
answer is that bet365 could ship a redesign on a Tuesday and the first anybody would
know is a support email, if there were support. The 50 to 100 golden set slips are
correctly flagged as an owner task; the missing half that is not an owner task is the
monitoring: flags per bookmaker per week, and low-confidence rate per bookmaker
per week, on one admin page.

### 2.4 Retention mechanics that are honest. Nothing is measured, and one shipped mechanic breaks the rule.

There is no instrumentation of any kind in the repository. No product analytics, no
activation counter, no funnel. The onboarding checklist is well judged, four steps,
never nags, never sent anywhere, disappears when finished, and nothing counts how
many people finish it. The answer to "what is your activation rate" is that it cannot
be computed.

Worse, the one retention mechanic that has shipped breaks the locked rule. On
`/app/you` there is a badge, "Capture streak: 30 days of logging a slip on the day
you placed it", drawn as earned, and `lib/data/social.ts:418` broadcasts "captured a
slip every day for 30 days" into other people's activity feed. A capture streak is
dressed as an app action and it is not one: it is unearnable without placing a bet on
thirty consecutive days. That is a reward for volume, published to your friends. The
brief's rule is "Celebrate app actions, never betting outcomes" and "Nothing may
nudge toward more volume", and this passes the letter of the first while failing the
second outright.

Latent behind it, `lib/themes.ts:20` declares "Every theme past the first is an
unlock, not a settings free for all", and the eight unlock strings include "Log 10
slips", "Settle 25 bets" and "A 30 day streak of capture". The field is read by
nothing, so none of it is enforced today, which is the only reason this is a warning
and not a fifth item in the top five. It is a loaded gun with a comment above it
asserting the policy, and the next session will implement it.

**What I would do.** Delete the capture streak badge and the streak feed item, and
delete the `unlock` field or rewrite the three volume-based strings to things that do
not require betting (import a history, settle a bet, join a group, twelve months on
Slippery, all of which are already in the list). Then add first-party activation
counting: account created, bot linked, first slip, first settle, day 7 return. Count
app events on your own account only, never betting behaviour, never anything about
another person's bets. That is inside the rules and it is the difference between a
pitch that has retention numbers and one that has adjectives.

### 2.5 The regulatory position of the leaderboard. Recorded as an owner question and not answered, and there is now a second one.

`CLAUDE.md` correctly flags the Gambling Commission position on the leaderboard as
an owner task. The compliance work that has been done is good: 18+ stored with a
timestamp, BeGambleAware and the helpline number in the footer of every public page,
no guaranteed-winnings copy anywhere, a take-a-break control, and a clear statement
that Slippery takes no stakes.

Two things a serious investor's counsel would raise that are not in the flagged list.

**The trial converts with no reminder, by design.** `SPEC.md` states, and the plan
step repeats on screen, "The plan starts automatically when the trial ends. There is
no trial-end reminder email, deliberately: a reminder is a nudge." The product
reasoning is sound and the consumer-law position is the opposite. The subscription
regime in the Digital Markets, Competition and Consumers Act 2024 is built around
pre-renewal reminder notices and cooling-off, and a card-required free trial that
auto-converts silently is the exact pattern it targets. This is not a nudge in the
gambling sense: it is a contractual notice about money. I would get advice, and I
would expect the answer to be that the reminder is mandatory, in which case the
right framing is that a billing notice is not a betting nudge, which the product
already accepts elsewhere (billing notifications are locked on in the notification
list).

**The struck-through £34.99.** The pricing card shows £29.99 against a struck-through
£34.99 and, in the same card, a pill reading "Save £11.89 a year". The two numbers
measure different things: £11.89 is the saving against twelve monthly payments of
£3.49, and £34.99 minus £29.99 is £5.00. A reader takes it as £11.89 off £34.99,
which is wrong. Separately, £34.99 has never been charged to anybody, because the
product has not launched, and a reference price that was never the selling price is
the classic CAP and CPRs problem. `SPEC.md` specifies both numbers, so this is a bug
in the specification rather than a divergence from it, and `SPEC.md` says to say so
rather than diverge silently. I would drop the struck-through price entirely and keep
"Save £11.89 a year against paying monthly", which is true, checkable and enough.

### 2.6 Why anybody pays £29.99 rather than using a spreadsheet. Not answered anywhere.

Seventeen FAQ questions, and not one of them is this one. The questions answer what
the product does not do, exhaustively and well, and never answer what it is worth.
The pricing page's argument is "One price. Every feature. No tier that hides the
useful half", which is an answer to "why not the cheaper tier", a question nobody is
asking.

The real answer is available and unstated: a spreadsheet cannot capture at placement,
so a spreadsheet is a record of the bets you felt like writing down; a spreadsheet
cannot represent two partial cash outs, a Rule 4 and a commission charge on one bet,
so a spreadsheet's profit figure is wrong in the direction that flatters you; and a
spreadsheet cannot settle itself. That is one paragraph and it belongs on the pricing
page above the plan cards. Note that the second of those three claims is only true
once section 1.2 is fixed.

---

## 3. Where it still looks amateur

The obvious things are genuinely gone. What is left is structural, and most of it is
visible only at desktop width or on the screens a demo does not usually reach.

### 3.1 The desktop app is a phone layout stretched to 1440

**Where.** `/app/ledger` at 1440. Measured: the row is 1110px wide, the left grid
cell is 1028px, the gap between the two cells is 12px. The text inside the left cell
(pill, selection, fixture and market, then stake, price, bookmaker and date) occupies
about 460px. The money sits at the far right. So every row of the ledger is 570px of
nothing with the result of the bet a thousand pixels away from the name of it.
Reading down a page of thirty bets means a thousand-pixel eye movement per row, or
giving up and reading only one column.

This is what separates the product from a serious analytics tool more than any
other single thing. Betstamp, Pikkit and every spreadsheet the customer is coming
from present bets as a table: date, selection, market, book, stake, price, result,
profit, in columns you can scan and sort. Slippery presents them as a chat log. The
same shape repeats on the balances page and on the group tables.

**What I would do.** Above 1000px, render the ledger as a real table with the columns
above, sortable, with the row click still opening the sheet. The analyser already
proves the codebase can draw one (`/app/analyser` is a proper sortable table and is
the best-looking screen in the app). Keep the current stacked row below 1000px, where
it is correct.

### 3.2 Fixed-height modules with nothing in them

**Where.** The dashboard, at both widths.

The design decision that every module has a fixed height token so that rows match by
construction is sound, and the cost of it is on screen. "Breakdown" is 1152 by 408
with two rows in it, Football and Tennis, and 91px of measured empty space under the
last one. "Offers versus own" is 367 by 408 with two figures and a bar, and roughly
140px of nothing between them. "Closing price" is 1152 by 307, and its four figures
occupy the top 120px of the full width while its two explanatory paragraphs occupy
the left third of the remainder and two thirds of a 1152px module are empty.

The Closing price module is the worst offender and breaks the codebase's own rule.
`SPEC.md`: "a module shows a figure and a label, the figure leads and the label
captions it. Definition survives and interpretation dies." That module has four
figures, four captions, and then two paragraphs, the second of which restates the
first caption at length: "79 of 259 bets carry a closing price you recorded. The
other 180 bets here are not counted as level: nobody recorded a price for them, so
there is nothing to compare. Nothing in Slippery works a closing price out." On a
phone that module alone is nearly two full screens.

**What I would do.** Cut the second paragraph entirely, move the first to a "?"
disclosure on the module header, and let the module shrink to its content. If the
fixed-height contract has to hold, let a short module take the smaller height token
rather than padding a tall one with air.

### 3.3 The Slips gallery is 161 tiles of nothing

**Where.** `/app/gallery`, and the reason is in `app/api/extract/route.ts`.

The page reads "161 captured slips, newest first. 121 still have an image and 40 were
removed on the 90 day schedule". Every tile is a grey card with a camera glyph, the
bookmaker in small caps, the selection, the stake and price, and a footer reading
"IMAGE HELD" with a day count. There is not one image on it.

Underneath, `slip_images` is only ever selected from, updated and deleted. There is
no `INSERT` anywhere in the repository, which `DECISIONS.md` records honestly as open
gap 6. So the retention sweep has nothing to sweep, the image-hash duplicate fast
path can never match, and the three statements the interface makes about the file,
"121 still have an image", "IMAGE HELD 90D", and "The image is deleted after 90 days,
or now if you ask", are all false about a real account.

**Why it matters more than it looks.** This is the screen that would prove the
headline claim. A person evaluating a slip reader wants to see their slip next to
what was read off it. Showing them 161 identical placeholder cards is the moment the
product reads as a mock.

**What I would do.** Store the image. It is the smallest of the four big gaps and it
unlocks the gallery, the retention clock, the delete control and, more than any of
those, the review screen showing the crop beside the field it came from. Until it is
stored, say so: "Images are not kept on this deployment" is a fine sentence and the
tiles should say it rather than "IMAGE HELD".

### 3.4 The result colours have drifted again, through the hole in the test

`DECISIONS.md` has a section titled "The two result colours mean money, or they mean
nothing", recording nine places where `#86EFAC` had come to mean "read cleanly",
"stage done", "badge earned", and `#FCA5A5` had come to mean "field missing". It was
fixed, and `tests/contrast.test.ts` was written to hold the line.

The test only inspects lines that contain `className` or `class=`
(`tests/contrast.test.ts:259`). Five places now set the semantic colours through an
inline `style` and pass:

- `components/auth/LoginForm.tsx:62`, profit green as "this email looks valid"
- `components/marketing/WaitingListForm.tsx:40`, profit green as "you are on the list"
- `components/app/SettingsPanes.tsx:490`, loss red as "never sent", which is a good thing
- `app/app/states/offline/page.tsx:70`, loss red as "not available offline"
- `app/app/billing/read-only/page.tsx:40`, loss red as "paused"

The login form is the second screen anybody sees. The billing screens are where red
already means "your card was declined" and now also means "this feature is off". The
principle in the decision holds and the mechanism that enforces it has a hole.

**What I would do.** Extend the test to inline styles and `var(--pos)` / `var(--neg)`
in `style={{}}`, then fix the five. The accent and the two inks are already the
sanctioned alternatives and `.readmark--ok` proves the pattern.

### 3.5 A badge on the Social nav that counts nothing

`lib/data/session.ts:105` is `social: 3`, a literal. It renders as a "3" pill beside
Social in the sidebar and its screen reader text is "3 items". There are not three of
anything. Rule 5 of the codebase is "Every count derives from one query. The facet
total equals the row total", written because a previous build had a banner saying 486
bets, a ledger saying 482 and facets summing to 474. A hardcoded notification count
is the same defect with the number chosen by hand, and it is also a small engagement
mechanic: a red dot on a social tab that never clears.

### 3.6 A multi is unidentifiable in the ledger and in the export

A five-fold in the ledger reads: title "5 fold", subtitle "Over 2.5 goals / Over 2.5
goals / Over 2.5 goals / Over 2.5 goals / Over 2.5 goals". No fixtures. The export's
legs column is the same: "Leeds @ 1.97 | Over 2.5 goals @ 1.34 | Over 2.5 goals @
1.97". A bettor looking for last Saturday's acca cannot find it, and the column
reads as generated data rather than a record.

The fix is free. `BetLeg` already carries `eventName` and it is populated: the bet
sheet prints it correctly ("Shamrock Rovers, Shamrock Rovers v Bohemians, 2.02,
WON"). `components/app/BetRow.tsx:105` joins `l.selection` only, and
`lib/server/export.ts` does the same. Print the fixture with the selection in both.

### 3.7 Smaller, and each one real

- **The handle truncates in the app bar on the primary target.** At 390px the top bar
  reads "@tester…" because the balance switcher on the right is taking the room.
  `SPEC.md` reserves the right-hand slot for the running-bets pill, not for a money
  figure. There is a comment in `AppShell.tsx` explaining that the wordmark was
  removed to stop exactly this, and it is still happening.

- **Nothing on the ledger row says it is pressable.** The row is a full-width button
  that opens the sheet and carries no chevron, no affordance and no visible hover
  treatment in the screenshot. Separately, the markup is a `<ul>` inside a `<button>`
  inside an `<li>`, which is invalid content model and which axe will not catch.

- **The analyser table clips a column header mid-word.** At 1440 the scroller is
  1154px inside 1110px, so the last header reads "AVERAGE PRI" with no fade, no
  shadow and no scroll affordance. At 390 the same table is 1116px inside 323px, so
  the best screen in the product is three and a half phone-widths wide with nothing
  saying so.

- **Two links to Settings, and pressing the one labelled Settings lights up the one
  labelled You.** `lib/nav.ts` gives the "You" row `match: ['/app/you',
  '/app/settings', '/app/billing']`, and `AppShell` also renders a separate Settings
  row pinned to the bottom of the sidebar. This is the same defect the file's own
  comment says was fixed for Import: "two links a centimetre apart, going to the same
  screen, under two different names".

- **"This month" on the Social page prints a return over two settled bets.** The card
  reads "+5.9u ... 1 won, 1 lost, over 7 bets. +66.9% return." `DECISIONS.md` states
  the rule plainly: "A return over fewer than five bets is left out. It is not a
  return, it is the price of one of those bets." The leaderboard table beside it
  enforces that rule with a marked left edge. The card does not.

- **The same person has three different bet counts on three screens.** The dashboard
  says 259, the balances page says 355 for "All pounds", and the leaderboard row says
  385. Each is correct in its own scope and the reason is written down properly in
  `lib/data/social.ts:238`, where the league deliberately folds the whole book because
  a league ranks a person rather than a pot. Nothing on the leaderboard says so. One
  line of copy, "across every balance", closes it.

- **A missing space on the landing page.** `app/(marketing)/page.tsx:119-120` renders
  "Up £1,184.00means something different when £890.00 of it came from sign-up
  offers." JSX has eaten the newline between the expression and the text. It is
  visible at 1440 in the third section of the home page.

- **"Nothing is deleted. Ever, for any reason."** on the pricing page. In context it
  means "not for non-payment", which is a good policy. As written it is contradicted
  by the 90 day image schedule, by Reset account, by Delete account and by the right
  to erasure the privacy page commits to.

---

## 4. Features that are missing and would matter

Ranked by how much each would change somebody's decision to pay, with what it costs
and which rule of the codebase it strains.

### 4.1 Manual settlement, including the four events the model already understands

**Changes the decision most, by a distance.** Without it the product cannot do the
thing it is for. Everything else on this list is an improvement to a ledger; this is
the ledger.

**Cost: low.** The endpoint accepts all thirteen types, the fold handles them, the
tests pin the arithmetic, and the sheet is already the right container. A day for
Won, Lost, Void and Placed; a second day for Rule 4, commission adjustment, promo
refund and manual correction behind a disclosure.

**Strains:** nothing. It is the rule. `lib/domain/fold.ts` stays the only writer,
`appendResult()` in `lib/server/bets.ts` already decides commission, and the browser
still never grades a bet because the person is telling it what happened rather than
the engine inferring it.

### 4.2 Storing the slip image

**Changes the decision a lot**, because it is the proof. The review screen showing
the crop beside the field read off it is the demo that sells this product, and it is
currently impossible.

**Cost: medium.** Blob storage, a storage key, an insert, and the retention sweep
already written. The 90 day clock, the delete control, the gallery and the image-hash
fast path all light up from one change.

**Strains:** the privacy commitments, in the good direction. It is the only item on
this list that adds a legal obligation rather than discharging one, so the retention
sweep has to be right before the first image is written, not after.

### 4.3 Faceted breakdowns of the summary, not one summary at a time

Betstamp's headline claim is ROI sliced by sport, league, bet type, prop type,
over/under, side and sportsbook. Slippery has the pieces: `/app/analyser` is a real
two-dimensional pivot with export, and the dashboard breakdown does six dimensions in
one module. What it does not do is let somebody ask "my ROI on football unders at
Sky Bet between 2.0 and 3.0", which is the question a serious bettor buys a tracker
to answer.

**Cost: low to medium.** The scope bar already filters by bookmaker and sport;
adding market, odds band and stake band to the same bar reuses the same `select()`
call.

**Strains:** rule 5, and this is the important part. It must derive from the same row
array `summarise()` folds, or the facets will disagree with the total, which is the
defect this codebase was rebuilt to eliminate. That is a constraint on the
implementation, not an argument against it.

### 4.4 Tipster attribution and tags, in the entry path

Two of the six Bet-Analytix features the owner named are tipster attribution and
followable tipsters. Slippery has the tipster dimension in the breakdown, a
`tipsterId` on the type, a `tipster` column in the export, and the example account
even shows a "Value Tips" row with 31 bets. A real account can never produce one:
`app/api/bets/route.ts:155` writes `tipsterId: null` on every bet, the manual entry
form has no tipster field, no tag field and no note field, and the Organising
settings pane renders only "Bookmakers and commission" and "Market groups" despite
its own index card promising "Bookmakers, tipsters, markets and tags".

**Cost: low.** A select on the manual form, a tipster list in Organising, and the
same field on the review screen. The `tipsters` and `tags` tables are in the schema.

**Strains:** the SPEC ruling that tipster attribution is per Telegram channel rather
than per tipster. That ruling is right for the bot path and does not preclude a
picker on a typed bet.

### 4.5 A closing price that somebody could actually produce

The Closing price module is the most sophisticated thing on the dashboard and it
reads "Prices you recorded". It is real for the example account, which has 79 of 259
recorded, and it will be empty for every real account forever, because the only way
to record one is to type a decimal into a box on each bet's sheet after the off. The
module is conditional, so a real user will simply never see it, which is honest and
also means the feature does not exist.

The ingestion branch has the better answer already worked out: measure against the
exchange price on the other side of a trade, because an exchange price has no margin
and Slippery already records exchange prices with commission and a timestamp. That
is the version worth shipping.

**Cost: high** if it means a price feed, **low** if it means the exchange-side
measurement in the ingestion branch.

**Strains:** the ruling in `SPEC.md` that closing line value was cut entirely,
"module, settings and marketing", on the grounds that closing prices cannot be
sourced. That ruling has already been partly reversed in this build without being
rewritten, which is worth resolving in `DECISIONS.md` either way.

### 4.6 Choosing which balance a bet lands in

Multiple bankrolls are done well: three balances, per-balance statistics, a balance
sheet that refuses to sum two currencies, a shareable read-only link. What is missing
is the entry side. `app/api/bets/route.ts:77` resolves the balance from the cookie
rather than the request, which is the right security decision and correctly
explained, and the manual entry form does not say which balance is open. Somebody
running a horses bankroll and a football bankroll will put bets in the wrong one and
will not find out until the balance sheet disagrees with their memory.

**Cost: trivial.** Name the balance on the entry form and on the confirm reply.

### 4.7 More than three sports

Football, tennis and horse racing (`lib/data/reference.ts:8`). No greyhounds, no
darts, no cricket, no golf, no boxing, no NFL, no basketball. For a UK and Irish
product that is a real ceiling, and greyhounds in particular is a glaring absence
beside horse racing. There is nothing on any screen that tells somebody their sport
is not supported before they have paid.

**Cost: high for settlement, low for tracking.** The distinction is the answer: a
sport Slippery cannot grade can still be tracked and settled by hand, once 4.1
exists. Adding sports as trackable-but-not-auto-graded is cheap and honest; adding
them as auto-graded is a results source per sport.

**Strains:** the SPEC ruling "Sports: Football, Tennis, Horse racing. Only these
three." That ruling makes sense as a limit on the grader and much less sense as a
limit on the ledger.

### 4.8 The demo account should contain horse racing

Not a feature, but it belongs here because it costs an hour and it is on the investor
path. The Main balance's Sport breakdown has two rows, Football 197 and Tennis 62.
Horse racing lives in a second balance that the demo does not open on. A UK bet
tracker whose demo shows no racing invites the obvious question in the first minute
of the pitch. Move a slice of the racing bets into Main, or open the demo on a
balance that has all three.

---

## One thing that is not a finding but should be written down

`DECISIONS.md` records the leaderboard as being up 55.9% over 385 bets for the
example account, twice any plausible Slipper, and leaves it alone because changing it
would move every screenshot and several tests. That is a reasonable trade for a
build and a poor one for a pitch. An account showing +37.6% return over 259 bets,
with a profit curve that only ever goes up after March, is the shape of a fabricated
track record, and the one audience trained to spot a fabricated track record is
bettors. The example account would be more convincing at plus four or five per cent
with two bad months in it, and it would demonstrate the product better, because a
tracker's value is telling somebody something they did not want to hear.
