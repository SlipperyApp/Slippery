import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';
import { PRICES, type PlanKey } from '@/lib/server/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Choosing a plan at step six.
 *
 * Picking Monthly or Yearly outright starts that plan and charges it now.
 * Taking the trial instead starts a subscription with a trial period, and
 * when that period ends the yearly plan begins by itself. There is
 * deliberately no reminder before it does. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const key = env.stripeSecretKey();
  if (!key) return fail(503, 'Payments are not set up on this deployment yet.');

  const body = await readJson<{ plan?: PlanKey; withTrial?: boolean }>(req);
  const plan: PlanKey = body.plan === 'monthly' ? 'monthly' : 'yearly';

  const stripe = new Stripe(key);
  const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  if (!priceId) return fail(503, 'That plan is not configured on this deployment yet.');

  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account.email,
      metadata: { accountId: account.id },
    });
    customerId = customer.id;
    await getDb().update(schema.accounts).set({ stripeCustomerId: customerId })
      .where(eq(schema.accounts.id, account.id));
  }

  const trialEnd = body.withTrial && account.trialEndsAt && account.trialEndsAt > new Date()
    ? Math.floor(account.trialEndsAt.getTime() / 1000)
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    /* A card is required even for the trial, which is what makes the
       automatic start at trial end possible at all. */
    payment_method_collection: 'always',
    subscription_data: trialEnd ? { trial_end: trialEnd } : undefined,
    success_url: env.appUrl() + '/app',
    cancel_url: env.appUrl() + '/signup/plan',
    metadata: { accountId: account.id, plan },
  });

  return ok({ url: session.url });
}
