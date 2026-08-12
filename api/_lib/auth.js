/* Password hashing, verification codes and sessions.
 *
 * scrypt from node:crypto rather than argon2/bcrypt: both of those are native
 * modules, and a native build on a serverless runtime is a deployment failure
 * waiting to happen. scrypt is memory-hard, in the standard library, and
 * needs no build step. Parameters below are the OWASP-recommended floor.
 */
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scryptAsync = promisify(scrypt);

const N = 16384, r = 8, p = 1, KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, n, rr, pp, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(password, salt, expected.length,
      { N: +n, r: +rr, p: +pp, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* A dummy hash to compare against when the email does not exist, so a login
   attempt costs the same either way. Without it, response time alone tells an
   attacker which addresses have accounts. */
let _dummy = null;
export async function equalisePasswordTiming(password) {
  if (!_dummy) _dummy = await hashPassword('timing-equalisation-placeholder');
  await verifyPassword(password, _dummy);
}

export const sha256 = v => createHash('sha256').update(v).digest('hex');

/* Six digits, uniform. Math.random() is not a CSPRNG and a predictable
   verification code is a full account takeover. */
export function newCode() {
  let out = '';
  while (out.length < 6) {
    for (const byte of randomBytes(8)) {
      if (byte < 250 && out.length < 6) out += String(byte % 10);
    }
  }
  return out;
}

export function newToken() { return randomBytes(32).toString('base64url'); }

export function linkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no I/O/0/1
  let out = '';
  for (const byte of randomBytes(4)) out += alphabet[byte % alphabet.length];
  return 'SLIP-' + out;
}

const CODE_TTL_MIN = 10;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_DAYS = 30;

export async function issueVerificationCode(userId) {
  const sql = db();
  const code = newCode();
  await sql`UPDATE verification_codes SET consumed = true
            WHERE user_id = ${userId} AND consumed = false`;
  await sql`INSERT INTO verification_codes (user_id, code_hash, expires_at)
            VALUES (${userId}, ${sha256(code)},
                    now() + ${CODE_TTL_MIN + ' minutes'}::interval)`;
  return code;
}

export async function checkVerificationCode(userId, code) {
  const sql = db();
  const rows = await sql`
    SELECT id, code_hash, attempts, expires_at < now() AS expired
    FROM verification_codes
    WHERE user_id = ${userId} AND consumed = false
    ORDER BY created_at DESC LIMIT 1`;
  if (!rows.length) return { ok: false, reason: 'No code outstanding. Send a new one.' };
  const row = rows[0];
  if (row.expired) return { ok: false, reason: 'That code has expired. Send a new one.' };
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: 'Too many attempts on that code. Send a new one.' };
  }
  /* Hash both sides and compare fixed-length buffers, so the comparison
     cannot leak the code one digit at a time. */
  const given = Buffer.from(sha256(String(code)), 'hex');
  const want = Buffer.from(row.code_hash, 'hex');
  const match = given.length === want.length && timingSafeEqual(given, want);
  if (!match) {
    await sql`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return { ok: false, reason: 'That code is not right. Check the email or resend it.' };
  }
  await sql`UPDATE verification_codes SET consumed = true WHERE id = ${row.id}`;
  await sql`UPDATE users SET email_verified = true WHERE id = ${userId}`;
  return { ok: true };
}

export async function createSession(userId) {
  const sql = db();
  const token = newToken();
  await sql`INSERT INTO auth_sessions (user_id, token_hash, expires_at)
            VALUES (${userId}, ${sha256(token)},
                    now() + ${SESSION_DAYS + ' days'}::interval)`;
  return token;
}

export async function sessionUser(req) {
  const token = readCookie(req, 'slippery_session');
  if (!token) return null;
  const sql = db();
  /* Select every column the callers read.
     This used to stop at unit_pence while /api/auth/me went on to read
     plan, telegram_id, link_code and created_at off the same row, so the
     settings page was told, on every load, that no bot was linked, there was
     no link code, and the plan was free. Nothing errored; the answers were
     just all undefined. */
  const rows = await sql`
    SELECT u.id, u.email, u.display_name, u.email_verified, u.unit_pence,
           u.plan, u.plan_until, u.promo_code, u.telegram_id, u.link_code, u.created_at
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.deleted_at IS NULL`;
  return rows[0] || null;
}

export async function destroySession(req) {
  const token = readCookie(req, 'slippery_session');
  if (!token) return;
  await db()`DELETE FROM auth_sessions WHERE token_hash = ${sha256(token)}`;
}

export function setSessionCookie(res, token) {
  res.setHeader('set-cookie',
    'slippery_session=' + token +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (SESSION_DAYS * 86400));
}
export function clearSessionCookie(res) {
  res.setHeader('set-cookie', 'slippery_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/* ---- shared validation. The client runs the same rules for the user's
   benefit; these are the ones that actually decide. ---- */
export function emailProblem(v) {
  v = String(v || '').trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254) return 'That address is too long.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'That does not look like a valid email address.';
  if (v.includes('..')) return 'That has two dots in a row.';
  return '';
}
export function passwordProblem(v) {
  v = String(v || '');
  if (v.length < 8) return 'Passwords need to be at least 8 characters.';
  if (v.length > 200) return 'That password is too long.';
  if (!/[A-Z]/.test(v)) return 'Passwords need a capital letter.';
  if (!/[^A-Za-z0-9]/.test(v)) return 'Passwords need a special character.';
  return '';
}
export function nameProblem(v) {
  v = String(v || '').trim();
  if (v.length < 3) return 'Display names need three characters or more.';
  if (v.length > 20) return 'Display names are 20 characters at most.';
  if (!/^[A-Za-z0-9_]+$/.test(v)) return 'Use letters, numbers and underscores only.';
  return '';
}

/* Log in with either.
 *
 * An @ decides which column to look in. Display names cannot contain one
 * (nameProblem allows letters, numbers and underscores only), so the test is
 * exact rather than a guess, and a string with an @ can only ever have been
 * meant as an email, even when it is a malformed one. */
export function looksLikeEmail(v) {
  return String(v || '').includes('@');
}

export function identifierProblem(v) {
  v = String(v || '').trim();
  if (!v) return 'Enter your username or email.';
  if (v.length > 254) return 'That is too long to be either.';
  return looksLikeEmail(v) ? emailProblem(v) : '';
}

/** Find the account behind a username or an email. Null when there is none. */
export async function findByIdentifier(identifier) {
  const v = String(identifier || '').trim().toLowerCase();
  if (!v) return null;
  const sql = db();
  const rows = looksLikeEmail(v)
    ? await sql`SELECT id, email, display_name, password_hash, email_verified
                FROM users WHERE email_lower = ${v} AND deleted_at IS NULL`
    : await sql`SELECT id, email, display_name, password_hash, email_verified
                FROM users WHERE name_lower = ${v} AND deleted_at IS NULL`;
  return rows[0] || null;
}

/* ---- password reset ----
   Its own table and its own TTL. A reset token grants a password change,
   which is strictly more than a verification code grants, so the two never
   share storage: a bug in one flow must not become a takeover in the other. */
const RESET_TTL_MIN = 30;
const MAX_RESET_ATTEMPTS = 5;

export async function issueResetCode(userId) {
  const sql = db();
  const code = newCode();
  await sql`UPDATE password_resets SET consumed = true
            WHERE user_id = ${userId} AND consumed = false`;
  await sql`INSERT INTO password_resets (user_id, code_hash, expires_at)
            VALUES (${userId}, ${sha256(code)},
                    now() + ${RESET_TTL_MIN + ' minutes'}::interval)`;
  return code;
}

export async function checkResetCode(userId, code) {
  const sql = db();
  const rows = await sql`
    SELECT id, code_hash, attempts, expires_at < now() AS expired
    FROM password_resets
    WHERE user_id = ${userId} AND consumed = false
    ORDER BY created_at DESC LIMIT 1`;
  if (!rows.length) return { ok: false, reason: 'No reset outstanding. Ask for a new code.' };
  const row = rows[0];
  if (row.expired) return { ok: false, reason: 'That code has expired. Ask for a new one.' };
  if (row.attempts >= MAX_RESET_ATTEMPTS) {
    return { ok: false, reason: 'Too many attempts on that code. Ask for a new one.' };
  }
  const given = Buffer.from(sha256(String(code)), 'hex');
  const want = Buffer.from(row.code_hash, 'hex');
  const match = given.length === want.length && timingSafeEqual(given, want);
  if (!match) {
    await sql`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return { ok: false, reason: 'That code is not right. Check the email or ask for another.' };
  }
  await sql`UPDATE password_resets SET consumed = true WHERE id = ${row.id}`;
  return { ok: true };
}

/* Every other session dies when the password changes. Someone resetting
   because they think they were compromised gets nothing from a new password
   if the attacker's cookie still works. */
export async function setPassword(userId, password) {
  const sql = db();
  await sql`UPDATE users SET password_hash = ${await hashPassword(password)},
                             email_verified = true
            WHERE id = ${userId}`;
  await sql`DELETE FROM auth_sessions WHERE user_id = ${userId}`;
}
