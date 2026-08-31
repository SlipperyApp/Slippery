import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'follow', 60, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const handle = str(body.handle).toLowerCase();
  const following = body.following === true;
  if (!handle) return fail(400, 'bad_handle', 'No handle was sent, so nothing changed.');

  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so nothing was saved.');
  const me = await currentAccount();
  if (!me) return fail(401, 'no_session', 'You are looking at the example account, so nothing was saved.');

  const rows = await query<{ id: string }>('select id from accounts where handle = $1', [handle]);
  if (!rows.length) return fail(404, 'no_slipper', 'No Slipper with that handle.');

  if (following) {
    await query(
      'insert into follows (follower_id, followee_id) values ($1, $2) on conflict do nothing',
      [me.id, rows[0].id],
    );
  } else {
    await query('delete from follows where follower_id = $1 and followee_id = $2', [me.id, rows[0].id]);
  }
  return ok({ following });
}
