import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { isInviteCode } from '@/lib/server/codes';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

/** Joining by code, and leaving.
 *
 *  THE THREE JOIN MODES ARE THREE DIFFERENT ANSWERS and the route says which
 *  one happened, because "Joined" and "Asked to join" are not the same event
 *  and a screen that prints the first when the second happened has lied about
 *  where somebody now is. An open group and a code group both admit you; an
 *  approval group records nothing and reports that the request is with its
 *  admin.
 *
 *  LEAVING TAKES NOTHING WITH IT. Units are folded from your own ledger, so
 *  they were never the group's to keep or to delete: leaving removes a row
 *  from group_members and that is the whole of it. */

export async function POST(req: Request) {
  const limited = limitOr429(req, 'membership', 30, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const action = str(body.action);
  if (action !== 'join' && action !== 'leave') {
    return fail(400, 'bad_action', 'A membership request is a join or a leave.');
  }

  const code = str(body.code).toUpperCase().replace(/[\s-]+/g, '');
  const groupId = str(body.groupId);
  if (action === 'join' && !isInviteCode(code)) {
    return fail(400, 'bad_code', 'An invite code is six characters, and this one is not.');
  }
  if (action === 'leave' && !groupId) {
    return fail(400, 'bad_group', 'No group was named, so nothing changed.');
  }

  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so nothing was saved.');
  const me = await currentAccount();
  if (!me) return fail(401, 'no_session', 'You are looking at the example account, so nothing was saved.');

  if (action === 'leave') {
    /*  An admin cannot leave their own group and take it with them. Handing
        it over first is the only order that leaves the group with somebody
        answering for it. */
    const admin = await query<{ id: string }>(
      'select id from groups where id = $1 and admin_account_id = $2',
      [groupId, me.id],
    );
    if (admin.length) {
      return fail(409, 'admin_last_out', 'You are the admin of this group. Hand that over before you leave it.');
    }
    await query('delete from group_members where group_id = $1 and account_id = $2', [groupId, me.id]);
    return ok({ left: groupId });
  }

  const rows = await query<{ id: string; name: string; join_mode: string }>(
    'select id, name, join_mode from groups where invite_code = $1',
    [code],
  );
  if (!rows.length) return fail(404, 'no_group', 'No group has that code.');
  const g = rows[0];

  if (g.join_mode === 'approval') {
    return ok({ state: 'requested', id: g.id, name: g.name, joinMode: g.join_mode });
  }
  await query(
    'insert into group_members (group_id, account_id) values ($1, $2) on conflict do nothing',
    [g.id, me.id],
  );
  return ok({ state: 'joined', id: g.id, name: g.name, joinMode: g.join_mode });
}
