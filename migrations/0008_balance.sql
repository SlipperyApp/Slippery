-- One word for one figure.
--
-- The account's starting figure was called `bankroll_start_pence` in the
-- schema and on eleven surfaces above it, while the one place a person
-- actually reads it, the figure in the top bar, was already labelled Balance.
-- Two names for one number is how a settings row and a header end up
-- describing different things to the same person, so the schema takes the
-- word the product says out loud.
--
-- A rename rather than a new column and a backfill: nothing about the value
-- changes, and a second column would have to be kept in step with the first
-- for as long as both existed.
-- Guarded on the old name being there rather than on the new one being
-- absent. A database restored from a dump taken after this migration ran
-- already carries the new column, and an unguarded rename would fail the
-- whole file on it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'accounts'
       and column_name = 'bankroll_start_pence'
  ) then
    alter table accounts rename column bankroll_start_pence to balance_start_pence;
  end if;
end $$;

alter table accounts add column if not exists balance_start_pence integer not null default 0;
