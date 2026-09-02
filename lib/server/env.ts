/** Which environment variables the running deployment actually has.
 *
 *  Names and booleans only. A value never leaves this module, is never
 *  logged, and is never echoed: the repository is public and GitHub's secret
 *  scanner revokes exposed keys automatically.
 *
 *  Every integration degrades honestly when its variable is absent rather
 *  than crashing, and GET /api/sources reports this table, so "why is slip
 *  reading down on production" is one request rather than an hour of
 *  guessing. */

import { bareAddress } from './codes';

export const ENV_NAMES = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_YEARLY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'VISION_API_KEY',
  'ANTHROPIC_API_KEY',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'EMAIL_SMTP_HOST',
  'EMAIL_SMTP_PORT',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'MAIL_FROM',
  'ADMIN_SECRET',
  'ADMIN_PROMO_CODE',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
] as const;

export type EnvName = (typeof ENV_NAMES)[number];

/** Vercel's file tracer only follows literal import specifiers, and the same
 *  discipline applies here: every name is a literal, never a variable index
 *  into process.env built at runtime from user input. */
const READERS: Record<EnvName, () => string | undefined> = {
  DATABASE_URL: () => process.env.DATABASE_URL,
  AUTH_SECRET: () => process.env.AUTH_SECRET,
  GOOGLE_CLIENT_ID: () => process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: () => process.env.GOOGLE_CLIENT_SECRET,
  STRIPE_SECRET_KEY: () => process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: () => process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY: () => process.env.STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_YEARLY: () => process.env.STRIPE_PRICE_YEARLY,
  TELEGRAM_BOT_TOKEN: () => process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: () => process.env.TELEGRAM_WEBHOOK_SECRET,
  VISION_API_KEY: () => process.env.VISION_API_KEY,
  ANTHROPIC_API_KEY: () => process.env.ANTHROPIC_API_KEY,
  EMAIL_API_KEY: () => process.env.EMAIL_API_KEY,
  EMAIL_FROM: () => process.env.EMAIL_FROM,
  EMAIL_SMTP_HOST: () => process.env.EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT: () => process.env.EMAIL_SMTP_PORT,
  GMAIL_USER: () => process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: () => process.env.GMAIL_APP_PASSWORD,
  MAIL_FROM: () => process.env.MAIL_FROM,
  ADMIN_SECRET: () => process.env.ADMIN_SECRET,
  ADMIN_PROMO_CODE: () => process.env.ADMIN_PROMO_CODE,
  CRON_SECRET: () => process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: () => process.env.NEXT_PUBLIC_APP_URL,
};

export function has(name: EnvName): boolean {
  const v = READERS[name]();
  return typeof v === 'string' && v.trim().length > 0;
}

/*  Trimmed on the way out, not only on the way in.
 *
 *  The first version tested `v.trim()` for emptiness and then returned `v`,
 *  so a variable pasted into the Vercel dashboard with a trailing newline
 *  came back carrying it. That is invisible everywhere except the two places
 *  it matters: a newline in EMAIL_FROM is a header injection refusal on every
 *  send, and a newline on EMAIL_SMTP_HOST is a DNS lookup that never
 *  resolves. Neither error names the whitespace, so both read as "email is
 *  broken and the settings look right". */
export function read(name: EnvName): string | undefined {
  const v = READERS[name]();
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** VISION_API_KEY and ANTHROPIC_API_KEY are the same kind of key. The
 *  fallback is kept deliberately, so a rename cannot take slip reading down. */
export function visionKey(): string | undefined {
  return read('VISION_API_KEY') ?? read('ANTHROPIC_API_KEY');
}

/*  THE EMAIL VARIABLES HAVE TWO NAMES, and this is not tidiness for its own
 *  sake. The deployment already carries GMAIL_USER, GMAIL_APP_PASSWORD and
 *  MAIL_FROM, set by hand before this code existed; the code reads
 *  EMAIL_API_KEY and EMAIL_FROM. They do not match, and while they do not
 *  match NOBODY CAN COMPLETE A SIGNUP: the code is generated, hashed, stored
 *  and never sent.
 *
 *  Renaming three live variables to fix that is a change somebody has to make
 *  by hand at exactly the moment they are least likely to. Reading both is a
 *  change nobody has to make at all. EMAIL_* wins where both are set, so the
 *  explicit name is always the one in charge.
 *
 *  The pair is resolved TOGETHER. A password from one set with an address
 *  from the other authenticates as the wrong account, so the halves cannot be
 *  mixed. */
export function emailCredentials(): { key: string; from: string; user: string } | null {
  const key = read('EMAIL_API_KEY') ?? read('GMAIL_APP_PASSWORD');
  const from = read('EMAIL_FROM') ?? read('MAIL_FROM') ?? read('GMAIL_USER');
  if (!key || !from) return null;
  /*  Gmail's SMTP username is the full address and is usually the same as the
   *  from address, but GMAIL_USER wins when both exist: it is the account
   *  the app password belongs to, and that is what authenticates.
   *
   *  bareAddress, because MAIL_FROM is exactly the variable somebody sets to
   *  `Slippery <post@example.com>`. That is a correct From header and a
   *  username that authenticates as nobody. */
  return { key: normaliseAppPassword(key), from, user: bareAddress(read('GMAIL_USER') ?? from) };
}

/*  A Google App Password is sixteen lowercase letters and Google's dialog
 *  shows it in four groups of four with spaces between them. Copying what is
 *  on the screen is the normal thing to do, and Gmail then answers
 *  535 5.7.8 to the spaced version: the spaces are presentation, not password.
 *
 *  Stripped only when the value is exactly that shape, so a genuine
 *  passphrase for some other SMTP host keeps every character it was given. An
 *  operator who has to be told "remove the spaces" is an operator who spent an
 *  evening on a rejection that names no cause. */
const APP_PASSWORD = /^[a-z]{4}(?:[ \t]?[a-z]{4}){3}$/;

function normaliseAppPassword(key: string): string {
  return APP_PASSWORD.test(key) ? key.replace(/[ \t]/g, '') : key;
}

/** True when the credential is shaped like a Google App Password. Reported by
 *  /api/sources as a BOOLEAN so an operator can tell "you pasted your account
 *  password" from "the app password is wrong" without anybody reading it. */
export function appPasswordShaped(): boolean {
  const c = emailCredentials();
  return c !== null && /^[a-z]{16}$/.test(c.key);
}

export type Capability = {
  id: string;
  label: string;
  ready: boolean;
  /** What happens when it is not ready. Honest degradation, named. */
  without: string;
  needs: EnvName[];
  /** How to configure it, when the names alone are not enough. */
  note?: string;
};

export function capabilities(): Capability[] {
  return [
    {
      id: 'database', label: 'The ledger',
      ready: has('DATABASE_URL'),
      without: 'The app renders from the example account and every write answers 503 honestly.',
      needs: ['DATABASE_URL'],
    },
    {
      id: 'sessions', label: 'Sign in',
      ready: has('AUTH_SECRET'),
      without: 'Sessions fall back to a development secret, which is fine locally and not in production.',
      needs: ['AUTH_SECRET'],
    },
    {
      id: 'google', label: 'Google sign in',
      ready: has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET'),
      without: 'The Google button says it is not set up rather than failing on the redirect.',
      needs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
    {
      id: 'stripe', label: 'Payments',
      ready: has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_MONTHLY') && has('STRIPE_PRICE_YEARLY'),
      without: 'Checkout says payments are not set up. Nothing is charged and no plan is started.',
      needs: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY'],
    },
    {
      id: 'stripe-webhook', label: 'Payment webhooks',
      ready: has('STRIPE_WEBHOOK_SECRET'),
      without: 'The webhook rejects every call, which is the safe direction.',
      needs: ['STRIPE_WEBHOOK_SECRET'],
    },
    {
      id: 'telegram', label: 'The Telegram bot',
      ready: has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_WEBHOOK_SECRET'),
      without: 'The webhook 401s everything, which is the safe direction: nobody guessing the URL can write into a ledger.',
      needs: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'],
    },
    {
      id: 'reader', label: 'Slip reading',
      ready: Boolean(visionKey()),
      without: 'Uploads say slip reading is down and nothing is lost. Typing a bet in still works.',
      needs: ['VISION_API_KEY', 'ANTHROPIC_API_KEY'],
    },
    {
      id: 'email', label: 'Transactional email',
      ready: emailCredentials() !== null,
      without: 'Verification codes are not sent. They are still never logged.',
      needs: ['EMAIL_API_KEY', 'EMAIL_FROM'],
      note: 'Gmail over SMTP with a Google App Password, which needs 2-Step Verification on that account. GMAIL_APP_PASSWORD, MAIL_FROM and GMAIL_USER are read as aliases of EMAIL_API_KEY and EMAIL_FROM, so either set works and the explicit one wins. GMAIL_USER is the SMTP username and the envelope sender; the From header carries EMAIL_FROM or MAIL_FROM, which Gmail rewrites to the account unless it is a verified Send mail as alias. EMAIL_SMTP_HOST defaults to smtp.gmail.com and EMAIL_SMTP_PORT to 465, which is TLS from the first byte; 587 and 25 upgrade with STARTTLS and refuse to send at all if the host does not offer it. A key starting re_ goes through Resend instead. docs/EMAIL.md is the whole procedure.',
    },
    {
      id: 'admin', label: 'Admin levers',
      ready: has('ADMIN_SECRET'),
      without: 'The reset and webhook levers refuse every call.',
      needs: ['ADMIN_SECRET'],
    },
    {
      id: 'cron', label: 'The scheduled sweep',
      ready: has('CRON_SECRET'),
      without: 'The sweep accepts unsigned calls, which is not acceptable in production.',
      needs: ['CRON_SECRET'],
    },
  ];
}
