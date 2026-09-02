-- Balances: a named container with its own money in it.
--
-- An account had one ledger, so a matched betting float, a football bank and
-- a horses bank were one pile of numbers, and every figure the product
-- printed was an average over three different activities. A 40% return on
-- twelve qualifying losses and a minus 8% on two hundred football singles
-- come out as one number that describes neither of them. Somebody who keeps
-- their money apart has to be able to keep their record apart.
--
-- A BALANCE HAS ONE CURRENCY, FOR ITS WHOLE LIFE. That is what makes "pounds
-- and euros are never summed" a shape rather than a convention: a selection
-- inside a balance has one currency by construction, and the only surface
-- that reads more than one balance keys its totals BY currency. Changing a
-- balance's currency would rewrite the meaning of every figure already in it,
-- so the product makes a second balance instead and this column is never
-- updated.
--
-- FORWARD ONLY, AND NOTHING IS ORPHANED. Every existing account gets one
-- balance carrying the currency, the unit and the starting figure it already
-- had, and every existing bet and movement is moved into it in the same
-- transaction. After this file, `balance_id` is not null on both tables, so a
-- row that belongs to no balance cannot be written.
--
-- accounts.balance_start_pence, accounts.currency and accounts.unit_pence stay
-- where they are. They are what the default balance is seeded FROM and what
-- an account's first balance is created with; nothing reads them for a figure
-- once a balance exists. Dropping them would break a deployment mid rollout,
-- which is the one thing a forward only migration must not do.

create table if not exists balances (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  name          text not null,
  currency      char(3) not null default 'GBP' check (currency in ('GBP', 'EUR')),
  start_pence   integer not null default 0,
  unit_pence    integer not null default 2500 check (unit_pence >= 10),
  -- The unguessable half of a public link, or null when the balance is not
  -- shared. Revoking is setting this to null and the link stops working on
  -- the next request: there is no second flag that could disagree with it.
  share_token   text unique,
  archived      boolean not null default false,
  sort          smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists balances_account_idx on balances (account_id, sort);

-- One balance per account that has none, carrying what the account already
-- had. Guarded on the account having no balances rather than on this file
-- never having run, so a re-run cannot make a second "Main".
insert into balances (account_id, name, currency, start_pence, unit_pence, sort)
select a.id, 'Main', a.currency, a.balance_start_pence, a.unit_pence, 0
  from accounts a
 where not exists (select 1 from balances b where b.account_id = a.id);

alter table bets add column if not exists balance_id uuid references balances(id);
alter table money_movements add column if not exists balance_id uuid references balances(id);

-- Nothing is orphaned. Every bet and every movement joins its account's first
-- balance, which is the one created above for every account that had none.
update bets b
   set balance_id = (
     select x.id from balances x
      where x.account_id = b.account_id
      order by x.sort, x.created_at
      limit 1)
 where b.balance_id is null;

update money_movements m
   set balance_id = (
     select x.id from balances x
      where x.account_id = m.account_id
      order by x.sort, x.created_at
      limit 1)
 where m.balance_id is null;

-- And from here on it is required. An account with no bets and no balances
-- would leave the update above with nothing to set, so the constraint is
-- added only when every row has one: a not null that cannot be satisfied
-- fails the whole file, and this file has to be safe to re-run.
do $$
begin
  if not exists (select 1 from bets where balance_id is null) then
    alter table bets alter column balance_id set not null;
  end if;
  if not exists (select 1 from money_movements where balance_id is null) then
    alter table money_movements alter column balance_id set not null;
  end if;
end $$;

create index if not exists bets_balance_idx on bets (balance_id, event_at desc);
create index if not exists money_movements_balance_idx on money_movements (balance_id, occurred_at desc);
