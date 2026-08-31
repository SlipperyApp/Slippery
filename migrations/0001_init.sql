-- Slippery, initial schema.
--
-- Applied forward only, from checked in files. No DDL ever runs from inside a
-- request handler: the old app did that, so no deployment could say what its
-- database looked like.
--
-- The shape that matters: a bet is a container with a settlement ledger, not
-- a row with a result. settlement_events is append only and bet_state is a
-- fold over it, recomputed by exactly one function inside the same
-- transaction as every write.

create extension if not exists citext;

-- ---------------------------------------------------------------- accounts

create table if not exists accounts (
  id                  uuid primary key default gen_random_uuid(),
  email               citext unique not null,
  password_hash       text,
  google_sub          text unique,
  display_name        text not null default '',
  handle              citext unique,
  unit_pence          integer not null default 2500 check (unit_pence >= 10),
  currency            char(3) not null default 'GBP' check (currency in ('GBP', 'EUR')),
  week_start          smallint not null default 1 check (week_start in (0, 1)),
  odds_format         text not null default 'decimal' check (odds_format in ('decimal', 'fractional', 'american')),
  show_profit_in      text not null default 'currency' check (show_profit_in in ('currency', 'units', 'both')),
  calendar_dates      boolean not null default true,
  theme               text not null default 'carbon',
  bankroll_start_pence integer not null default 0,
  link_code           text unique,
  trial_ends_at       timestamptz,
  trial_slips_allowed integer not null default 35,
  trial_slips_used    integer not null default 0,
  plan                text check (plan in ('monthly', 'yearly')),
  plan_state          text not null default 'trial'
                        check (plan_state in ('trial', 'active', 'past_due', 'read_only', 'cancelled')),
  stripe_customer_id  text,
  stripe_subscription_id text,
  failed_payments     smallint not null default 0,
  age_confirmed_at    timestamptz,
  terms_accepted_at   timestamptz,
  break_until         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists verification_codes (
  id          uuid primary key default gen_random_uuid(),
  email       citext not null,
  code_hash   text not null,
  purpose     text not null check (purpose in ('signup', 'reset', 'signin')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists verification_codes_email_idx on verification_codes (email, purpose, created_at desc);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  token_hash  text unique not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists sessions_account_idx on sessions (account_id);

-- ------------------------------------------------------------- reference

create table if not exists bookmakers (
  id             text not null,
  account_id     uuid not null references accounts(id) on delete cascade,
  name           text not null,
  group_name     text,
  commission_pct numeric(6,3) not null default 0,
  enabled        boolean not null default true,
  is_custom      boolean not null default false,
  -- The handicap convention is a LOOKUP, never a hardcode at a call site.
  handicap_style text not null default 'european' check (handicap_style in ('asian', 'european')),
  primary key (account_id, id)
);

create table if not exists tipsters (
  id                 text not null,
  account_id         uuid not null references accounts(id) on delete cascade,
  name               text not null,
  unit_pence_override integer,
  channel_ref        text,
  hidden             boolean not null default false,
  is_bot_default     boolean not null default false,
  primary key (account_id, id)
);

create table if not exists sports (
  id         text not null,
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  primary key (account_id, id)
);

create table if not exists market_groups (
  id             text not null,
  account_id     uuid not null references accounts(id) on delete cascade,
  canonical_name text not null,
  is_default     boolean not null default false,
  enabled        boolean not null default true,
  primary key (account_id, id)
);

create table if not exists market_aliases (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  market_group_id text not null,
  alias           text not null,
  unique (account_id, alias)
);

create table if not exists tags (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  unique (account_id, name)
);

-- ------------------------------------------------------------------ bets

create table if not exists bets (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id) on delete cascade,
  shape             text not null default 'single'
                      check (shape in ('single','multi_same_fixture','multi_cross_fixture','each_way','system')),
  side              text not null default 'back' check (side in ('back','lay')),
  stake_pence       integer not null check (stake_pence >= 0),
  liability_pence   integer,
  odds              numeric(12,4) not null,
  currency          char(3) not null default 'GBP' check (currency in ('GBP','EUR')),
  fx_rate           numeric(12,6),
  bookmaker_id      text not null,
  tipster_id        text,
  sport_id          text not null,
  competition       text,
  course            text,
  event_name        text not null default '',
  selection         text not null default '',
  market_raw        text not null default '',
  market_group_id   text,
  -- event_at is CANONICAL for every period total. placed_at is stored and
  -- filterable but is never used for period maths.
  event_at          timestamptz not null,
  placed_at         timestamptz not null,
  expected_settle_at timestamptz,
  is_free_bet       boolean not null default false,
  is_bonus_funds    boolean not null default false,
  is_boosted        boolean not null default false,
  is_each_way       boolean not null default false,
  ew_place_fraction numeric(6,4),
  ew_part           text check (ew_part in ('win','place')),
  ew_group_id       uuid,
  slip_backed       boolean not null default false,
  source            text not null default 'manual'
                      check (source in ('telegram','web_upload','manual','csv_import','shot_import')),
  arb_group_id      uuid,
  note              text,
  -- The unit is frozen at placement, so history never rewrites itself when
  -- the account's unit changes.
  unit_pence_at_placement integer not null,
  commission_pct    numeric(6,3) not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists bets_account_event_idx on bets (account_id, event_at desc);
create index if not exists bets_account_placed_idx on bets (account_id, placed_at desc);
create index if not exists bets_ew_group_idx on bets (ew_group_id) where ew_group_id is not null;

create table if not exists bet_legs (
  id         uuid primary key default gen_random_uuid(),
  bet_id     uuid not null references bets(id) on delete cascade,
  seq        smallint not null,
  selection  text not null default '',
  market_raw text not null default '',
  fixture_id text,
  event_name text not null default '',
  leg_odds   numeric(12,4) not null,
  leg_result text not null default 'open'
               check (leg_result in ('open','won','lost','void','half_won','half_lost','ask')),
  event_at   timestamptz not null,
  unique (bet_id, seq)
);

-- APPEND ONLY. Nothing updates or deletes a row here; a correction is a new
-- event, which is what makes the change history real.
create table if not exists settlement_events (
  id                 uuid primary key default gen_random_uuid(),
  bet_id             uuid not null references bets(id) on delete cascade,
  seq                integer not null,
  type               text not null check (type in (
                       'won','lost','void','placed','push','half_won','half_lost',
                       'cash_out_partial','cash_out_full',
                       'rule4','commission','promo_refund','manual_correction')),
  fraction_eighths   smallint check (fraction_eighths between 1 and 8),
  returned_pence     integer,
  deduction_pence    integer,
  commission_pct     numeric(6,3),
  occurred_at        timestamptz not null default now(),
  entered_by         text not null default 'system',
  after_result_known boolean not null default false,
  note               text,
  created_at         timestamptz not null default now(),
  unique (bet_id, seq)
);
create index if not exists settlement_events_bet_idx on settlement_events (bet_id, seq);

-- A fold over settlement_events, written by exactly one function, inside the
-- same transaction as every event that is appended.
create table if not exists bet_state (
  bet_id                 uuid primary key references bets(id) on delete cascade,
  status                 text not null check (status in ('open','part_settled','settled')),
  remaining_stake_pence  integer not null,
  realised_pl_pence      integer not null,
  returned_pence         integer not null,
  voided_stake_pence     integer not null default 0,
  units                  numeric(14,4) not null default 0,
  outcome                text check (outcome in ('won','lost','cash-profit','cash-loss','cash-flat','void')),
  updated_at             timestamptz not null default now()
);
create index if not exists bet_state_status_idx on bet_state (status);

create table if not exists bet_tags (
  bet_id uuid not null references bets(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (bet_id, tag_id)
);

-- Adjustments that are not bets: a bonus, a shop win nobody has a slip for.
-- They count to net, turnover and the calendar but NEVER to win rate,
-- streaks or best and worst day.
create table if not exists pl_entries (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  entry_date   date not null,
  amount_pence integer not null,
  stake_pence  integer not null default 0,
  bookmaker_id text,
  note         text,
  source       text not null default 'manual',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- social

create table if not exists groups (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  picture_url       text,
  join_mode         text not null default 'code' check (join_mode in ('open','code','approval')),
  ranking_period    text not null default 'month' check (ranking_period in ('month','year','all')),
  slip_backed_only  boolean not null default false,
  show_edit_audit   boolean not null default true,
  invite_code       text unique not null,
  admin_account_id  uuid not null references accounts(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create table if not exists group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, account_id)
);

create table if not exists follows (
  follower_id uuid not null references accounts(id) on delete cascade,
  followee_id uuid not null references accounts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ----------------------------------------------------------------- slips

create table if not exists slip_images (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  bet_id       uuid references bets(id) on delete set null,
  storage_key  text not null,
  sha256       text not null,
  bytes        integer,
  uploaded_at  timestamptz not null default now(),
  -- Deleted after 90 days, or immediately on request. The bet stays.
  delete_after timestamptz not null default (now() + interval '90 days'),
  deleted_at   timestamptz
);
create index if not exists slip_images_delete_idx on slip_images (delete_after) where deleted_at is null;
create index if not exists slip_images_sha_idx on slip_images (account_id, sha256);

create table if not exists pending_reads (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid references accounts(id) on delete cascade,
  chat_id     bigint,
  payload     jsonb not null,
  confirmed_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '2 hours'),
  created_at  timestamptz not null default now()
);

create table if not exists reference_slips (
  id          uuid primary key default gen_random_uuid(),
  image_key   text not null,
  bookmaker   text,
  expected    jsonb not null,
  added_at    timestamptz not null default now()
);

-- -------------------------------------------------------------- telegram

create table if not exists telegram_links (
  telegram_user_id  bigint primary key,
  chat_id           bigint not null,
  account_id        uuid not null references accounts(id) on delete cascade,
  telegram_username text,
  dormant           boolean not null default false,
  linked_at         timestamptz not null default now()
);

-- The idempotency guard. Telegram retries any non-200 and a slow read
-- otherwise creates duplicate bets.
create table if not exists telegram_updates (
  update_id bigint primary key,
  seen_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------- audit

create table if not exists audit_log (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid references accounts(id) on delete set null,
  entity             text not null,
  entity_id          text,
  action             text not null,
  before             jsonb,
  after              jsonb,
  source             text,
  after_result_known boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists audit_log_account_idx on audit_log (account_id, created_at desc);

create table if not exists waiting_list (
  email      citext primary key,
  platform   text not null default 'both' check (platform in ('ios','android','both')),
  created_at timestamptz not null default now()
);
