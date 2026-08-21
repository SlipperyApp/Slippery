import { NextRequest } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* GROUPS.
 *
 * Members see each other's unit size and that cannot be turned off while
 * they are a member: it is the point of a group. Outside one, only units
 * show and stake amounts never do, which is why nothing here returns a
 * stake to somebody who is not in the group.
 *
 * GROUPS CANNOT BE RENAMED. PATCH accepts every other setting and refuses
 * the name, because a leaderboard people have been compared on for a season
 * changing its name overnight is how a group stops meaning anything.
 */
export async function GET(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const mode = new URL(req.url).searchParams.get('mode') || 'mine';
  const db = getDb();

  if (mode === 'discover') {
    /* Group averages only. An individual figure needs a membership. */
    const rows = await db.execute(sql`
      SELECT g.id, g.name, g.picture_url, g.join_mode, g.ranking_period,
             g.slip_backed_only, count(m.account_id) AS members
      FROM groups g LEFT JOIN group_members m ON m.group_id = g.id
      GROUP BY g.id ORDER BY count(m.account_id) DESC LIMIT 60`);
    return ok({ groups: rows.rows ?? [] });
  }

  const rows = await db.select({ group: schema.groups, joinedAt: schema.groupMembers.joinedAt })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groupMembers.accountId, account.id))
    .orderBy(desc(schema.groupMembers.joinedAt));
  return ok({ groups: rows });
}

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<any>(req);
  const db = getDb();

  if (body.action === 'join') {
    const code = String(body.inviteCode || '').trim().toUpperCase();
    if (!code) return fail(400, 'Which group?');
    const found = await db.select().from(schema.groups)
      .where(eq(schema.groups.inviteCode, code)).limit(1);
    if (!found[0]) return fail(404, 'Not a code I recognise.');
    await db.insert(schema.groupMembers)
      .values({ groupId: found[0].id, accountId: account.id }).onConflictDoNothing();
    return ok({ joined: found[0].name });
  }

  if (body.action === 'leave') {
    if (!body.groupId) return fail(400, 'Which group?');
    await db.delete(schema.groupMembers).where(and(
      eq(schema.groupMembers.groupId, body.groupId),
      eq(schema.groupMembers.accountId, account.id)));
    return ok({ left: body.groupId });
  }

  const name = String(body.name || '').trim().slice(0, 60);
  if (!name) return fail(400, 'A group needs a name, and it cannot be changed later.');

  const created = await db.transaction(async (tx) => {
    const rows = (await tx.insert(schema.groups).values({
      name,
      joinMode: body.joinMode === 'request' ? 'request' : 'open',
      rankingPeriod: ['W', 'M', 'Y', 'All'].includes(body.rankingPeriod) ? body.rankingPeriod : 'M',
      slipBackedOnly: Boolean(body.slipBackedOnly),
      showEditAudit: Boolean(body.showEditAudit),
      inviteCode: randomBytes(4).toString('hex').toUpperCase(),
      adminAccountId: account.id,
    }).returning()) as any[];
    await tx.insert(schema.groupMembers).values({ groupId: rows[0].id, accountId: account.id });
    return rows[0];
  });
  return ok({ group: created });
}

export async function PATCH(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<any>(req);
  if (!body.groupId) return fail(400, 'Which group?');
  /* Stated rather than silently ignored, so somebody trying it finds out
     why rather than wondering whether it saved. */
  if ('name' in body) return fail(400, 'Groups cannot be renamed.');

  const db = getDb();
  const set: Record<string, unknown> = {};
  if ('joinMode' in body) set.joinMode = body.joinMode === 'request' ? 'request' : 'open';
  if ('rankingPeriod' in body && ['W', 'M', 'Y', 'All'].includes(body.rankingPeriod)) set.rankingPeriod = body.rankingPeriod;
  if ('slipBackedOnly' in body) set.slipBackedOnly = Boolean(body.slipBackedOnly);
  if ('showEditAudit' in body) set.showEditAudit = Boolean(body.showEditAudit);
  if ('adminAccountId' in body) set.adminAccountId = body.adminAccountId;
  if (!Object.keys(set).length) return fail(400, 'Nothing to change.');

  const updated = (await db.update(schema.groups).set(set)
    .where(and(eq(schema.groups.id, body.groupId), eq(schema.groups.adminAccountId, account.id)))
    .returning()) as any[];
  if (!updated.length) return fail(403, 'Only the group admin can change that.');
  return ok({ group: updated[0] });
}

export async function DELETE(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail(400, 'Which group?');

  const gone = (await getDb().delete(schema.groups)
    .where(and(eq(schema.groups.id, id), eq(schema.groups.adminAccountId, account.id)))
    .returning({ id: schema.groups.id })) as any[];
  if (!gone.length) return fail(403, 'Only the group admin can delete it.');
  /* Memberships cascade. Nobody's bets are touched: a group is a view onto
     them, never where they live. */
  return ok({ deleted: id });
}
