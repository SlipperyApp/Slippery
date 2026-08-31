/** Link codes and invite codes.
 *
 *  ONE format, ONE validator, and a test asserting a generated code passes
 *  it. The previous build seeded codes in a shape its own bot rejected. */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // no 0/O, no 1/I/L

export const LINK_CODE_RE = /^SLIP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;
export const INVITE_CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

function pick(bytes: Uint8Array, n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return a;
}

export function generateLinkCode(): string {
  return `SLIP-${pick(randomBytes(4), 4)}`;
}

export function generateInviteCode(): string {
  return pick(randomBytes(6), 6);
}

/** The only validator. The bot, the web form and the seed all call this. */
export function isLinkCode(v: string): boolean {
  return LINK_CODE_RE.test(v.trim().toUpperCase());
}

export function isInviteCode(v: string): boolean {
  return INVITE_CODE_RE.test(v.trim().toUpperCase());
}

export function normaliseLinkCode(v: string): string {
  const t = v.trim().toUpperCase().replace(/\s+/g, '');
  return t.startsWith('SLIP-') ? t : `SLIP-${t}`;
}

/** A real email validator. The previous build accepted `a@b..com`. */
export function isEmail(v: string): boolean {
  const t = v.trim();
  if (t.length > 254 || t.length < 6) return false;
  if (/\.\./.test(t)) return false;
  if (/^[.@]|[.@]$/.test(t)) return false;
  const m = /^([A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/.exec(t);
  if (!m) return false;
  const tld = m[2].split('.').pop() ?? '';
  return tld.length >= 2 && /^[A-Za-z]+$/.test(tld);
}

/** Password rules, shown live as ticks on the signup form. One source, so
 *  the ticks and the server cannot disagree. */
export const PASSWORD_RULES = [
  { id: 'length', label: '8 characters or more', test: (p: string) => p.length >= 8 },
  { id: 'capital', label: 'One capital letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'special', label: 'One number or symbol', test: (p: string) => /[^A-Za-z]/.test(p) },
];

export function passwordOk(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

/** A handle is what other Slippers see. */
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export function isHandle(v: string): boolean {
  return HANDLE_RE.test(v.trim().toLowerCase());
}
