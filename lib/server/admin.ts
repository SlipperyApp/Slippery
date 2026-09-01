/** The admin levers.
 *
 *  Every one of them requires ADMIN_SECRET in an x-admin-secret header,
 *  compared in constant time. Without the variable they refuse every call,
 *  which is the safe direction, and /api/sources reports that they are not
 *  ready rather than leaving somebody guessing. */

import { timingSafeEqual } from 'node:crypto';
import { read } from './env';

export function authoriseAdmin(req: Request): boolean {
  const expected = read('ADMIN_SECRET');
  const given = req.headers.get('x-admin-secret');
  if (!expected || !given) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
