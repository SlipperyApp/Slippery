# Environment

Everything the deployment needs from its environment, and the eight theme
names. Nothing else is carried forward.

**No values appear in this file, and none may ever be written into a file, a
commit, a log or a message.** The repository is public and GitHub's secret
scanner revokes exposed keys automatically. Read them from `process.env` only.

---

## Set in Vercel

Already present on the project. Names only.

| Variable | For |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | signing sessions |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | verifying Stripe webhook signatures |
| `STRIPE_PRICE_MONTHLY` | Stripe price id |
| `STRIPE_PRICE_YEARLY` | Stripe price id |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | verifying inbound Telegram webhooks |
| `VISION_API_KEY` | image/PDF extraction |
| `ANTHROPIC_API_KEY` | the key the deployment already held |
| `EMAIL_API_KEY` | transactional email |
| `EMAIL_FROM` | the From address on transactional email |
| `ADMIN_SECRET` | admin-only endpoints |
| `ADMIN_PROMO_CODE` | admin-issued promo code |
| `CRON_SECRET` | authenticating scheduled invocations |
| `NEXT_PUBLIC_APP_URL` | absolute base URL; **public, reaches the browser** |

Two notes worth carrying:

- `VISION_API_KEY` and `ANTHROPIC_API_KEY` are the same kind of key. The server
  read `VISION_API_KEY ?? ANTHROPIC_API_KEY` so a rename would not take the
  deployment down. Keep or drop that fallback deliberately.
- Only `NEXT_PUBLIC_`-prefixed variables reach the client. Every other name
  above must stay server-side.

## Injected by the platform

Present automatically on Vercel; do not set them.

`VERCEL_ENV` · `VERCEL_REGION` · `VERCEL_GIT_COMMIT_SHA` ·
`VERCEL_PROJECT_PRODUCTION_URL` · `NODE_ENV`

## Local tooling only

Optional, for local scripts. Not needed in the deployment.

`CHROME_PATH` · `OG_CHROME` · `SNAPSHOT_CHROME` · `SNAPSHOT_PORT` ·
`SHOT_DIR` · `E2E_BASE`

---

## Theme names

Eight. The names carry forward; nothing about their appearance does.

`carbon` · `periwinkle` · `ink` · `graphite` · `slate` · `bronze` ·
`cinnabar` · `liquid`

---

## Deployment facts

- Repository is **public**.
- Vercel deploys on push to `main`. A branch that is never merged is never
  deployed, whatever it contains.
