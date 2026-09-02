-- Three defects that each made the reported profit and loss wrong.
--
-- COMMISSION WAS NEVER CHARGED. The fold has handled a `commission` event
-- since 0001 and bets.commission_pct has been on the table just as long, and
-- nothing in the product ever appended one. Neither settlement path mentioned
-- commission at all, so every winner on Betfair Exchange, Smarkets, BETDAQ or
-- Matchbook was reported 1.5 to 2 per cent high, and every lay bet with it.
-- The example account builds its own events and DOES charge commission, which
-- is why the screenshots looked right while real ledgers did not. Nothing in
-- the schema needs to change for that fix; it is recorded here because this is
-- where somebody will look for it.
--
-- A PLACED BET REPORTED AS LOST. bet_state.outcome had six values and none of
-- them was `placed`, so the fold collapsed a place to won or lost on the sign
-- of the money. A £10 each way at 4.0 on fifths, third of twelve, is a win
-- part that loses £10 and a place part that wins £6: the pair is £4 down and
-- the ledger said Lost on one row and Won on the other. Neither is the race.
--
-- A DUPLICATE WAS DETECTED ON THE IMAGE. Two screenshots of one slip are two
-- different files, so both saved and every aggregate counted the bet twice.
-- The bet itself is now fingerprinted, and the image hash stays as the fast
-- path in front of it.

-- --------------------------------------------------------------- the place

-- A check cannot be widened in place, so the old one goes first. It is found
-- by what it CONTAINS rather than by name: 0001 declared it inline, so its
-- name is whatever Postgres generated, and an `if exists` drop that guesses
-- the name wrong is a silent no-op that leaves the old check standing and
-- every `placed` write failing on a constraint nobody can see in this file.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relnamespace = 'public'::regnamespace
       and rel.relname = 'bet_state'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%cash-flat%'
  loop
    execute format('alter table bet_state drop constraint %I', c.conname);
  end loop;
end $$;

alter table bet_state add constraint bet_state_outcome_check
  check (outcome in ('won','lost','placed','cash-profit','cash-loss','cash-flat','void'));

-- How many places the bookmaker paid. ew_place_fraction already says what a
-- place was worth; this says how many there were, which is the other half of
-- "3rd of 12, places paid 1-3". Null means the slip did not say, and a place
-- count is never inferred from a field size.
alter table bets add column if not exists places_paid smallint;
alter table bets drop constraint if exists bets_places_paid_check;
alter table bets add constraint bets_places_paid_check
  check (places_paid is null or (places_paid >= 1 and places_paid <= 30));

-- ----------------------------------------------------------- the duplicate

-- A hash of the PARSED BET, not of the file: bookmaker, selection, stake,
-- price, event and event time. Two screenshots of one slip are two files with
-- two sha256s and one fingerprint, which is the whole point of it.
--
-- Nullable, because every bet written before this migration has no fingerprint
-- and backfilling one would be inventing a value for a row nobody is about to
-- upload a second screenshot of.
alter table bets add column if not exists bet_fingerprint text;

-- The lookup is always "this account, this fingerprint, recently", so the
-- index carries created_at and the window is applied on top of it. Not unique:
-- two genuinely separate bets on one fixture at one price DO collide here, and
-- a unique index would refuse the second one instead of asking about it.
create index if not exists bets_fingerprint_idx
  on bets (account_id, bet_fingerprint, created_at desc)
  where bet_fingerprint is not null;
