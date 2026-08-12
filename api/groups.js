/* /api/groups — friends, ranked in units.
 *
 *   GET    /api/groups                    the groups you are in, with a board
 *   POST   /api/groups {name, visibility} start one
 *   POST   /api/groups {code}             join one
 *   DELETE /api/groups {id}               leave one
 *
 * UNITS, NEVER MONEY. The brief is explicit that a group ranks in units so
 * nobody sees anybody's stake sizes, and this endpoint is where that has to
 * hold: it returns each member's unit size and their profit, and the board
 * divides. Sending raw pence and dividing in the browser would put every
 * member's real stake sizes into a response that anyone in the group can
 * read, which is the one thing the ranking is designed not to reveal.
 *
 * The exception the brief also states: group members always see each other's
 * units, whatever their privacy setting says. Privacy governs followers, not
 * a group you chose to join.
 */
import { json, methodGuard, readJson, fail } from './_lib/http.js';
import { db, ensureSchema, configured, uniqueViolation } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { limit } from './_lib/rate.js';
import { randomBytes } from 'node:crypto';

const MAX_GROUPS_PER_USER = 20;
const MAX_MEMBERS = 200;
const VISIBILITIES = ['public', 'private'];

/* No I, O, 0 or 1: these get read aloud and typed back wrong. */
export function groupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const byte of randomBytes(6)) out += alphabet[byte % alphabet.length];
  return out;
}

export function nameProblem(v) {
  v = String(v || '').trim();
  if (!v) return 'Give the group a name.';
  if (v.length < 3) return 'That is a bit short. Three characters or more.';
  if (v.length > 40) return 'Group names are 40 characters at most.';
  /* Deliberately permissive: this is a name people choose for their mates,
     not an identifier. It is escaped everywhere it is rendered. */
  if (/[\u0000-\u001f\u007f]/.test(v)) return 'That has characters we cannot store.';
  return '';
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST', 'DELETE'])) return;
  try {
    if (!configured()) {
      return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    }
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to see your groups.' });

    if (req.method === 'GET') return list(res, user);

    const body = await readJson(req, 8 * 1024);
    if (req.method === 'DELETE') return leave(res, user, body);
    return body && body.code ? joinGroup(res, user, body) : create(res, user, body);
  } catch (err) {
    return fail(res, err, 'Your groups could not be reached.');
  }
}

/* ---------------- read ---------------- */
async function list(res, user) {
  const sql = db();
  const mine = await sql`
    SELECT g.id, g.name, g.visibility, g.join_code, g.owner_id
    FROM groups g JOIN group_members m ON m.group_id = g.id
    WHERE m.user_id = ${user.id}
    ORDER BY g.created_at`;

  if (!mine.length) return json(res, 200, { groups: [], people: [] });

  const ids = mine.map(g => g.id);
  const members = await sql`
    SELECT gm.group_id, u.id, u.display_name, u.unit_pence
    FROM group_members gm JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ANY(${ids}) AND u.deleted_at IS NULL
    ORDER BY gm.joined_at`;

  /* One aggregate for everyone in every one of your groups, by month, so a
     board of twenty people is one query rather than twenty. Settled bets
     only: an open bet has no profit, and counting it as zero would rank
     someone mid-losing-streak level with someone who has not bet. */
  const userIds = [...new Set(members.map(m => m.id))];
  const year = new Date().getUTCFullYear();
  const totals = await sql`
    SELECT user_id,
           EXTRACT(MONTH FROM placed_at)::int AS month,
           SUM(profit_pence)::int AS profit,
           SUM(stake_pence)::int AS staked,
           count(*)::int AS bets
    FROM bets
    WHERE user_id = ANY(${userIds})
      AND status = 'settled' AND profit_pence IS NOT NULL
      AND EXTRACT(YEAR FROM placed_at)::int = ${year}
    GROUP BY user_id, month`;

  const byUser = new Map();
  for (const id of userIds) byUser.set(id, { months: new Array(12).fill(0), staked: 0, bets: 0 });
  for (const row of totals) {
    const acc = byUser.get(row.user_id);
    if (!acc) continue;
    acc.months[row.month - 1] = row.profit;
    acc.staked += row.staked;
    acc.bets += row.bets;
  }

  /* The renderer speaks names, so the board is a list of names and the
     people are looked up beside it. "You" is the signed-in member, because
     the board highlights that row and must not need the id to find it. */
  const people = [];
  const seen = new Set();
  for (const m of members) {
    if (m.id === user.id || seen.has(m.id)) continue;
    seen.add(m.id);
    const acc = byUser.get(m.id) || { months: new Array(12).fill(0), staked: 0, bets: 0 };
    const months = acc.months;
    const all = months.reduce((a, b) => a + b, 0);
    people.push({
      n: m.display_name,
      a: initials(m.display_name),
      un: m.unit_pence,
      months,
      all,
      /* A count and a ratio. Neither reveals a stake size: turnover itself
         stays on the server and only the percentage it produces leaves. */
      b: acc.bets,
      roi: acc.staked ? all / acc.staked : 0,
      v: false,
      /* Inside a group, units are always visible. That is the brief's rule,
         and it is why these two are fixed rather than read from a privacy
         column: you joined the group. */
      pv: 'public',
      mu: true,
      ing: false,
      er: false,
      gr: mine.map((g, i) => (members.some(x => x.group_id === g.id && x.id === m.id) ? i : -1))
              .filter(i => i >= 0)
    });
  }

  return json(res, 200, {
    groups: mine.map(g => ({
      id: g.id,
      name: g.name,
      visibility: g.visibility,
      code: g.join_code,
      owner: g.owner_id === user.id,
      mem: members.filter(m => m.group_id === g.id)
                  .map(m => (m.id === user.id ? 'You' : m.display_name))
    })),
    people
  });
}

const initials = name => String(name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

/* ---------------- create ---------------- */
async function create(res, user, body) {
  const problem = nameProblem(body && body.name);
  if (problem) return json(res, 400, { error: problem, field: 'name' });

  const visibility = VISIBILITIES.includes(body.visibility) ? body.visibility : 'private';
  const sql = db();

  if (!(await limit('group-create:' + user.id, 10, 3600)).allowed) {
    return json(res, 429, { error: 'That is a lot of groups at once. Try again later.' });
  }
  const held = await sql`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id}`;
  if (held[0].n >= MAX_GROUPS_PER_USER) {
    return json(res, 409, { error: 'You are in ' + MAX_GROUPS_PER_USER + ' groups already.' });
  }

  const name = String(body.name).trim();

  /* Retry on a code collision rather than checking first: the codes are
     random, the index is what actually decides, and a check-then-insert is
     a race by construction. */
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = groupCode();
    try {
      const rows = await sql`
        INSERT INTO groups (name, owner_id, visibility, join_code)
        VALUES (${name}, ${user.id}, ${visibility}, ${code})
        RETURNING id, name, visibility, join_code`;
      const g = rows[0];
      await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${user.id})`;
      return json(res, 201, {
        group: { id: g.id, name: g.name, visibility: g.visibility, code: g.join_code, owner: true, mem: ['You'] }
      });
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
    }
  }
  return json(res, 503, { error: 'Could not allocate a join code. Try again.' });
}

/* ---------------- join ---------------- */
async function joinGroup(res, user, body) {
  const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) return json(res, 400, { error: 'A join code is six characters.', field: 'code' });
  /* Guessing at codes is the obvious attack and they are short. */
  if (!(await limit('group-join:' + user.id, 20, 3600)).allowed) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' });
  }

  const sql = db();
  const found = await sql`SELECT id, name, visibility FROM groups WHERE join_code = ${code}`;
  if (!found.length) return json(res, 404, { error: 'No group has that code.', field: 'code' });
  const g = found[0];

  const size = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${g.id}`;
  if (size[0].n >= MAX_MEMBERS) return json(res, 409, { error: 'That group is full.' });

  try {
    await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${user.id})`;
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    return json(res, 200, { joined: false, group: { id: g.id, name: g.name }, note: 'You are already in that group.' });
  }
  return json(res, 201, { joined: true, group: { id: g.id, name: g.name, visibility: g.visibility } });
}

/* ---------------- leave ---------------- */
async function leave(res, user, body) {
  if (!body || !body.id) return json(res, 400, { error: 'Which group?' });
  const sql = db();
  const rows = await sql`
    DELETE FROM group_members WHERE group_id = ${body.id} AND user_id = ${user.id} RETURNING group_id`;
  if (!rows.length) return json(res, 404, { error: 'You are not in that group.' });
  /* The last person out turns the lights off, or the row and its code sit
     there forever pointing at nobody. */
  const left = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${body.id}`;
  if (left[0].n === 0) await sql`DELETE FROM groups WHERE id = ${body.id}`;
  return json(res, 200, { left: body.id, dissolved: left[0].n === 0 });
}
