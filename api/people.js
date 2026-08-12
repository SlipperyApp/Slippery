/* /api/people — following, followers, and finding someone.
 *
 *   GET    /api/people              who you follow and who follows you
 *   GET    /api/people?q=name       search by display name
 *   POST   /api/people {follow}     follow, by display name
 *   DELETE /api/people {follow}     unfollow
 *
 * WHAT LEAVES THIS ENDPOINT IS DECIDED BY THE OTHER PERSON.
 *
 * Following is one directional and needs nobody's permission, because it
 * grants nothing on its own. What it does is put someone in your list; what
 * you can then see of them is entirely their `privacy` column:
 *
 *   public    units and monthly figures, to anyone
 *   friends   units and monthly figures, but only if they follow you back
 *   private   nothing beyond the fact that the account exists
 *
 * That is why `muted` exists on every row. A person you follow who does not
 * follow you back, on the default 'friends' setting, is a real row with no
 * figures in it, and the UI says "their figures are private" rather than
 * showing zeros. Zeros would read as somebody who has broken even.
 *
 * The rule is enforced by not selecting the numbers, not by omitting them
 * from the render. A figure that reaches the browser has left the server,
 * and "the UI does not draw it" is not privacy.
 */
import { json, methodGuard, readJson, fail } from './_lib/http.js';
import { db, ensureSchema, configured, uniqueViolation } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { limit } from './_lib/rate.js';

const SEARCH_LIMIT = 30;
const MAX_FOLLOWING = 2000;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;
  try {
    if (!configured()) {
      return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    }
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to see people.' });

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const q = (url.searchParams.get('q') || '').trim();
      return q ? search(res, user, q) : lists(res, user);
    }

    const body = await readJson(req, 4 * 1024);
    const name = String((body && body.follow) || '').trim();
    if (!name) return json(res, 400, { error: 'Who?' });
    return req.method === 'DELETE' ? unfollow(res, user, name) : follow(res, user, name);
  } catch (err) {
    return fail(res, err, 'Could not reach people right now.');
  }
}

const initials = name => String(name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

/* ---------------- the two lists ---------------- */
async function lists(res, user) {
  const sql = db();

  /* One query for both directions, with two booleans saying which. A row
     can be in both lists at once, and that is exactly the case that decides
     whether a 'friends' account shows its figures, so it must not be two
     queries that can disagree. */
  const rows = await sql`
    SELECT u.id, u.display_name, u.unit_pence, u.privacy, u.verified,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${user.id} AND f.followee_id = u.id) AS following,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = ${user.id}) AS follower
    FROM users u
    WHERE u.deleted_at IS NULL AND u.id <> ${user.id}
      AND (EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${user.id} AND f.followee_id = u.id)
        OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = ${user.id}))
    ORDER BY lower(u.display_name)`;

  if (!rows.length) return json(res, 200, { following: [], followers: [] });

  /* Figures for the ones allowed to show them, and only for those: the id
     list is filtered before the aggregate runs, so a private account's
     profit is never read, let alone sent. */
  const open = rows.filter(visible);
  const totals = await monthlyTotals(sql, open.map(r => r.id));

  const shape = r => {
    const seen = visible(r);
    const acc = totals.get(r.id);
    return {
      n: r.display_name,
      a: initials(r.display_name),
      un: r.unit_pence,
      pv: r.privacy,
      v: Boolean(r.verified),
      ing: r.following,
      er: r.follower,
      /* `mu` is "may see", the flag the renderers already read. */
      mu: seen,
      months: seen && acc ? acc.months : new Array(12).fill(0),
      all: seen && acc ? acc.months.reduce((a, b) => a + b, 0) : 0,
      b: seen && acc ? acc.bets : 0,
      roi: seen && acc && acc.staked ? acc.months.reduce((a, b) => a + b, 0) / acc.staked : 0,
      gr: []
    };
  };

  return json(res, 200, {
    following: rows.filter(r => r.following).map(shape),
    followers: rows.filter(r => r.follower).map(shape)
  });
}

/* May this person's figures be shown to the viewer?
   'friends' means mutual. Following someone who has not followed back does
   not make you their friend, and treating it as though it did would let
   anyone read a 'friends' account by tapping Follow. */
function visible(row) {
  if (row.privacy === 'public') return true;
  if (row.privacy === 'private') return false;
  return Boolean(row.following && row.follower);
}

/* The same aggregate the group boards use: settled bets only, by month,
   for the current year. An open bet has no profit, and counting it as zero
   would rank somebody mid-losing-streak level with somebody who has not
   bet at all. */
async function monthlyTotals(sql, ids) {
  const out = new Map();
  if (!ids.length) return out;
  const year = new Date().getUTCFullYear();
  const rows = await sql`
    SELECT user_id,
           EXTRACT(MONTH FROM placed_at)::int AS month,
           SUM(profit_pence)::int AS profit,
           SUM(stake_pence)::int AS staked,
           count(*)::int AS bets
    FROM bets
    WHERE user_id = ANY(${ids})
      AND status = 'settled' AND profit_pence IS NOT NULL
      AND EXTRACT(YEAR FROM placed_at)::int = ${year}
    GROUP BY user_id, month`;
  for (const id of ids) out.set(id, { months: new Array(12).fill(0), staked: 0, bets: 0 });
  for (const r of rows) {
    const acc = out.get(r.user_id);
    if (!acc) continue;
    acc.months[r.month - 1] = r.profit;
    acc.staked += r.staked;
    acc.bets += r.bets;
  }
  return out;
}

/* ---------------- search ----------------
 *
 * Names only, never figures. Search is how you find somebody to follow, and
 * a search result carrying their profit would make every private account
 * readable by anyone who could guess a name.
 *
 * Private accounts are still listed. Being unlistable is a different
 * promise from having private figures, and somebody on 'private' still
 * wants their friends to be able to find them and follow; what they said
 * was that nobody sees their numbers.
 */
async function search(res, user, q) {
  const sql = db();
  const needle = q.toLowerCase().slice(0, 20);
  const rows = await sql`
    SELECT u.id, u.display_name, u.privacy, u.verified,
           EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${user.id} AND f.followee_id = u.id) AS following
    FROM users u
    WHERE u.deleted_at IS NULL AND u.id <> ${user.id}
      AND u.name_lower LIKE ${'%' + needle + '%'}
    ORDER BY lower(u.display_name)
    LIMIT ${SEARCH_LIMIT}`;
  return json(res, 200, {
    people: rows.map(r => ({
      n: r.display_name,
      a: initials(r.display_name),
      pv: r.privacy,
      v: Boolean(r.verified),
      ing: r.following
    }))
  });
}

/* ---------------- follow and unfollow ---------------- */
async function follow(res, user, name) {
  if (!(await limit('follow:' + user.id, 200, 3600)).allowed) {
    return json(res, 429, { error: 'That is a lot of following at once. Try again later.' });
  }
  const sql = db();
  const found = await sql`
    SELECT id, display_name FROM users
    WHERE name_lower = ${name.toLowerCase()} AND deleted_at IS NULL`;
  if (!found.length) return json(res, 404, { error: 'No account by that name.' });
  const them = found[0];
  if (them.id === user.id) return json(res, 400, { error: 'You already know how you are doing.' });

  const held = await sql`SELECT count(*)::int AS n FROM follows WHERE follower_id = ${user.id}`;
  if (held[0].n >= MAX_FOLLOWING) {
    return json(res, 409, { error: 'You are following ' + MAX_FOLLOWING + ' people already.' });
  }

  try {
    await sql`INSERT INTO follows (follower_id, followee_id) VALUES (${user.id}, ${them.id})`;
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    /* Already following. Not an error: the button and the truth agree, the
       client just did not know it yet. */
    return json(res, 200, { following: true, name: them.display_name });
  }
  return json(res, 201, { following: true, name: them.display_name });
}

async function unfollow(res, user, name) {
  const sql = db();
  const found = await sql`
    SELECT id, display_name FROM users
    WHERE name_lower = ${name.toLowerCase()} AND deleted_at IS NULL`;
  if (!found.length) return json(res, 404, { error: 'No account by that name.' });
  await sql`DELETE FROM follows WHERE follower_id = ${user.id} AND followee_id = ${found[0].id}`;
  /* Idempotent on purpose: unfollowing somebody you were not following is
     the state you asked for. */
  return json(res, 200, { following: false, name: found[0].display_name });
}
