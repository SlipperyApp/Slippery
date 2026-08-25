import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { sanitise } from '@/lib/notifications';
import { ok, fail, unauthorised, noDatabase, readJson, publicUser } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* SETTINGS THAT DO SOMETHING.
 *
 * Every one of these changes what the product shows. Nothing here is an
 * inert row: odds format converts every displayed price, show-profit-in
 * switches every value, week start reorders the calendar and recomputes the
 * weekly totals, the unit changes every unit figure while logged bets keep
 * the unit they were logged with, and the overview order is persisted per
 * account so it survives a new device.
 */
/* The eight the prototype ships, darkest to lightest. Tide, Light and Linen
   are gone; Carbon, Cinnabar and Liquid replace them, and Carbon is the
   default. */
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid'];

export async function PATCH(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<Record<string, unknown>>(req);
  const set: Record<string, unknown> = {};
  let unitChangedTo: number | null = null;

  if ('displayName' in body) set.displayName = String(body.displayName || '').slice(0, 60) || null;
  if ('handle' in body) {
    const handle = String(body.handle || '').replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) return fail(400, 'A handle is 3 to 24 letters, numbers or underscores.');
    set.handle = handle;
  }
  if ('theme' in body) {
    if (!THEMES.includes(String(body.theme))) return fail(400, 'That is not one of the themes.');
    set.theme = body.theme;
  }
  if ('oddsFormat' in body) {
    if (!['decimal', 'fractional', 'american'].includes(String(body.oddsFormat))) return fail(400, 'Odds are decimal, fractional or American.');
    set.oddsFormat = body.oddsFormat;
  }
  if ('showProfitIn' in body) {
    if (!['currency', 'units', 'both'].includes(String(body.showProfitIn))) return fail(400, 'Profit shows in currency, units or both.');
    set.showProfitIn = body.showProfitIn;
  }
  if ('weekStart' in body) set.weekStart = Number(body.weekStart) === 0 ? 0 : 1;
  if ('calendarDates' in body) set.calendarDates = Boolean(body.calendarDates);
  if ('currency' in body) {
    if (!['GBP', 'EUR'].includes(String(body.currency))) return fail(400, 'Pounds or euros.');
    set.currency = body.currency;
  }
  if ('unitPence' in body) {
    const unit = Math.round(Number(body.unitPence));
    if (!Number.isFinite(unit) || unit <= 0) return fail(400, 'A unit is your standard stake, and it has to be more than nothing.');
    /* Changing the unit changes every unit figure FROM NOW ON. Bets already
       logged keep the unit they were logged with — which is true again as of
       this pass: `bets.unit_at_placement_pence` was being written and then
       ignored by the settlement fold, so a recompute quietly rewrote the past
       at today's unit. The fold now reads the bet's own value. */
    set.unitPence = unit;
    unitChangedTo = unit;
  }
  if ('targetPence' in body) set.targetPence = body.targetPence == null ? null : Math.round(Number(body.targetPence));
  if ('bankrollStartPence' in body) set.bankrollStartPence = body.bankrollStartPence == null ? null : Math.round(Number(body.bankrollStartPence));
  if ('notificationPrefs' in body) set.notificationPrefs = sanitise(body.notificationPrefs);
  if ('cardOrder' in body) set.cardOrder = body.cardOrder;
  if ('cardsAbove' in body) set.cardsAbove = body.cardsAbove;

  if (!Object.keys(set).length) return fail(400, 'Nothing to change.');

  const db = getDb();
  const [updated] = await db.update(schema.accounts).set(set)
    .where(eq(schema.accounts.id, account.id)).returning();

  /* 58 · RECORD THE UNIT CHANGE, not just the new value. `unit_history` is
     what lets an imported bet take the unit that was in force on its own date
     rather than today's — without a row here, an import that predates a
     change is silently scaled wrong and the dry run cannot say so. */
  if (unitChangedTo != null) {
    await db.insert(schema.unitHistory).values({
      accountId: account.id,
      unitPence: unitChangedTo,
      effectiveFrom: new Date(),
    });
  }

  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'account', entityId: account.id,
    action: 'settings', before: null, after: set, source: 'user',
  });

  return ok({ user: publicUser(updated) });
}
