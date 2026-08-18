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

/* ── SIGNUPS WAITING ON A CODE ──────────────────────────────────
 *
 * Same rules as verification_codes, against pending_signups instead,
 * because that table is keyed by user_id and at this point there is no
 * user. Nothing about an account exists until the address is proved: not
 * the row, not the reserved email, not the reserved name, not the trial
 * clock, and not the redeemed promo code.
 * ─────────────────────────────────────────────────────────────── */

/** Create or replace the pending signup for an address and return its code. */
export async function issuePendingSignup(fields) {
  const sql = db();
  const code = newCode();
  await sql`
    INSERT INTO pending_signups (email_lower, email, display_name, name_lower,
                                 password_hash, promo_code, code_hash, expires_at)
    VALUES (${fields.email.toLowerCase()}, ${fields.email}, ${fields.name},
            ${fields.name.toLowerCase()}, ${fields.passwordHash},
            ${fields.promoCode || null}, ${sha256(code)},
            now() + ${CODE_TTL_MIN + ' minutes'}::interval)
    ON CONFLICT (email_lower) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      name_lower = EXCLUDED.name_lower,
      password_hash = EXCLUDED.password_hash,
      promo_code = EXCLUDED.promo_code,
      code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      created_at = now()`;
  return code;
}

/**
 * Issue a fresh code against a pending signup that already exists, without
 * touching the name, the password or the promo code it is holding. The
 * resend button must not be able to rewrite what somebody typed.
 * Returns the code, or null when there is nothing outstanding.
 */
export async function refreshPendingCode(email) {
  const code = newCode();
  const rows = await db()`
    UPDATE pending_signups
       SET code_hash = ${sha256(code)},
           expires_at = now() + ${CODE_TTL_MIN + ' minutes'}::interval,
           attempts = 0
     WHERE email_lower = ${String(email || '').toLowerCase()}
     RETURNING email_lower`;
  return rows.length ? code : null;
}

export async function pendingSignup(email) {
  const rows = await db()`
    SELECT * FROM pending_signups WHERE email_lower = ${String(email || '').toLowerCase()}`;
  return rows[0] || null;
}

/**
 * Check a code against a pending signup. Does NOT delete the row: the
 * caller still has to create the account, and losing the password hash
 * because the name turned out to be taken would strand somebody who did
 * everything right.
 */
export async function checkPendingCode(email, code) {
  const sql = db();
  const lower = String(email || '').toLowerCase();
  const rows = await sql`
    SELECT code_hash, attempts, expires_at < now() AS expired
    FROM pending_signups WHERE email_lower = ${lower}`;
  if (!rows.length) return { ok: false, reason: 'No code outstanding. Send a new one.' };
  const row = rows[0];
  if (row.expired) return { ok: false, reason: 'That code has expired. Send a new one.' };
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: 'Too many attempts on that code. Send a new one.' };
  }
  const given = Buffer.from(sha256(String(code)), 'hex');
  const want = Buffer.from(row.code_hash, 'hex');
  const match = given.length === want.length && timingSafeEqual(given, want);
  if (!match) {
    await sql`UPDATE pending_signups SET attempts = attempts + 1 WHERE email_lower = ${lower}`;
    return { ok: false, reason: 'That code is not right. Check the email or resend it.' };
  }
  return { ok: true };
}

export async function clearPendingSignup(email) {
  await db()`DELETE FROM pending_signups WHERE email_lower = ${String(email || '').toLowerCase()}`;
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
           u.plan, u.plan_until, u.promo_code, u.verified, u.trial_ends_at,
           u.privacy, u.count_mode, u.break_until, u.telegram_id, u.link_code,
           /* Added with the columns they belong to. The link code was
              issued and stored correctly and then never reached the page,
              because the session query still selected the columns that
              existed when it was written. Found by asking production for a
              code and watching /api/auth/me not have it. */
           u.link_code_expires_at, u.link_code_used_at,
           u.telegram_linked_at, u.telegram_username,
           u.card_added, u.charge_due_at, u.charge_paid_at, u.cancel_at,
           u.onboarded_at,
           u.created_at
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

/* The pending-signup twin of findByIdentifier. Name matches are allowed
   too: pending names are not reserved, so more than one row can hold the
   same one — the most recent is the one whose code was sent last. */
export async function findPendingByIdentifier(identifier) {
  const v = String(identifier || '').trim().toLowerCase();
  if (!v) return null;
  const sql = db();
  const rows = looksLikeEmail(v)
    ? await sql`SELECT email, display_name, password_hash FROM pending_signups
                WHERE email_lower = ${v}`
    : await sql`SELECT email, display_name, password_hash FROM pending_signups
                WHERE name_lower = ${v} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] || null;
}

/* ---- password reset ----
   Its own table and its own TTL. A reset token grants a password change,
   which is strictly more than a verification code grants, so the two never
   share storage: a bug in one flow must not become a takeover in the other. */
/* Ten minutes, the same as a verification code. Two different expiry
   windows for two six-digit codes is a detail nobody can hold, and the
   emails would have to explain which one they were looking at. */
const RESET_TTL_MIN = 10;
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
