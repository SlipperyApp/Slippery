import 'server-only';
import { eq, and, sql } from 'drizzle-orm';
import { schema } from '@/lib/db';
import {
  findPromo, referralHandle,
  TRIAL_DAYS, TRIAL_SLIPS, REFERRED_TRIAL_DAYS, REFERRED_TRIAL_SLIPS,
} from './promo';
import { BOOKMAKERS } from '@/lib/settlement/books.js';
import { MARKET_GROUPS } from './markets';

/* Everything a new account needs before it is usable, done inside the same
   transaction that created it. Half a created account is worse than none. */

type Tx = { insert: Function; update: Function; select: Function; delete: Function; execute?: Function };

export async function startTrial(tx: any, accountId: string, promoInput: string | null) {
  /* 5 days OR 15 slips, whichever runs out first. A valid referral makes it
     14 or 40. The numbers live in one place and the client is told the
     answer rather than counting, so the dashboard cannot disagree with what
     blocks an upload. */
  const referred = Boolean(referralHandle(promoInput) && !findPromo(promoInput));
  const days = referred ? REFERRED_TRIAL_DAYS : TRIAL_DAYS;
  const slips = referred ? REFERRED_TRIAL_SLIPS : TRIAL_SLIPS;
  await tx.update(schema.accounts).set({
    trialEndsAt: new Date(Date.now() + days * 86400000),
    trialSlipsAllowed: slips,
    planState: 'trialing',
  }).where(eq(schema.accounts.id, accountId));
}

export async function applyPromoOnSignup(tx: any, accountId: string, promoInput: string | null) {
  if (!promoInput) return;

  const promo = findPromo(promoInput);
  if (promo) {
    /* A granted plan with `renews: false` lapses to free when it runs out,
       never to a debt: there is no card behind it to charge. */
    await tx.update(schema.accounts).set({
      plan: promo.plan ?? 'monthly',
      planState: 'granted',
      trialEndsAt: new Date(Date.now() + (promo.months ?? 1) * 30 * 86400000),
    }).where(eq(schema.accounts.id, accountId));

    if (promo.group) await joinOrCreateGroup(tx, accountId, promo.group);
    return;
  }

  /* Otherwise it is a referral: the referred person already has the longer
     trial from startTrial, the referrer gets nothing, and the two follow
     each other. */
  const handle = referralHandle(promoInput);
  if (!handle) return;
  const found = await tx.select({ id: schema.accounts.id })
    .from(schema.accounts).where(eq(schema.accounts.handle, handle)).limit(1);
  const referrer = found[0];
  if (!referrer || referrer.id === accountId) return;

  await tx.update(schema.accounts).set({ referredBy: referrer.id })
    .where(eq(schema.accounts.id, accountId));
  await tx.insert(schema.follows)
    .values([
      { followerId: accountId, followeeId: referrer.id },
      { followerId: referrer.id, followeeId: accountId },
    ])
    .onConflictDoNothing();
}

/* The first person through a group code creates the group and administers
   it; everybody after joins the one that exists. */
export async function joinOrCreateGroup(tx: any, accountId: string, name: string) {
  const found = await tx.select({ id: schema.groups.id })
    .from(schema.groups).where(eq(schema.groups.name, name)).limit(1);
  let groupId = found[0]?.id as string | undefined;
  if (!groupId) {
    const [created] = await tx.insert(schema.groups).values({
      name,
      joinMode: 'code',
      inviteCode: name.toUpperCase(),
      adminAccountId: accountId,
    }).returning();
    groupId = created.id;
  }
  await tx.insert(schema.groupMembers)
    .values({ groupId, accountId }).onConflictDoNothing();
  return groupId;
}

/* Seeded per account so somebody can rename, disable or add to them without
   touching anybody else's. */
export async function seedReferenceData(tx: any, accountId: string) {
  await tx.insert(schema.sports).values(
    /* Football, Tennis, Horse racing. Only these three. */
    ['Football', 'Tennis', 'Horse racing'].map((name) => ({ accountId, name })),
  );
  await tx.insert(schema.bookmakers).values(
    BOOKMAKERS.map((b: any) => ({
      accountId,
      name: b.name,
      groupName: b.provider,
      handicapStyle: b.handicap,
      /* The exchanges charge commission on net winnings. A default rather
         than a hardcode: it is editable per bookmaker. */
      commissionPct: b.provider === 'Exchange' ? '2.00' : null,
      enabled: false,
    })),
  );
  for (const group of MARKET_GROUPS) {
    const [row] = await tx.insert(schema.marketGroups)
      .values({ accountId, canonicalName: group.name, isDefault: true })
      .returning();
    if (group.aliases.length) {
      await tx.insert(schema.marketAliases).values(
        group.aliases.map((alias) => ({ marketGroupId: row.id, alias })),
      );
    }
  }
}
