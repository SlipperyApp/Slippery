import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* THE LISTS AN ACCOUNT CAN EDIT.
 *
 * Bookmakers, tipsters, sports, tags and market groups are five tables with
 * one shape: a name, an owner, and a handful of settings. Five near-identical
 * route files would drift apart within a month, and each one is a serverless
 * function. One route with a `kind` keeps the validation in a single place.
 */
const KINDS = {
  bookmakers: {
    table: schema.bookmakers,
    fields: (b: any) => ({
      name: String(b.name || '').slice(0, 60),
      groupName: b.groupName ? String(b.groupName).slice(0, 40) : null,
      commissionPct: b.commissionPct != null ? String(Number(b.commissionPct)) : null,
      enabled: b.enabled !== false,
      isCustom: true,
    }),
  },
  tipsters: {
    table: schema.tipsters,
    fields: (b: any) => ({
      name: String(b.name || '').slice(0, 60),
      unitPenceOverride: b.unitPenceOverride != null ? Math.round(Number(b.unitPenceOverride)) : null,
      channelRef: b.channelRef ? String(b.channelRef).slice(0, 80) : null,
      hidden: Boolean(b.hidden),
    }),
  },
  sports: { table: schema.sports, fields: (b: any) => ({ name: String(b.name || '').slice(0, 40) }) },
  tags: { table: schema.tags, fields: (b: any) => ({ name: String(b.name || '').slice(0, 40) }) },
  markets: {
    table: schema.marketGroups,
    fields: (b: any) => ({
      canonicalName: String(b.name || b.canonicalName || '').slice(0, 60),
      enabled: b.enabled !== false,
    }),
  },
} as const;

type Kind = keyof typeof KINDS;
const kindOf = (v: string | null): Kind | null => (v && v in KINDS ? (v as Kind) : null);

export async function GET(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const kind = kindOf(new URL(req.url).searchParams.get('kind'));
  if (!kind) return fail(400, 'Which list?');

  const t = KINDS[kind].table as any;
  const rows = await getDb().select().from(t).where(eq(t.accountId, account.id));
  return ok({ kind, rows });
}

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const body = await readJson<any>(req);
  const kind = kindOf(body.kind);
  if (!kind) return fail(400, 'Which list?');

  const spec = KINDS[kind];
  const values = spec.fields(body);
  const name = (values as any).name ?? (values as any).canonicalName;
  if (!name) return fail(400, 'It needs a name.');

  const inserted = (await getDb().insert(spec.table as any)
    .values({ accountId: account.id, ...values } as any).returning()) as any[];
  return ok({ row: inserted[0] });
}

export async function PATCH(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const body = await readJson<any>(req);
  const kind = kindOf(body.kind);
  if (!kind || !body.id) return fail(400, 'Which row?');

  const t = KINDS[kind].table as any;
  const updated = (await getDb().update(t).set(KINDS[kind].fields(body) as any)
    .where(and(eq(t.id, body.id), eq(t.accountId, account.id))).returning()) as any[];
  if (!updated.length) return fail(404, 'No such row.');
  return ok({ row: updated[0] });
}

export async function DELETE(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const url = new URL(req.url);
  const kind = kindOf(url.searchParams.get('kind'));
  const id = url.searchParams.get('id');
  if (!kind || !id) return fail(400, 'Which row?');

  const t = KINDS[kind].table as any;
  const gone = (await getDb().delete(t)
    .where(and(eq(t.id, id), eq(t.accountId, account.id))).returning()) as any[];
  if (!gone.length) return fail(404, 'No such row.');
  return ok({ deleted: id });
}
