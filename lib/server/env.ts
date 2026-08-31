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
  ADMIN_SECRET: () => process.env.ADMIN_SECRET,
  ADMIN_PROMO_CODE: () => process.env.ADMIN_PROMO_CODE,
  CRON_SECRET: () => process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: () => process.env.NEXT_PUBLIC_APP_URL,
};

export function has(name: EnvName): boolean {
  const v = READERS[name]();
  return typeof v === 'string' && v.trim().length > 0;
}

export function read(name: EnvName): string | undefined {
  const v = READERS[name]();
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

/** VISION_API_KEY and ANTHROPIC_API_KEY are the same kind of key. The
 *  fallback is kept deliberately, so a rename cannot take slip reading down. */
export function visionKey(): string | undefined {
  return read('VISION_API_KEY') ?? read('ANTHROPIC_API_KEY');
}

export type Capability = {
  id: string;
  label: string;
  ready: boolean;
  /** What happens when it is not ready. Honest degradation, named. */
  without: string;
  needs: EnvName[];
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
      ready: has('EMAIL_API_KEY') && has('EMAIL_FROM'),
      without: 'Verification codes are not sent. They are still never logged.',
      needs: ['EMAIL_API_KEY', 'EMAIL_FROM'],
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
