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
import { db, ensureSchema, configured, uniqueViolation, violatedIndex } from './_lib/db.js';
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

    if (req.method === 'GET') {
      /* One endpoint, because Vercel Hobby allows twelve functions in total
         and a browse screen is not worth one of them. */
      const url = new URL(req.url, 'http://x');
      if (url.searchParams.has('browse')) return browse(res, user, url.searchParams.get('q') || '');
      return list(res, user);
    }

    const body = await readJson(req, 8 * 1024);
    if (req.method === 'DELETE') return leave(res, user, body);
    if (body && body.code) return joinGroup(res, user, body);
    /* Joining a public group from the browse list needs no code: it is
       public, that is what public means. Private groups are never in the
       list, so an id alone can only ever open a public door. */
    if (body && body.join) return joinPublic(res, user, body);
    return create(res, user, body);
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

/* ---------------- browse ----------------
 *
 * Public groups, alphabetically, with how many people are in each and
 * whether you are already one of them.
 *
 * What deliberately does NOT leave here: join codes, member names, and any
 * figure at all. A directory is a list of doors, not a window. Someone who
 * has not joined has no business seeing who is inside or how they are
 * doing, and a join code in a public listing would make "private group,
 * public code" a contradiction the moment a group flipped visibility.
 *
 * Private groups are absent entirely rather than shown locked. A locked row
 * still tells you the group exists and what it is called, and the person
 * who ticked "private" was not agreeing to that.
 */
const BROWSE_LIMIT = 100;

async function browse(res, user, query) {
  const sql = db();
  /* Folded the same way the unique index folds, so a search matches the
     thing that decides. */
  const q = String(query || '').trim().toLowerCase().slice(0, 40);
  const rows = q
    ? await sql`
        SELECT g.id, g.name, g.created_at,
               (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members,
               EXISTS (SELECT 1 FROM group_members m
                       WHERE m.group_id = g.id AND m.user_id = ${user.id}) AS joined
        FROM groups g
        WHERE g.visibility = 'public' AND g.name_lower LIKE ${'%' + q + '%'}
        ORDER BY g.name_lower
        LIMIT ${BROWSE_LIMIT}`
    : await sql`
        SELECT g.id, g.name, g.created_at,
               (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members,
               EXISTS (SELECT 1 FROM group_members m
                       WHERE m.group_id = g.id AND m.user_id = ${user.id}) AS joined
        FROM groups g
        WHERE g.visibility = 'public'
        ORDER BY g.name_lower
        LIMIT ${BROWSE_LIMIT}`;

  return json(res, 200, {
    groups: rows.map(g => ({
      id: g.id,
      name: g.name,
      members: g.members,
      joined: g.joined,
      since: g.created_at,
      full: g.members >= MAX_MEMBERS
    })),
    limit: BROWSE_LIMIT
  });
}

/* ---------------- create ---------------- */

/* One wording for a taken name, wherever it is discovered.
   Named rather than inlined because the pre-check and the constraint have
   to say the same thing: two different messages for the same fact would
   read as two different problems. */
const nameTaken = (res, name) => json(res, 409, {
  error: 'The name ' + name + ' is taken. Group names are one per platform.',
  field: 'name', taken: true
});

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
  const lower = name.toLowerCase();

  /* A courtesy check, not the decision. Two people creating "The Ultras" at
     the same moment can both read "free" here and both proceed; the unique
     index below is what actually stops the second one. This exists only so
     that the ordinary case, where the name has been taken for a week,
     answers without depending on a constraint that could not be created
     because of pre-existing duplicates. */
  const clash = await sql`SELECT name FROM groups WHERE name_lower = ${lower} LIMIT 1`;
  if (clash.length) return nameTaken(res, name);

  /* Retry on a code collision rather than checking first: the codes are
     random, the index is what actually decides, and a check-then-insert is
     a race by construction.

     A NAME collision is different, and it is not retryable: names are
     unique across the whole platform, first come first served, so the only
     answer is to tell the person and let them pick another. Which index
     fired decides which of those two happened. */
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = groupCode();
    try {
      const rows = await sql`
        INSERT INTO groups (name, name_lower, owner_id, visibility, join_code)
        VALUES (${name}, ${lower}, ${user.id}, ${visibility}, ${code})
        RETURNING id, name, visibility, join_code`;
      const g = rows[0];
      await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${user.id})`;
      return json(res, 201, {
        group: { id: g.id, name: g.name, visibility: g.visibility, code: g.join_code, owner: true, mem: ['You'] }
      });
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      if (violatedIndex(err).includes('name')) return nameTaken(res, name);
      /* A code clash. Round again with a new one. */
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

/* ---------------- join a public group from the directory ----------------
 *
 * No code. The group said public, and a public group that still demands a
 * code is a private group with extra steps.
 *
 * The visibility check is in the WHERE clause rather than read and then
 * tested, so a private group's id is not a way in even if somebody learns
 * one. It is the same query shape as the code path: find the door, then try
 * the insert and let the primary key refuse a second membership.
 */
async function joinPublic(res, user, body) {
  const id = String(body.join || '').trim();
  if (!id) return json(res, 400, { error: 'Which group?' });
  if (!(await limit('group-join:' + user.id, 20, 3600)).allowed) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' });
  }

  const sql = db();
  let found;
  try {
    found = await sql`SELECT id, name, visibility FROM groups
                      WHERE id = ${id} AND visibility = 'public'`;
  } catch {
    /* A malformed uuid is a 404, not a 500: it is somebody sending a bad
       id, and Postgres raises rather than returning no rows. */
    return json(res, 404, { error: 'That group is not open to join.' });
  }
  if (!found.length) return json(res, 404, { error: 'That group is not open to join.' });
  const g = found[0];

  const size = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${g.id}`;
  if (size[0].n >= MAX_MEMBERS) return json(res, 409, { error: 'That group is full.' });

  const held = await sql`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id}`;
  if (held[0].n >= MAX_GROUPS_PER_USER) {
    return json(res, 409, { error: 'You are in ' + MAX_GROUPS_PER_USER + ' groups already.' });
  }

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
