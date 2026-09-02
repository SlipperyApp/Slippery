-- A balance for every account, including the ones created after 0011 ran.
--
-- Migration 0011 seeded one balance per account and then made bets.balance_id
-- and money_movements.balance_id not null. It seeded the accounts that existed
-- on the day it ran and nothing has inserted a balance since: signup writes an
-- accounts row and stops. So every account created after 0011 has no balance,
-- while lib/data/viewer.ts draws one called Main so that an empty screen is
-- denominated in something. The screen names a container, the container has no
-- row, and the first bet typed into that account fails on the not null and
-- comes back as "that failed and nothing was saved".
--
-- This is 0011's seed run again, which is safe because it is guarded on the
-- account having no balances rather than on this file never having run. From
-- here the row is also created on first use, in lib/server/balances.ts, inside
-- the same transaction as the write it is for: a migration fixes the accounts
-- that exist tonight and the code fixes the one that signs up tomorrow.

insert into balances (account_id, name, currency, start_pence, unit_pence, sort)
select a.id, 'Main', a.currency, a.balance_start_pence, a.unit_pence, 0
  from accounts a
 where not exists (select 1 from balances b where b.account_id = a.id);

-- Two balances with the same name on one account are indistinguishable in the
-- switcher, in the entry form and on the balance sheet, so the name is the
-- thing to make unique. It is also what makes the seed above safe against two
-- writes arriving at the same instant: the second insert conflicts and does
-- nothing rather than leaving an account with two balances called Main.
--
-- Guarded, because a unique index that cannot be built fails the whole file
-- and this file has to be safe to re-run. An account that somehow has two
-- balances of one name keeps them and gets no index; nothing else changes.
do $$
begin
  if not exists (
    select 1 from balances group by account_id, lower(name) having count(*) > 1
  ) then
    create unique index if not exists balances_name_idx on balances (account_id, lower(name));
  end if;
end $$;
