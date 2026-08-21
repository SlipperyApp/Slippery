# The ninety one fake controls

Every button in the render layer carrying `data-toast`: it shows a message and
does nothing. This is the audit of all of them.

**The plan that produced this asked me to treat account, billing, social and
bet data as "no backend exists".** That was true of the prototype. It is not
true of this deployment, which has Neon Postgres, the append-only settlement
ledger, auth, the Telegram bot, the slip reader, Stripe checkout and export.
So the categories below are what the deployed system can actually do, and
almost nothing needs to become a "coming soon".

| Category | Meaning | Count |
|---|---|---|
| PREFERENCE | A setting. Persists through `PATCH /api/settings` when signed in, `localStorage` when not. | 10 |
| WIRE TO A DEPLOYED ROUTE | Real data, and the route is already live. | 25 |
| NEEDS A NEW ROUTE | Real data, schema exists, route written in this pass. | 33 |
| BILLING | Stripe. Checkout and webhook are deployed; the portal is added in Phase 3. | 6 |
| NOT BUILT | Genuinely does not exist. Gets an honest state, never a lying toast. | 16 |
| ALREADY HONEST | Not a fake action. | 1 |

**A control that looks like it deletes your account and silently does nothing
is worse than one that admits it is not ready.** The rows marked *destructive*
are the ones that must never ship as a no-op.

| # | Location | Button | Toast | Category | Notes |
|---|---|---|---|---|---|
| 0 | `?` | (icon) | Coming soon to the App Store | **NOT BUILT** |  |
| 1 | `?` | (icon) | Coming soon to Google Play | **NOT BUILT** |  |
| 2 | `offline` | Retry | Retrying… | **ALREADY HONEST** |  |
| 3 | `saveerr` | Use £180.00 | Corrected to £180.00 | **NEEDS A NEW ROUTE** |  |
| 4 | `saveerr` | Keep as a draft and fix later | Kept as a draft | **NEEDS A NEW ROUTE** |  |
| 5 | `ledger` | Delete | 3 bets deleted | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 6 | `ledger` | Load more | 12 more loaded | **WIRE TO A DEPLOYED ROUTE** |  |
| 7 | `discover` | Group averages only. Individual figures need a membership. | ${J[0]==='Join'?'Joined '+g[0]:'Request sent to '+g[0]} | **NOT BUILT** |  |
| 8 | `person` | Following | Disconnected from BlueSlip | **NOT BUILT** |  |
| 9 | `crop` | (icon) | ${x} | **NOT BUILT** |  |
| 10 | `manual` | + Add another leg | Leg added | **NEEDS A NEW ROUTE** |  |
| 11 | `manual` | Today, 19 Aug 2026 | Date picker | **PREFERENCE** |  |
| 12 | `imphistreview` | Toggle all | All toggled | **NEEDS A NEW ROUTE** |  |
| 13 | `settings` | Slip images | Slip images deleted | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 14 | `settings` | Log out | Logged out | **WIRE TO A DEPLOYED ROUTE** |  |
| 15 | `plan` | Monthly | Switched to monthly | **BILLING** |  |
| 16 | `plan` | Yearly | Staying on yearly | **BILLING** |  |
| 17 | `referrals` | Share | Link copied | **NOT BUILT** |  |
| 18 | `su1` | (icon) | Google sign-up | **NOT BUILT** |  |
| 19 | `su2` | Resend | Code resent | **WIRE TO A DEPLOYED ROUTE** |  |
| 20 | `bs_reminder` | Keep my plan | Plan kept | **BILLING** |  |
| 21 | `bs_reminder` | Switch to monthly, £3.49 | Switched to monthly | **BILLING** |  |
| 22 | `bs_failed` | Try again now | Retrying… | **BILLING** |  |
| 23 | `period` | Apply range | Custom range applied | **PREFERENCE** |  |
| 24 | `profile` | (icon) | Choose a picture | **NOT BUILT** |  |
| 25 | `profile` | Save | Profile saved | **WIRE TO A DEPLOYED ROUTE** |  |
| 26 | `bot` | Open Telegram | Opens t.me/SlipperyAppBot | **WIRE TO A DEPLOYED ROUTE** |  |
| 27 | `bot` | Copy code | Copied | **WIRE TO A DEPLOYED ROUTE** |  |
| 28 | `resetcode` | Reset | New code SLIP-9M3X | **WIRE TO A DEPLOYED ROUTE** |  |
| 29 | `unlink` | Unlink | Unlinked | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 30 | `target` | Save | Target saved | **PREFERENCE** |  |
| 31 | `arb` | Unpair these bets | Pair removed | **NEEDS A NEW ROUTE** | destructive |
| 32 | `share` | Save image | Image saved | **NOT BUILT** |  |
| 33 | `share` | Copy | Copied to clipboard | **WIRE TO A DEPLOYED ROUTE** |  |
| 34 | `tags` | + New | Tag created | **NEEDS A NEW ROUTE** |  |
| 35 | `tags` | Edit | Rename ${t[0]} | **NEEDS A NEW ROUTE** |  |
| 36 | `wrong` | Send | Sent with the figures attached | **NEEDS A NEW ROUTE** |  |
| 37 | `newchal` | Start it | Challenge set | **NOT BUILT** |  |
| 38 | `slipimg` | Download image | Downloaded | **WIRE TO A DEPLOYED ROUTE** |  |
| 39 | `golden` | Import reference slips | Choose screenshots to import | **NOT BUILT** |  |
| 40 | `lsort` | Sort by | Sorted by ${o.toLowerCase()} | **PREFERENCE** |  |
| 41 | `lsort` | Filter and sort | Sorted by ${o.toLowerCase()} | **PREFERENCE** |  |
| 42 | `filters` | Clear | Filters cleared | **PREFERENCE** |  |
| 43 | `filters` | Apply | Filters applied | **PREFERENCE** |  |
| 44 | `bankroll` | Save | Bankroll saved | **PREFERENCE** |  |
| 45 | `security` | Change password | Password change email sent | **WIRE TO A DEPLOYED ROUTE** |  |
| 46 | `security` | Sign out | Signed out | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 47 | `security` | Sign out everywhere else | Signed out everywhere else | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 48 | `markets` | Remove | Removed from ${g[0]} | **NEEDS A NEW ROUTE** | destructive |
| 49 | `markets` | + Add a market | Add a market to ${g[0]} | **NEEDS A NEW ROUTE** |  |
| 50 | `markets` | + New group | New group created | **NEEDS A NEW ROUTE** |  |
| 51 | `markets` | Remove | Removed from ${g[0]} | **NEEDS A NEW ROUTE** | destructive |
| 52 | `markets` | + Add a market | Add a market | **NEEDS A NEW ROUTE** |  |
| 53 | `markets` | + New group | New group created | **NEEDS A NEW ROUTE** |  |
| 54 | `rules` | Where bets come from | ${r[0]} | **NOT BUILT** |  |
| 55 | `books` | + Add | Add a custom bookmaker | **NEEDS A NEW ROUTE** |  |
| 56 | `books` | Remove | ${b} removed | **NEEDS A NEW ROUTE** | destructive |
| 57 | `tipsteredit` | Save | Tipster saved | **NEEDS A NEW ROUTE** |  |
| 58 | `tipsteredit` | Merge into another | Merged | **NEEDS A NEW ROUTE** |  |
| 59 | `tipsterdel` | Delete and move bets | Tipster deleted, 21 bets moved | **NEEDS A NEW ROUTE** | destructive |
| 60 | `sports` | + Add | Add a sport | **NEEDS A NEW ROUTE** |  |
| 61 | `sports` | (icon) | ${t[0]} | **NOT BUILT** |  |
| 62 | `tipsterpick` | Add a bookmaker | ${t} | **NEEDS A NEW ROUTE** |  |
| 63 | `addbook` | Add it | Bookmaker added | **NEEDS A NEW ROUTE** |  |
| 64 | `bookpick` | Export all bets | ${b} | **WIRE TO A DEPLOYED ROUTE** |  |
| 65 | `export` | Download | Downloading… | **WIRE TO A DEPLOYED ROUTE** |  |
| 66 | `fix` | Each one previews before it changes anything. | ${o[0]} | **NOT BUILT** |  |
| 67 | `support` | Send an email | Opening your mail app | **NOT BUILT** |  |
| 68 | `support` | Copy address | Copied | **WIRE TO A DEPLOYED ROUTE** |  |
| 69 | `legalDoc` | Email me a copy | Copy sent to your email | **NOT BUILT** |  |
| 70 | `betdetail` | Delete | Bet deleted | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 71 | `editbet` | 19 Aug 2026 | Date picker | **PREFERENCE** |  |
| 72 | `editbet` | Rule 4 deduction | Rule 4 applied | **NEEDS A NEW ROUTE** |  |
| 73 | `editbet` | Result | Result set | **NEEDS A NEW ROUTE** |  |
| 74 | `editbet` | Save changes | Saved | **WIRE TO A DEPLOYED ROUTE** |  |
| 75 | `editrow` | Save | Row updated | **WIRE TO A DEPLOYED ROUTE** |  |
| 76 | `joincode` | Join | Joined Irish Racing | **NEEDS A NEW ROUTE** |  |
| 77 | `creategroup` | Add a picture | Choose a picture | **NEEDS A NEW ROUTE** |  |
| 78 | `creategroup` | Create | Group created | **NEEDS A NEW ROUTE** |  |
| 79 | `joingroup` | Join | Joined | **NEEDS A NEW ROUTE** |  |
| 80 | `groupadmin` | Change picture | Choose a picture | **NEEDS A NEW ROUTE** |  |
| 81 | `groupadmin` | Slip-backed bets only | ${r[0]} | **NEEDS A NEW ROUTE** |  |
| 82 | `groupadmin` | Transfer admin | Admin transferred | **NEEDS A NEW ROUTE** |  |
| 83 | `groupadmin` | Delete group | Group deleted | **NEEDS A NEW ROUTE** | destructive |
| 84 | `unit` | Save | Unit set | **PREFERENCE** |  |
| 85 | `privacy` | Payment method | ${o[0]} | **NEEDS A NEW ROUTE** |  |
| 86 | `card` | Save | Card updated | **WIRE TO A DEPLOYED ROUTE** |  |
| 87 | `cancelplan` | Cancel my plan | Cancelled | **BILLING** | destructive |
| 88 | `reset` | Reset everything | Account reset | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 89 | `delacc` | Delete everything | Deleted | **WIRE TO A DEPLOYED ROUTE** | destructive |
| 90 | `forgot` | Send a code | Code sent | **WIRE TO A DEPLOYED ROUTE** |  |
