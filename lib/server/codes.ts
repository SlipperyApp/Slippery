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

/*  ------------------------------------------------------- the share token
 *
 *  A balance's public link. Its whole security is that the token cannot be
 *  guessed, so it is not a code somebody reads out: it is twenty characters
 *  from a thirty one letter alphabet, which is about ninety nine bits, and
 *  it is only ever copied. Lower case because it lives in a URL and a URL
 *  full of capitals is a URL people retype wrongly.
 *
 *  A four character link code would have been catastrophic here. It is fine
 *  for a code somebody types into a bot once, with a rate limit in front of
 *  it, and it is a public directory of everybody's ledger if it opens a page.
 *
 *  Revoking is setting the column to null. There is no second flag that could
 *  disagree with it and no expiry to get wrong: the token is the permission. */
const SHARE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';   // no 0/o, no 1/i/l
export const SHARE_TOKEN_RE = /^sb-[23456789abcdefghjkmnpqrstuvwxyz]{20}$/;

export function generateShareToken(): string {
  const bytes = randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) out += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  return `sb-${out}`;
}

/** The only validator, and the generator is tested against it. A previous
 *  build seeded codes in a shape its own bot rejected. */
export function isShareToken(v: unknown): v is string {
  return typeof v === 'string' && SHARE_TOKEN_RE.test(v);
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

/** The bare address out of a From header, so `Slippery <post@example.com>`
 *  yields `post@example.com`.
 *
 *  A From header may legitimately carry a display name, and MAIL_FROM is the
 *  kind of variable somebody sets that way. The envelope and the SMTP username
 *  cannot: `MAIL FROM:<Slippery <post@example.com>>` is a syntax error that
 *  Gmail answers 555 to, and AUTH LOGIN with a display name attached
 *  authenticates as an account that does not exist. One parser, so the header
 *  and the envelope cannot disagree about who is sending.
 *
 *  Lives here rather than in smtp.ts because env.ts needs it too and env.ts
 *  must not pull node:tls into a server component's module graph. */
export function bareAddress(v: string): string {
  const t = v.trim();
  const angled = /<([^<>]*)>\s*$/.exec(t);
  return (angled ? angled[1] : t).trim();
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
