-- Every slip read, what it cost, and whether its credit has been returned.
--
-- TWO THINGS WERE WRONG AND THEY ARE THE SAME THING.
--
-- trial_slips_used was written in exactly one place in the whole repository
-- and that place DECREMENTED it. Nothing incremented it, so trialState()
-- computed "35 more slips" for ever, the slips half of the trial could never
-- run out, and every surface printing "14 days left, or 35 more slips,
-- whichever runs out first" was quoting a counter that never moved.
--
-- POST /api/reads/flag returned a slip to the allowance and checked nothing:
-- not that the read existed, not that it belonged to the account, and not
-- that it had already been refunded. The same read id could be flagged twenty
-- times in fifteen minutes, each press crediting another slip, which is an
-- unbounded free allowance behind a button on the most trust-critical screen
-- in the product.
--
-- Both fall out of there being no record of a read. A read is now a row: the
-- account it belongs to, what it cost, and one nullable refunded_at that can
-- only be set once. The flag route binds to it, so a credit is returned once
-- per read rather than once per press, and refunding is idempotent by
-- construction rather than by a rate limit.
--
-- The token counts are here because there was no cost telemetry anywhere in
-- the repository, against a pricing page that promises unlimited slips. A
-- vision read is the one call that costs money per use and nobody could say
-- what a heavy account costs.
create table if not exists slip_reads (
  -- The id handed to the browser, which is the first 16 hex of the image
  -- hash. Scoped to the account, so two accounts sending the same screenshot
  -- keep two rows and neither can address the other's.
  read_id      text not null,
  account_id   uuid not null references accounts(id) on delete cascade,
  sha256       text not null,
  -- Which bookmaker the signature table settled on, or 'unknown'. This is the
  -- column that answers "which layout stopped reading this week".
  bookmaker_id text,
  -- False for a read that was charged for and produced nothing usable. A
  -- failed read costs money and must not cost the account a slip.
  ok           boolean not null default true,
  model        text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  flagged_at   timestamptz,
  -- Set exactly once. The flag route refuses a second refund by looking here
  -- rather than by trusting that nobody presses twice.
  refunded_at  timestamptz,
  created_at   timestamptz not null default now(),
  primary key (account_id, read_id)
);

create index if not exists slip_reads_account_idx on slip_reads (account_id, created_at desc);
