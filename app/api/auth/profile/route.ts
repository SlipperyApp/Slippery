import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { isHandle } from '@/lib/server/codes';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { defaultBookmakers } from '@/lib/data/reference';

export const runtime = 'nodejs';

/** The three middle signup steps all write here. Each call sets only the
 *  fields it carries, so a step can be revisited without clearing the ones
 *  after it. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'profile', 30, 900);
  if (limited) return limited;

  const body = await readJson(req);
  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so nothing was saved.');
  }
  const account = await currentAccount();
  if (!account) return fail(401, 'no_session', 'Sign in first. Nothing was saved.');

  const sets: string[] = [];
  const args: unknown[] = [];
  const push = (frag: string, value: unknown) => { args.push(value); sets.push(`${frag} = $${args.length}`); };

  const displayName = str(body.displayName);
  if (displayName) push('display_name', displayName.slice(0, 60));

  const handle = str(body.handle).toLowerCase();
  if (handle) {
    if (!isHandle(handle)) return fail(400, 'bad_handle', 'A handle is 3 to 20 characters: lowercase letters, numbers and underscores.');
    const taken = await query<{ id: string }>('select id from accounts where handle = $1 and id <> $2', [handle, account.id]);
    if (taken.length) return fail(409, 'handle_taken', 'That handle is taken. Try another.');
    push('handle', handle);
  }

  const unit = Number(body.unitPence);
  if (Number.isFinite(unit) && unit >= 10) push('unit_pence', Math.round(unit));

  const currency = str(body.currency).toUpperCase();
  if (currency === 'GBP' || currency === 'EUR') push('currency', currency);

  if (sets.length) {
    args.push(account.id);
    await query(`update accounts set ${sets.join(', ')}, updated_at = now() where id = $${args.length}`, args);
  }

  // Bookmakers and sports are reference rows, not account columns.
  const books = Array.isArray(body.bookmakers) ? body.bookmakers.filter((b): b is string => typeof b === 'string') : null;
  if (books) {
    const defaults = defaultBookmakers(account.id);
    for (const b of defaults) {
      await query(
        `insert into bookmakers (id, account_id, name, group_name, commission_pct, enabled, is_custom, handicap_style)
         values ($1,$2,$3,$4,$5,$6,false,$7)
         on conflict (account_id, id) do update set enabled = excluded.enabled`,
        [b.id, account.id, b.name, b.groupName, b.commissionPct, books.includes(b.id), b.handicapStyle],
      );
    }
  }

  const customs = Array.isArray(body.customBookmakers) ? body.customBookmakers.filter((b): b is string => typeof b === 'string') : [];
  for (const name of customs.slice(0, 20)) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'custom';
    await query(
      `insert into bookmakers (id, account_id, name, group_name, commission_pct, enabled, is_custom, handicap_style)
       values ($1,$2,$3,'Other',0,true,true,'european')
       on conflict (account_id, id) do nothing`,
      [id, account.id, name.slice(0, 60)],
    );
  }

  const sports = Array.isArray(body.sports) ? body.sports.filter((s): s is string => typeof s === 'string') : null;
  if (sports) {
    for (const id of ['football', 'tennis', 'horse-racing']) {
      if (!sports.includes(id)) { await query('delete from sports where account_id = $1 and id = $2', [account.id, id]); continue; }
      await query(
        `insert into sports (id, account_id, name) values ($1,$2,$3) on conflict (account_id, id) do nothing`,
        [id, account.id, id === 'horse-racing' ? 'Horse racing' : id[0].toUpperCase() + id.slice(1)],
      );
    }
  }

  return ok();
}
