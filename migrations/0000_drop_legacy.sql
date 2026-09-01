-- Drop the previous build's schema before creating this one.
--
-- The brief is explicit that the previous database contents are disposable
-- and that anything which collides may be dropped and recreated. This is that
-- permission, written down and applied once.
--
-- WHY IT IS NEEDED. 0001 uses `create table if not exists`, which is the right
-- thing for a migration that may be re-run. Against a database that already
-- had tables of the same NAMES and different SHAPES, "if not exists" silently
-- kept the old ones, and the first `create index ... (email, ...)` then failed
-- with `column "email" does not exist`. The whole file rolled back, the build
-- stayed green because the runner is deliberately not fatal, and
-- GET /api/sources reported `schema.applied: []` for three deployments before
-- anybody read it.
--
-- Only the tables this schema owns are named. Anything else the old build left
-- behind is untouched, because dropping a table nobody asked about is not a
-- migration, it is a guess.

drop table if exists
  audit_log,
  reference_slips,
  pending_reads,
  telegram_updates,
  telegram_links,
  slip_images,
  follows,
  group_members,
  groups,
  pl_entries,
  bet_tags,
  bet_state,
  settlement_events,
  bet_legs,
  bets,
  tags,
  market_aliases,
  market_groups,
  sports,
  tipsters,
  bookmakers,
  sessions,
  verification_codes,
  waiting_list,
  accounts
cascade;
