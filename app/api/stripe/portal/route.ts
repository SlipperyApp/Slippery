import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { env } from '@/lib/server/env';
import { ok, fail, unauthorised, noDatabase } from '@/lib/server/http';
import { stripeClient, portalConfigurationId } from '@/lib/server/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* STRIPE'S BILLING PORTAL, SO PLAN CHANGES AND CANCELLATION ARE REAL.
 *
 * The alternative is a card form on this origin, which puts the whole
 * deployment inside PCI scope and reimplements SCA, 3DS, Apple Pay and
 * Google Pay badly. The portal does all of it, and it is Stripe's problem
 * to keep current with card network rules.
 *
 * A portal session is short lived and single use, so the URL is generated
 * per click and never stored.
 */
export async function POST() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const stripe = stripeClient();
  if (!stripe) return fail(503, 'Payments are not set up on this deployment yet.');

  let customerId = account.stripeCustomerId;
  if (!customerId) {
    /* Somebody who never reached checkout has no customer yet. Creating one
       here means the portal still opens and shows an empty billing history
       rather than an error. */
    const customer = await stripe.customers.create({
      email: account.email,
      metadata: { accountId: account.id },
    });
    customerId = customer.id;
    await getDb().update(schema.accounts).set({ stripeCustomerId: customerId })
      .where(eq(schema.accounts.id, account.id));
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: await portalConfigurationId(stripe),
      return_url: env.appUrl() + '/app/settings/plan',
    });
    return ok({ url: session.url });
  } catch {
    /* Never Stripe's message: it can name the customer and the account. */
    return fail(502, 'Could not open the billing page just now. Try again shortly.');
  }
}
