-- Deposits and withdrawals, which are not bets and are not profit.
--
-- The balance was the starting figure plus every realised profit and loss, so
-- it could say what an account had won and could not say how much of the money
-- in there was the account holder's own. Somebody four hundred up who has
-- topped up six hundred across a season is two hundred down in the only sense
-- their current account cares about, and nothing in this product could say so.
--
-- THEY ARE THEIR OWN TABLE, not a settlement event and not a pl_entry.
--
-- Not a settlement event, because settlement_events belong to a bet and are
-- folded into bet_state by lib/domain/fold.ts, which is the only writer of
-- bet_state and the reason every displayed figure agrees with every other. A
-- deposit with no bet to belong to would have to be given a fake one.
--
-- Not a pl_entry either, and this is the distinction that matters. A pl_entry
-- is profit or loss from something that was not tracked as a bet, so it counts
-- toward net, turnover and the calendar. A movement is not profit at all. It
-- moves the balance and it enters no figure derived from bets: not return, not
-- turnover, not win rate, not the streak, not a breakdown row. A deposit that
-- changed somebody's return would make their record look better for having put
-- more money in, which is the most dishonest number this product could print.
--
-- The amount is ALWAYS POSITIVE and the direction is the kind, so a withdrawal
-- typed in with a minus in front of it cannot become a deposit on the way to
-- the database. The check enforces it rather than trusting the route.
create table if not exists money_movements (
  id            text primary key,
  account_id    text not null references accounts(id) on delete cascade,
  kind          text not null check (kind in ('deposit', 'withdrawal')),
  amount_pence  integer not null check (amount_pence > 0),
  currency      char(3) not null default 'GBP' check (currency in ('GBP', 'EUR')),
  bookmaker_id  text,
  occurred_at   timestamptz not null,
  note          text,
  created_at    timestamptz not null default now()
);

-- The read is always "this account, newest first", which is the ledger's own
-- order and the order the running balance is folded in.
create index if not exists money_movements_account_idx
  on money_movements (account_id, occurred_at desc);
