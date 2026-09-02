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
| `EMAIL_API_KEY` | transactional email: the Google App Password |
| `EMAIL_FROM` | the From address on transactional email |
| `ADMIN_SECRET` | admin-only endpoints |
| `ADMIN_PROMO_CODE` | admin-issued promo code |
| `CRON_SECRET` | authenticating scheduled invocations |
| `NEXT_PUBLIC_APP_URL` | absolute base URL; **public, reaches the browser** |

## Email, set by hand before the code existed

The same three things under different names. Either set works and `EMAIL_*`
wins where both are set. `docs/EMAIL.md` is the whole procedure.

| Variable | For |
|---|---|
| `GMAIL_APP_PASSWORD` | alias of `EMAIL_API_KEY` |
| `MAIL_FROM` | alias of `EMAIL_FROM` |
| `GMAIL_USER` | the Google account the app password belongs to; the SMTP username and the envelope sender |
| `EMAIL_SMTP_HOST` | optional, defaults to `smtp.gmail.com` |
| `EMAIL_SMTP_PORT` | optional, defaults to `465` |

Three notes worth carrying:

- `VISION_API_KEY` and `ANTHROPIC_API_KEY` are the same kind of key. The server
  read `VISION_API_KEY ?? ANTHROPIC_API_KEY` so a rename would not take the
  deployment down. Keep or drop that fallback deliberately.
- The email credential must be a Google **App Password**, which only exists on
  an account with 2-Step Verification on. Google has not accepted an ordinary
  account password over SMTP since May 2022.
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
