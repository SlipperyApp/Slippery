/* Group rules that more than one endpoint needs.
 *
 * This exists because ULTRAS now puts people into a group, so the promo
 * endpoint has to know the same limits, the same code alphabet and the same
 * membership rules that /api/groups does. Two copies of "a group holds 200
 * people" is how the two drift apart, and the one that drifts is whichever
 * is not the one being read.
 *
 * It lives in _lib/ because Vercel routes every .js directly under api/ as
 * its own serverless function and the Hobby plan allows twelve. Shared code
 * here costs nothing.
 */
import { randomBytes } from 'node:crypto';
import { uniqueViolation } from './db.js';

export const MAX_GROUPS_PER_USER = 20;
export const MAX_MEMBERS = 200;
export const VISIBILITIES = ['public', 'private'];

/* No I, O, 0 or 1: these get read aloud and typed back wrong. */
export function groupCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const byte of randomBytes(6)) out += alphabet[byte % alphabet.length];
  return out;
}

/**
 * Put the redeemer of a group-carrying promo code into that code's group,
 * creating it if they are the first.
 *
 * The promo code IS the authorisation, so this joins outright rather than
 * raising a request the way the directory does. Somebody holding ULTRAS was
 * handed it deliberately; making them then queue for the owner's approval
 * would be asking the same question twice.
 *
 * Never throws for an ordinary "cannot join" reason. A full group, or a
 * person already in their twentieth group, must not fail the redemption:
 * the plan and the tick are the thing being bought and the group is a
 * courtesy on top. It reports why instead, so the caller can say so.
 *
 * @returns {Promise<null | {group:{id:string,name:string,visibility:string},
 *                           created:boolean, joined:boolean, why:string}>}
 */
export async function ensurePromoGroup(sql, user, promo) {
  if (!promo || !promo.group) return null;

  const name = String(promo.group).trim();
  const lower = name.toLowerCase();
  const visibility = promo.groupVisibility === 'public' ? 'public' : 'private';

  /* Find it, or make it. The loop covers the race where two people redeem
     at the same moment and both read "no such group": the unique index on
     name_lower decides, the loser re-reads and joins what the winner made. */
  let g = null;
  for (let attempt = 0; attempt < 6 && !g; attempt++) {
    const found = await sql`
      SELECT id, name, visibility FROM groups WHERE name_lower = ${lower} LIMIT 1`;
    if (found.length) { g = found[0]; break; }

    /* First redeemer. They create it and they own it, which also means the
       ordinary owner-approval path works for anyone who finds it in the
       directory later. */
    const code = groupCode();
    try {
      const rows = await sql`
        INSERT INTO groups (name, name_lower, owner_id, visibility, join_code)
        VALUES (${name}, ${lower}, ${user.id}, ${visibility}, ${code})
        RETURNING id, name, visibility`;
      await sql`INSERT INTO group_members (group_id, user_id) VALUES (${rows[0].id}, ${user.id})`;
      return { group: rows[0], created: true, joined: true, why: '' };
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      /* Either the name went while we were looking, or the join code
         collided. Both are answered by going round again. */
    }
  }

  if (!g) return null;

  /* Already in it. Redeeming twice must not read as a second join. */
  const mine = await sql`
    SELECT 1 FROM group_members WHERE group_id = ${g.id} AND user_id = ${user.id} LIMIT 1`;
  if (mine.length) return { group: g, created: false, joined: false, why: 'already' };

  const held = await sql`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id}`;
  if (held[0].n >= MAX_GROUPS_PER_USER) {
    return { group: g, created: false, joined: false, why: 'user-full' };
  }

  const size = await sql`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${g.id}`;
  if (size[0].n >= MAX_MEMBERS) {
    return { group: g, created: false, joined: false, why: 'group-full' };
  }

  try {
    await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${user.id})`;
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    /* Two redemptions in flight at once. Idempotent by construction. */
    return { group: g, created: false, joined: false, why: 'already' };
  }
  return { group: g, created: false, joined: true, why: '' };
}
