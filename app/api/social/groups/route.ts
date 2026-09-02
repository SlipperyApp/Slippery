import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { generateInviteCode } from '@/lib/server/codes';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

/** Creating a group, and changing the two things its admin is allowed to
 *  change.
 *
 *  THIS ROUTE DID NOT EXIST. `components/app/CreateGroup.tsx` has been
 *  posting to it since it was written, got a 404 every time, and fell back to
 *  its own local code with copy explaining that the group was made on this
 *  device. That fallback is correct for a signed out visitor looking at the
 *  example account, and it was covering for a missing route for everybody
 *  else.
 *
 *  A NEW GROUP IS SLIP BACKED ONLY, and it is not a field on the request.
 *  The create screen states it as a fact rather than offering it as a switch,
 *  and an admin who could turn it off could build a league table out of
 *  typed-in winners, which is the one thing the feature exists to prevent. */

const MODES = new Set(['open', 'code', 'approval']);
const PERIODS = new Set(['month', 'year', 'all']);

export async function POST(req: Request) {
  const limited = limitOr429(req, 'group-create', 10, 3600);
  if (limited) return limited;

  const body = await readJson(req);
  const name = str(body.name);
  const joinMode = str(body.joinMode) || 'code';
  const rankingPeriod = str(body.rankingPeriod) || 'month';

  if (name.length < 3 || name.length > 40) {
    return fail(400, 'bad_name', 'A group name is between three and forty characters.');
  }
  if (!MODES.has(joinMode)) return fail(400, 'bad_join_mode', 'A group is open, by code, or by approval.');
  if (!PERIODS.has(rankingPeriod)) return fail(400, 'bad_period', 'A table covers the month, the year, or all time.');

  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so nothing was saved.');
  const me = await currentAccount();
  if (!me) return fail(401, 'no_session', 'You are looking at the example account, so nothing was saved.');

  /*  A code collides about as often as six characters out of thirty one
      allow, which is rarely and not never. Three attempts, then say so,
      rather than handing back a code that belongs to another group. */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inviteCode = generateInviteCode();
    try {
      const rows = await query<{ id: string }>(
        `insert into groups (name, join_mode, ranking_period, slip_backed_only, show_edit_audit, invite_code, admin_account_id)
         values ($1, $2, $3, true, true, $4, $5)
         returning id`,
        [name, joinMode, rankingPeriod, inviteCode, me.id],
      );
      await query(
        'insert into group_members (group_id, account_id) values ($1, $2) on conflict do nothing',
        [rows[0].id, me.id],
      );
      return ok({ id: rows[0].id, inviteCode, joinMode, rankingPeriod });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== '23505') throw e;
    }
  }
  return fail(503, 'no_code', 'Three invite codes in a row were already taken. Try once more.');
}

/** Join mode and late edit visibility, for the admin of that group. The name
 *  is not here on purpose: it is what members call the group in a chat
 *  Slippery cannot see, and the create screen says before it is typed that it
 *  cannot be changed. */
export async function PATCH(req: Request) {
  const limited = limitOr429(req, 'group-patch', 60, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const id = str(body.id);
  if (!id) return fail(400, 'bad_group', 'No group was named, so nothing changed.');

  const patch: { joinMode?: string; showEditAudit?: boolean } = {};
  if (body.joinMode !== undefined) {
    const m = str(body.joinMode);
    if (!MODES.has(m)) return fail(400, 'bad_join_mode', 'A group is open, by code, or by approval.');
    patch.joinMode = m;
  }
  if (body.showEditAudit !== undefined) patch.showEditAudit = body.showEditAudit === true;
  if (patch.joinMode === undefined && patch.showEditAudit === undefined) {
    return fail(400, 'nothing_to_change', 'Nothing in that request changes anything.');
  }

  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so nothing was saved.');
  const me = await currentAccount();
  if (!me) return fail(401, 'no_session', 'You are looking at the example account, so nothing was saved.');

  const rows = await query<{ id: string }>(
    `update groups
        set join_mode = coalesce($3, join_mode),
            show_edit_audit = coalesce($4, show_edit_audit)
      where id = $1 and admin_account_id = $2
      returning id`,
    [id, me.id, patch.joinMode ?? null, patch.showEditAudit ?? null],
  );
  /*  Not an admin and no such group answer the same way. Telling somebody
      which of the two it was would confirm that a group they cannot see
      exists. */
  if (!rows.length) return fail(404, 'not_admin', 'No group of yours has that id.');
  return ok({ id, ...patch });
}
