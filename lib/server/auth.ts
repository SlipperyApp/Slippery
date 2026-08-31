/** Sessions, passwords and codes.
 *
 *  Cookies only. No localStorage and no sessionStorage: iOS Safari is the
 *  primary target. Secrets come from process.env and are never logged or
 *  echoed, including in an error message. */

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { read } from './env';
import { hasDatabase, query } from './db';

export const SESSION_COOKIE = 'slip_session';
const SESSION_DAYS = 60;

function secret(): string {
  // A development fallback so a local run is possible. Production sets
  // AUTH_SECRET, and /api/sources reports whether it did.
  return read('AUTH_SECRET') ?? 'development-only-not-a-secret';
}

export function hashToken(token: string): string {
  return createHmac('sha256', secret()).update(token).digest('hex');
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** scrypt, with the salt stored beside the hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const check = scryptSync(password, salt, 64);
  const known = Buffer.from(key, 'hex');
  return known.length === check.length && timingSafeEqual(known, check);
}

/** A six digit code, stored only as a hash. The code itself is never logged,
 *  which the privacy policy commits us to. */
export function newCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function hashCode(email: string, code: string): string {
  return createHmac('sha256', secret()).update(`${email.toLowerCase()}:${code}`).digest('hex');
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function setSession(accountId: string, userAgent?: string): Promise<void> {
  const token = newToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  if (hasDatabase()) {
    await query(
      `insert into sessions (account_id, token_hash, user_agent, expires_at)
       values ($1, $2, $3, now() + ($4 || ' days')::interval)`,
      [accountId, hashToken(token), userAgent ?? null, String(SESSION_DAYS)],
    );
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (token && hasDatabase()) {
    await query('update sessions set revoked_at = now() where token_hash = $1', [hashToken(token)]);
  }
}

export type SessionAccount = { id: string; email: string; displayName: string; handle: string | null };

export async function currentAccount(): Promise<SessionAccount | null> {
  if (!hasDatabase()) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = await query<{ id: string; email: string; display_name: string; handle: string | null }>(
      `select a.id, a.email, a.display_name, a.handle
         from sessions s join accounts a on a.id = s.account_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
        limit 1`,
      [hashToken(token)],
    );
    const r = rows[0];
    return r ? { id: r.id, email: r.email, displayName: r.display_name, handle: r.handle } : null;
  } catch {
    return null;
  }
}
