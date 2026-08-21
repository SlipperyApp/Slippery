import 'server-only';

/* Every secret this deployment uses, named once.
 *
 * Nothing here is ever interpolated into markup, a log line, an error
 * message or a bot reply. The repository is public and GitHub's scanner
 * revokes a key the moment it appears in a commit, so a leak is not a
 * hypothetical inconvenience: it takes the product down.
 */
export const env = {
  databaseUrl: () => process.env.DATABASE_URL,
  authSecret: () => process.env.AUTH_SECRET,
  googleClientId: () => process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  stripeSecretKey: () => process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
  telegramBotToken: () => process.env.TELEGRAM_BOT_TOKEN,
  telegramWebhookSecret: () => process.env.TELEGRAM_WEBHOOK_SECRET,
  /* The brief names VISION_API_KEY. The running deployment already holds an
     Anthropic key under its own name, so both are read and whichever exists
     is used. One variable to add rather than one to rename, and no window in
     which slip reading is down. */
  visionApiKey: () => process.env.VISION_API_KEY || process.env.ANTHROPIC_API_KEY,
  emailApiKey: () => process.env.EMAIL_API_KEY,
  adminSecret: () => process.env.ADMIN_SECRET,
  /* Vercel signs its cron calls with this. */
  cronSecret: () => process.env.CRON_SECRET,
  appUrl: () =>
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : 'http://localhost:3000'),
};

/* Names only, for the diagnostics route. Never the values. */
export const SECRET_NAMES = [
  'DATABASE_URL', 'AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET', 'VISION_API_KEY', 'EMAIL_API_KEY', 'ADMIN_SECRET',
  'CRON_SECRET',
] as const;
