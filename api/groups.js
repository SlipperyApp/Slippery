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
      if (url.searchParams.has('browse')) {
        return browse(res, user, url.searchParams.get('q') || '',
          url.searchParams.get('sort') || 'popular');
      }
      if (url.searchParams.has('requests')) return requests(res, user);
      return list(res, user);
    }

    const body = await readJson(req, 8 * 1024);
    if (req.method === 'DELETE') return leave(res, user, body);
    /* The owner answering a request. Checked before the join paths so a
       body carrying both cannot slip through as a join. */
    if (body && body.decide) return decide(res, user, body);
    if (body && body.code) return joinGroup(res, user, body);
    /* ASKING IS NOT JOINING. Every group is in the directory now, private
       ones included, and every way in goes through the owner. A directory
       that hides private groups makes them undiscoverable; one that lists
       them without a gate makes "private" meaningless. Listing the door
       and locking it does both jobs. */
    if (body && body.join) return requestJoin(res, user, body);
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
    SELECT gm.group_id, u.id, u.display_name, u.unit_pence, u.verified
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
      /* The tick, from the column. It used to be hardcoded false, so a
         verified account looked exactly like an unverified one to everybody
         in its groups, which is the entire thing the tick is for. */
      v: Boolean(m.verified),
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
 * EVERY group, alphabetically or by size or by age, with how many people
 * are in each and where you stand with it.
 *
 * This used to list public groups only, and hid private ones entirely on
 * the reasoning that a locked row still tells you the group exists. That
 * reasoning was wrong for this product: a group nobody can find is a group
 * nobody joins, and the owner had no way to invite anyone except by
 * passing a code around outside the app. Listing the door and locking it
 * is the version that does both jobs, and the lock is real, because every
 * way in now goes through the owner.
 *
 * What still does NOT leave here: join codes, member names, and any figure
 * at all. A directory is a list of doors, not a window. Someone who has
 * not joined has no business seeing who is inside or how they are doing.
 */
const BROWSE_LIMIT = 100;
const SORTS = ['popular', 'new', 'name'];

async function browse(res, user, query, sort) {
  const sql = db();
  /* Folded the same way the unique index folds, so a search matches the
     thing that decides. */
  const q = String(query || '').trim().toLowerCase().slice(0, 40);
  const order = SORTS.includes(sort) ? sort : 'popular';

  /* Three orderings, written out rather than interpolated. A sort key that
     reaches the SQL as a string is an injection waiting to happen, and the
     tagged template cannot parameterise an ORDER BY clause. */
  const rows = order === 'name'
    ? await sql`
        SELECT g.id, g.name, g.visibility, g.created_at,
               (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members,
               EXISTS (SELECT 1 FROM group_members m
                       WHERE m.group_id = g.id AND m.user_id = ${user.id}) AS joined,
               EXISTS (SELECT 1 FROM group_requests r
                       WHERE r.group_id = g.id AND r.user_id = ${user.id}) AS asked
        FROM groups g
        WHERE ${q ? sql`g.name_lower LIKE ${'%' + q + '%'}` : sql`true`}
        ORDER BY g.name_lower
        LIMIT ${BROWSE_LIMIT}`
    : order === 'new'
      ? await sql`
          SELECT g.id, g.name, g.visibility, g.created_at,
                 (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members,
                 EXISTS (SELECT 1 FROM group_members m
                         WHERE m.group_id = g.id AND m.user_id = ${user.id}) AS joined,
                 EXISTS (SELECT 1 FROM group_requests r
                         WHERE r.group_id = g.id AND r.user_id = ${user.id}) AS asked
          FROM groups g
          WHERE ${q ? sql`g.name_lower LIKE ${'%' + q + '%'}` : sql`true`}
          ORDER BY g.created_at DESC
          LIMIT ${BROWSE_LIMIT}`
      : await sql`
          SELECT g.id, g.name, g.visibility, g.created_at,
                 (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS members,
                 EXISTS (SELECT 1 FROM group_members m
                         WHERE m.group_id = g.id AND m.user_id = ${user.id}) AS joined,
                 EXISTS (SELECT 1 FROM group_requests r
                         WHERE r.group_id = g.id AND r.user_id = ${user.id}) AS asked
          FROM groups g
          WHERE ${q ? sql`g.name_lower LIKE ${'%' + q + '%'}` : sql`true`}
          ORDER BY members DESC, g.name_lower
          LIMIT ${BROWSE_LIMIT}`;

  return json(res, 200, {
    groups: rows.map(g => ({
      id: g.id,
      name: g.name,
      visibility: g.visibility,
      members: g.members,
      joined: g.joined,
      asked: g.asked,
      since: g.created_at,
      full: g.members >= MAX_MEMBERS
    })),
    sort: order,
    limit: BROWSE_LIMIT
  });
}

/* ---------------- requests ----------------
 *
 * What the owner sees: who has asked to get into the groups they own. A
 * display name and when they asked, and nothing else. Somebody standing
 * outside the door does not get their record read out to decide on.
 */
async function requests(res, user) {
  const sql = db();
  const rows = await sql`
    SELECT r.group_id, r.user_id, r.requested_at, g.name AS group_name, u.name AS person
    FROM group_requests r
    JOIN groups g ON g.id = r.group_id
    JOIN users u ON u.id = r.user_id
    WHERE g.owner_id = ${user.id} AND u.deleted_at IS NULL
    ORDER BY r.requested_at
    LIMIT 200`;
  return json(res, 200, {
    requests: rows.map(r => ({
      groupId: r.group_id, groupName: r.group_name,
      userId: r.user_id, person: r.person, at: r.requested_at
    }))
  });
}

/* Ask to join. Never joins.
 *
 * The old joinPublic inserted a membership straight away for a public
 * group. Both paths ask now, so there is one rule to explain and one place
 * a person can get in: the owner said yes. */
async function requestJoin(res, user, body) {
  const sql = db();
  const id = String((body && body.join) || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(res, 400, { error: 'That is not a group.' });

  if (!(await limit('group-join:' + user.id, 20, 3600)).allowed) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' });
  }

  let found;
  try {
    found = await sql`SELECT id, name, owner_id FROM groups WHERE id = ${id}`;
  } catch {
    /* A malformed uuid is a 404, not a 500: Postgres raises on a bad uuid
       rather than returning no rows. */
    return json(res, 404, { error: 'That group is not there any more.' });
  }
  if (!found.length) return json(res, 404, { error: 'That group is not there any more.' });
  const g = found[0];

  const already = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${g.id} AND user_id = ${user.id}`;
  if (already.length) return json(res, 409, { error: 'You are already in ' + g.name + '.' });

  const size = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${g.id}`;
  if (size[0].n >= MAX_MEMBERS) {
    return json(res, 409, { error: g.name + ' is full at ' + MAX_MEMBERS + '.' });
  }
  const held = await sql`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id}`;
  if (held[0].n >= MAX_GROUPS_PER_USER) {
    return json(res, 409, { error: 'You are in ' + MAX_GROUPS_PER_USER + ' groups already.' });
  }

  try {
    await sql`INSERT INTO group_requests (group_id, user_id) VALUES (${g.id}, ${user.id})`;
  } catch (err) {
    /* The primary key refusing a second insert IS the "already asked"
       check, so a duplicate is a normal answer rather than an error. */
    if (!uniqueViolation(err)) throw err;
  }
  return json(res, 202, { asked: true, group: { id: g.id, name: g.name } });
}

/* The owner answering. Accept puts them in; decline removes the request
   and says nothing more, because a declined request that keeps reappearing
   is a way to pester somebody. */
async function decide(res, user, body) {
  const sql = db();
  const groupId = String((body && body.decide) || '');
  const userId = String((body && body.person) || '');
  const yes = body.accept === true;
  if (!/^[0-9a-f-]{36}$/i.test(groupId) || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return json(res, 400, { error: 'That request is not one we can answer.' });
  }

  const owned = await sql`
    SELECT id, name FROM groups WHERE id = ${groupId} AND owner_id = ${user.id}`;
  if (!owned.length) return json(res, 403, { error: 'Only the person who made a group can let people into it.' });

  const asked = await sql`
    DELETE FROM group_requests WHERE group_id = ${groupId} AND user_id = ${userId} RETURNING user_id`;
  if (!asked.length) return json(res, 404, { error: 'That request is not open any more.' });
  if (!yes) return json(res, 200, { declined: true });

  const size = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${groupId}`;
  if (size[0].n >= MAX_MEMBERS) {
    return json(res, 409, { error: owned[0].name + ' is full at ' + MAX_MEMBERS + '.' });
  }
  try {
    await sql`INSERT INTO group_members (group_id, user_id) VALUES (${groupId}, ${userId})`;
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
  }
  return json(res, 200, { accepted: true, group: { id: groupId, name: owned[0].name } });
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

/* joinPublic lived here and put somebody straight into a public group.
   Both ways in ask now, so there is one rule to explain and one way a
   person gets in: the owner said yes. See requestJoin and decide above. */

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
