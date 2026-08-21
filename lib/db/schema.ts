/* The schema, as specified.
 *
 * THE ONE DECISION THAT MATTERS. A bet is a container with a settlement
 * ledger, not a row with a result. The old app stored one result per bet and
 * therefore could not represent a second partial cash out, exchange
 * commission, a Rule 4 deduction or a promo refund that lands a week later.
 * All four are the same shape: something happened to a bet after it was
 * placed. So they are all rows in `settlement_events`, which is append only,
 * and `bet_state` is recomputed from them inside the same transaction as
 * every write.
 *
 * `bet_state` is derived, materialised, and never authoritative. Every figure
 * in the product reads it. Nothing reads `settlement_events` for display.
 */
import {
  pgTable, uuid, text, integer, smallint, boolean, timestamp, date,
  numeric, jsonb, bigint, primaryKey, uniqueIndex, index, char,
} from 'drizzle-orm/pg-core';

/* ---------------- accounts ---------------- */

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  handle: text('handle'),
  unitPence: integer('unit_pence'),
  currency: char('currency', { length: 3 }).default('GBP').notNull(),
  weekStart: smallint('week_start').default(1).notNull(),
  oddsFormat: text('odds_format').default('decimal').notNull(),
  showProfitIn: text('show_profit_in').default('currency').notNull(),
  calendarDates: boolean('calendar_dates').default(true).notNull(),
  theme: text('theme').default('carbon').notNull(),
  bankrollStartPence: integer('bankroll_start_pence'),
  linkCode: text('link_code'),
  linkCodeExpiresAt: timestamp('link_code_expires_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialSlipsAllowed: integer('trial_slips_allowed'),
  trialSlipsUsed: integer('trial_slips_used').default(0).notNull(),
  plan: text('plan'),
  planState: text('plan_state'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  paymentFailures: integer('payment_failures').default(0).notNull(),
  ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true }),
  referredBy: uuid('referred_by'),
  targetPence: integer('target_pence'),
  cardOrder: jsonb('card_order'),
  cardsAbove: jsonb('cards_above'),
  isTester: boolean('is_tester').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('accounts_email_key').on(t.email),
  uniqueIndex('accounts_handle_key').on(t.handle),
  uniqueIndex('accounts_link_code_key').on(t.linkCode),
]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('sessions_account_idx').on(t.accountId)]);

/* Nothing is written to `accounts` until an address is proved. A signup that
   is abandoned at the code screen must not burn the address. */
export const pendingSignups = pgTable('pending_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  codeHash: text('code_hash').notNull(),
  promoCode: text('promo_code'),
  attempts: integer('attempts').default(0).notNull(),
  ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('pending_signups_email_key').on(t.email)]);

/* ---------------- reference data ---------------- */

export const bookmakers = pgTable('bookmakers', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  groupName: text('group_name'),
  commissionPct: numeric('commission_pct', { precision: 5, scale: 2 }),
  /* bet365 grades Asian handicaps, where a whole line pushes. Everyone else
     grades European, where the handicap draw is its own outcome, so -1 acts
     like -1.5 and that scoreline loses. A lookup, never a hardcode. */
  handicapStyle: text('handicap_style').default('european').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  isCustom: boolean('is_custom').default(false).notNull(),
}, (t) => [index('bookmakers_account_idx').on(t.accountId)]);

export const tipsters = pgTable('tipsters', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  unitPenceOverride: integer('unit_pence_override'),
  channelRef: text('channel_ref'),
  hidden: boolean('hidden').default(false).notNull(),
  isBotDefault: boolean('is_bot_default').default(false).notNull(),
}, (t) => [index('tipsters_account_idx').on(t.accountId)]);

export const sports = pgTable('sports', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const marketGroups = pgTable('market_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  canonicalName: text('canonical_name').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
});

export const marketAliases = pgTable('market_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketGroupId: uuid('market_group_id').notNull().references(() => marketGroups.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
});

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

/* ---------------- bets ---------------- */

export const bets = pgTable('bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  /* single | multi_same_fixture | multi_cross_fixture | each_way | system */
  shape: text('shape').notNull().default('single'),
  side: text('side').notNull().default('back'),          // back | lay
  stakePence: integer('stake_pence').notNull(),
  liabilityPence: integer('liability_pence'),            // lay only
  odds: numeric('odds', { precision: 10, scale: 3 }),
  currency: char('currency', { length: 3 }).default('GBP').notNull(),
  fxRate: numeric('fx_rate', { precision: 12, scale: 6 }),
  bookmakerId: uuid('bookmaker_id').references(() => bookmakers.id),
  tipsterId: uuid('tipster_id').references(() => tipsters.id),
  sportId: uuid('sport_id').references(() => sports.id),
  competition: text('competition'),
  course: text('course'),
  eventName: text('event_name'),
  selection: text('selection'),
  marketRaw: text('market_raw'),
  marketGroupId: uuid('market_group_id').references(() => marketGroups.id),
  /* CANONICAL for every period total. `placed_at` is stored and filterable
     and is never used for period maths, or a Friday-night bet on a Saturday
     fixture lands in the wrong week. */
  eventAt: timestamp('event_at', { withTimezone: true }).notNull(),
  placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
  expectedSettleAt: timestamp('expected_settle_at', { withTimezone: true }),
  isFreeBet: boolean('is_free_bet').default(false).notNull(),
  isEachWay: boolean('is_each_way').default(false).notNull(),
  ewPlaceFraction: text('ew_place_fraction'),
  rule4Deduction: numeric('rule4_deduction', { precision: 5, scale: 2 }),
  isAntepost: boolean('is_antepost').default(false).notNull(),
  slipBacked: boolean('slip_backed').default(false).notNull(),
  source: text('source'),   // telegram|web_upload|manual|csv_import|shot_import
  arbGroupId: uuid('arb_group_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('bets_account_event_idx').on(t.accountId, t.eventAt),
  index('bets_arb_idx').on(t.arbGroupId),
]);

export const betLegs = pgTable('bet_legs', {
  id: uuid('id').primaryKey().defaultRandom(),
  betId: uuid('bet_id').notNull().references(() => bets.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  selection: text('selection'),
  marketRaw: text('market_raw'),
  marketGroupId: uuid('market_group_id').references(() => marketGroups.id),
  fixtureId: uuid('fixture_id'),
  eventName: text('event_name'),
  legOdds: numeric('leg_odds', { precision: 10, scale: 3 }),
  legResult: text('leg_result'),
}, (t) => [uniqueIndex('bet_legs_seq_key').on(t.betId, t.seq)]);

export const betTags = pgTable('bet_tags', {
  betId: uuid('bet_id').notNull().references(() => bets.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.betId, t.tagId] })]);

/* APPEND ONLY. Nothing updates or deletes a row here; a mistake is corrected
   by a `manual_correction` event, which is why the change history can be
   shown at all. */
export const settlementEvents = pgTable('settlement_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  betId: uuid('bet_id').notNull().references(() => bets.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  type: text('type').notNull(),
  fractionEighths: smallint('fraction_eighths'),   // 1..8, cash_out_partial only
  stakePortionPence: integer('stake_portion_pence'),
  odds: numeric('odds', { precision: 10, scale: 3 }),
  returnedPence: integer('returned_pence'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  enteredBy: text('entered_by'),
  afterResultKnown: boolean('after_result_known').default(false).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('settlement_events_seq_key').on(t.betId, t.seq)]);

export const betState = pgTable('bet_state', {
  betId: uuid('bet_id').primaryKey().references(() => bets.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),                // open | part_settled | settled
  remainingStakePence: integer('remaining_stake_pence').notNull(),
  realisedPlPence: integer('realised_pl_pence').notNull(),
  returnedPence: integer('returned_pence').notNull(),
  units: numeric('units', { precision: 10, scale: 2 }),
  voidedStakePence: integer('voided_stake_pence').default(0).notNull(),
  countsInStats: boolean('counts_in_stats').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/* Figures with no slip behind them: a month's total typed in from another
   tracker. They move net, turnover and the calendar, and they are excluded
   from win rate, streaks, average odds and best or worst day, because there
   is no bet there to win or lose. */
export const plEntries = pgTable('pl_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  amountPence: integer('amount_pence').notNull(),
  stakePence: integer('stake_pence'),
  bookmakerId: uuid('bookmaker_id').references(() => bookmakers.id),
  note: text('note'),
  source: text('source'),
}, (t) => [index('pl_entries_account_date_idx').on(t.accountId, t.entryDate)]);

/* ---------------- social ---------------- */

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  pictureUrl: text('picture_url'),
  joinMode: text('join_mode').default('open').notNull(),
  rankingPeriod: text('ranking_period').default('M').notNull(),
  slipBackedOnly: boolean('slip_backed_only').default(false).notNull(),
  showEditAudit: boolean('show_edit_audit').default(false).notNull(),
  inviteCode: text('invite_code'),
  adminAccountId: uuid('admin_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex('groups_invite_code_key').on(t.inviteCode)]);

export const groupMembers = pgTable('group_members', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.accountId] })]);

export const follows = pgTable('follows', {
  followerId: uuid('follower_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  followeeId: uuid('followee_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followeeId] })]);

/* ---------------- slips, bot, audit ---------------- */

export const slipImages = pgTable('slip_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  betId: uuid('bet_id').references(() => bets.id, { onDelete: 'set null' }),
  storageKey: text('storage_key'),
  sha256: text('sha256').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  /* The privacy policy commits to ninety days. A column, so the sweep has
     something to read rather than a constant buried in a cron. */
  deleteAfter: timestamp('delete_after', { withTimezone: true }).notNull(),
}, (t) => [index('slip_images_sha_idx').on(t.accountId, t.sha256)]);

export const telegramLinks = pgTable('telegram_links', {
  telegramUserId: bigint('telegram_user_id', { mode: 'bigint' }).primaryKey(),
  chatId: bigint('chat_id', { mode: 'bigint' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  telegramUsername: text('telegram_username'),
  dormant: boolean('dormant').default(false).notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('telegram_links_account_idx').on(t.accountId)]);

/* Telegram retries anything that is not a 200, so a slow read would create
   duplicate bets without this. */
export const telegramUpdates = pgTable('telegram_updates', {
  updateId: bigint('update_id', { mode: 'bigint' }).primaryKey(),
  seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
});

/* callback_data is 64 bytes, so the state lives here and the button carries
   only this row's short id. */
export const pendingReads = pgTable('pending_reads', {
  id: text('id').primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  chatId: bigint('chat_id', { mode: 'bigint' }),
  messageId: integer('message_id'),
  payload: jsonb('payload').notNull(),
  confirmedBetId: uuid('confirmed_bet_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  source: text('source'),
  afterResultKnown: boolean('after_result_known').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('audit_log_entity_idx').on(t.entity, t.entityId)]);

export const referenceSlips = pgTable('reference_slips', {
  id: uuid('id').primaryKey().defaultRandom(),
  imageKey: text('image_key').notNull(),
  bookmaker: text('bookmaker'),
  expected: jsonb('expected').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').default(0).notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),
});
