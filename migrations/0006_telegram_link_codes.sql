-- Telegram account linking: one chat bound to one account, and the short
-- lived single use codes that do the binding.
--
-- WHAT WAS THERE. accounts.link_code is one permanent code per account, and
-- the bot bound a chat by looking it up: `select id from accounts where
-- link_code = $1`. Three defects fall out of that one line.
--
--   It never expires and it is never used up, so a code read over a shoulder,
--   or left in a screenshot pasted into a group chat, keeps working for as
--   long as the account exists. A link code is a key to somebody's ledger.
--
--   The upsert was `on conflict (telegram_user_id) do update set account_id =
--   excluded.account_id`, so a chat already linked to one account moved to
--   another with no confirmation of any kind. The bot's own copy says "That
--   code is linked to another chat. Confirm the move in the app first" and
--   nothing anywhere ever asked.
--
--   chat_id carried no constraint at all. Two Telegram users in one group
--   chat could bind that chat to two different ledgers, and which ledger a
--   forwarded slip landed in then depended on who forwarded it.
--
-- accounts.link_code stays where it is. /app/settings/referrals and
-- /app/import/linked both select it, and dropping a column two live routes
-- read is a deployment that 500s on both. It stops being a key to a ledger:
-- nothing redeems it any more.

-- ------------------------------------------------------------ the codes

create table if not exists telegram_link_codes (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  -- The code itself is NEVER stored. This is an HMAC of it under AUTH_SECRET,
  -- so a dump of this table hands nobody a working code, and the plaintext
  -- exists only in the response that issued it.
  code_hash           text not null,
  expires_at          timestamptz not null,
  -- Set by exactly one statement, whose where clause carries the guards. That
  -- is what makes a second redeem of the same code a no-op rather than a race.
  consumed_at         timestamptz,
  consumed_by_chat_id bigint,
  -- Revoked is not consumed. Issuing a new code revokes the account's live
  -- one, and so does unlinking; neither means the code was ever used, and a
  -- support question about a chat that linked itself needs to tell them apart.
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- Not unique, deliberately. The code format is SLIP- plus four characters from
-- a 31 character alphabet, which is 923,521 codes, and a unique index over all
-- history would start rejecting issues long before that. Uniqueness is
-- enforced at issue time over the LIVE codes only, which is the set where a
-- collision could bind the wrong ledger, and `expires_at > now()` cannot
-- appear in an index predicate because now() is not immutable.
create index if not exists telegram_link_codes_hash_idx on telegram_link_codes (code_hash);
create index if not exists telegram_link_codes_account_idx on telegram_link_codes (account_id, created_at desc);

-- ------------------------------------------------------- the guessing guard

-- Four characters over a 31 character alphabet is 923,521 codes, and a chat
-- can send guesses as fast as the bot answers. With even a hundred codes live
-- at once, a stranger guessing at one a second lands on SOMEBODY's live code
-- inside three hours, and that binds their chat to that person's ledger.
--
-- Per chat and in the database rather than in memory, because the bot runs on
-- serverless instances and an in-memory counter resets every cold start, which
-- is the same as no counter at all against anybody patient.
create table if not exists telegram_link_attempts (
  chat_id       bigint primary key,
  wrong_count   integer not null default 0,
  window_start  timestamptz not null default now(),
  blocked_until timestamptz
);

-- ------------------------------------------------------------- the binding

do $$
begin
  if to_regclass('public.telegram_links') is null then
    return;
  end if;

  -- ONE CHAT, AT MOST ONE ACCOUNT. Existing duplicates are collapsed to the
  -- most recent binding first, because a unique index that cannot be built
  -- rolls the whole file back and this migration would then be reported as
  -- applied nowhere.
  delete from telegram_links a
   using telegram_links b
   where a.chat_id = b.chat_id
     and (a.linked_at, a.ctid) < (b.linked_at, b.ctid);

  create unique index if not exists telegram_links_chat_idx on telegram_links (chat_id);
end $$;
