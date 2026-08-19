/* No `server-only` marker here on purpose: nothing in this file reads an
   environment variable or touches a connection, so it is safe for the tests
   to import directly, and it is node:crypto that keeps it off the client. */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac, randomInt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, k: number) => Promise<Buffer>;

/* scrypt, not a plain hash. A password column that can be reversed by a
   lookup table is the same as no password column. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return 's1$' + salt.toString('base64url') + '$' + key.toString('base64url');
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [v, saltB64, keyB64] = stored.split('$');
  if (v !== 's1' || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64url');
  const want = Buffer.from(keyB64, 'base64url');
  const got = await scrypt(password, salt, want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

/* Compared with a constant-time equal, because a verification code checked
   with === leaks its digits one round trip at a time. */
export function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const sessionId = () => randomBytes(32).toString('base64url');

/* Six digits, from the CSPRNG. Math.random is not a source of secrets. */
export const verificationCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/* THE LINK CODE. ONE FORMAT, ONE VALIDATOR.
 *
 * The old app seeded every account with a code in a format its own bot
 * rejected, so the seed was dead on arrival and nobody noticed. The alphabet
 * drops the characters people mistype reading a code off a screen: no 0/O,
 * no 1/I/L, no U. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LINK_PREFIX = 'SLIP-';
export const LINK_BODY_LENGTH = 4;
export const LINK_TTL_MS = 10 * 60 * 1000;

export function makeLinkCode(): string {
  let out = '';
  for (let i = 0; i < LINK_BODY_LENGTH; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return LINK_PREFIX + out;
}

/* The one validator. `SLIP-4F2K`, `slip4f2k` and `slip 4f2k` are one code,
   because somebody typing it into Telegram will produce all three. */
export function normaliseLinkCode(input: string): string | null {
  const bare = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = bare.startsWith('SLIP') ? bare.slice(4) : bare;
  if (body.length !== LINK_BODY_LENGTH) return null;
  if (![...body].every((c) => ALPHABET.includes(c))) return null;
  return LINK_PREFIX + body;
}

export const looksLikeLinkCode = (input: string) => normaliseLinkCode(input) !== null;
