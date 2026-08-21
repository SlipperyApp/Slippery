import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
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
    /* Changing the unit changes every unit figure from now on. Bets already
       logged keep the unit they were logged with, which is why the figure is
       stored on bet_state rather than computed at read time. */
    set.unitPence = unit;
  }
  if ('targetPence' in body) set.targetPence = body.targetPence == null ? null : Math.round(Number(body.targetPence));
  if ('bankrollStartPence' in body) set.bankrollStartPence = body.bankrollStartPence == null ? null : Math.round(Number(body.bankrollStartPence));
  if ('cardOrder' in body) set.cardOrder = body.cardOrder;
  if ('cardsAbove' in body) set.cardsAbove = body.cardsAbove;

  if (!Object.keys(set).length) return fail(400, 'Nothing to change.');

  const db = getDb();
  const [updated] = await db.update(schema.accounts).set(set)
    .where(eq(schema.accounts.id, account.id)).returning();

  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'account', entityId: account.id,
    action: 'settings', before: null, after: set, source: 'user',
  });

  return ok({ user: publicUser(updated) });
}
