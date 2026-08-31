import { createCheckout, stripeReady } from '@/lib/server/stripe';
import { currentAccount } from '@/lib/server/auth';
import { hasDatabase, query } from '@/lib/server/db';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { read } from '@/lib/server/env';
import { TRIAL_DAYS } from '@/lib/domain/trial';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'checkout', 10, 900);
  if (limited) return limited;

  const plan = str((await readJson(req)).plan) === 'monthly' ? 'monthly' : 'yearly';

  if (!stripeReady()) {
    return fail(503, 'stripe_not_configured',
      'Payments are not set up on this deployment, so nothing was charged and no plan was started.');
  }
  const account = await currentAccount();
  if (!account) return fail(401, 'no_session', 'Sign in first. Nothing was charged.');

  const base = read('NEXT_PUBLIC_APP_URL') ?? new URL(req.url).origin;
  try {
    const session = await createCheckout({
      plan, baseUrl: base, accountId: account.id, email: account.email, trialDays: TRIAL_DAYS,
    });
    if (hasDatabase()) {
      await query('update accounts set plan = $1, updated_at = now() where id = $2', [plan, account.id]);
    }
    return ok({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'stripe_not_configured') {
      return fail(503, 'stripe_not_configured', 'Payments are not set up on this deployment.');
    }
    return fail(502, 'stripe_error', 'The payment provider refused that. Nothing was charged.');
  }
}
