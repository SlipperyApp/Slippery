import 'server-only';
import Stripe from 'stripe';
import { PRICES, type PlanKey } from '@/lib/server/billing';
import { env } from '@/lib/server/env';

/* WHAT THIS DEPLOYMENT NEEDS FROM STRIPE, RESOLVED RATHER THAN CONFIGURED.
 *
 * The only variable that has to be set is STRIPE_SECRET_KEY. Everything else
 * — which price is the monthly one, which configuration the billing portal
 * runs on — is looked up from the account at first use and held for the life
 * of the lambda.
 *
 * Price IDs were previously two more environment variables. They are not
 * secrets, they change whenever the account is recreated, and a missing one
 * failed at the moment somebody pressed Subscribe rather than at deploy. A
 * lookup key is stable, lives on the price itself, and is the thing Stripe
 * provides for exactly this.
 */

const LOOKUP: Record<PlanKey, string> = {
  monthly: 'slippery_monthly',
  yearly: 'slippery_yearly',
};

let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = env.stripeSecretKey();
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

const priceCache = new Map<PlanKey, string>();

/** The price id for a plan, or null if the account does not carry it. */
export async function priceFor(stripe: Stripe, plan: PlanKey): Promise<string | null> {
  const override = plan === 'monthly'
    ? process.env.STRIPE_PRICE_MONTHLY
    : process.env.STRIPE_PRICE_YEARLY;
  if (override) return override;

  const cached = priceCache.get(plan);
  if (cached) return cached;

  const found = await stripe.prices.list({ lookup_keys: [LOOKUP[plan]], active: true, limit: 1 });
  const price = found.data[0] ?? await createPrice(stripe, plan);
  if (!price) return null;

  /* THE PRODUCT AND THE PAYMENT PAGE MUST AGREE ON THE PRICE. Two places
     state it — billing.ts, which every screen reads, and Stripe, which
     charges the card. If they disagree, somebody is quoted one figure and
     billed another, so this refuses rather than charges. */
  if (price.unit_amount !== PRICES[plan].pence) {
    throw new Error(
      `Stripe price ${LOOKUP[plan]} is ${price.unit_amount} but the product quotes ` +
      `${PRICES[plan].pence}. Refusing to charge a figure the interface does not show.`);
  }

  priceCache.set(plan, price.id);
  return price.id;
}

let portalConfig: string | null = null;

/* THE PORTAL NEEDS A CONFIGURATION AND WILL NOT INVENT ONE.
 *
 * A test-mode account with no configuration answers every portal session
 * with an error, which reaches somebody as "could not open the billing page"
 * with nothing they can do about it. Reuse the account's configuration if it
 * has one — a configuration set by hand in the dashboard wins, because
 * somebody chose it — and otherwise create the one this product needs.
 *
 * Cancellation is at period end, never immediate: the brief is explicit that
 * betting history is never taken away for non-payment, and ending a period
 * somebody paid for is the same kind of wrong. */
export async function portalConfigurationId(stripe: Stripe): Promise<string | undefined> {
  if (portalConfig) return portalConfig;

  const existing = await stripe.billingPortal.configurations.list({ active: true, limit: 1 });
  if (existing.data[0]) {
    portalConfig = existing.data[0].id;
    return portalConfig;
  }

  const monthly = await priceFor(stripe, 'monthly');
  const yearly = await priceFor(stripe, 'yearly');
  if (!monthly || !yearly) return undefined;

  const price = await stripe.prices.retrieve(monthly);
  const product = typeof price.product === 'string' ? price.product : price.product.id;

  const made = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Slippery — your plan, your card, your invoices.' },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'unused', 'other'],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [{ product, prices: [monthly, yearly] }],
      },
    },
  });
  portalConfig = made.id;
  return portalConfig;
}


/* ═══ THE ACCOUNT PROVISIONS ITSELF, IN TEST MODE ONLY ═══
 *
 * Setting up Stripe by hand means somebody typing 3.49 into a dashboard and
 * the product quoting £3.49 somewhere else, with nothing checking that the
 * two agree. `billing.ts` already states the figures and every screen reads
 * it, so the price is created FROM that rather than matched against it after
 * the fact, and the lookup key makes it idempotent: the second call finds
 * the first call's price.
 *
 * LIVE MODE DOES NOT DO THIS. Creating a price that will charge real cards
 * is a money decision and it belongs to a person, so a live key with no
 * price configured fails loudly and says what is missing. */
async function createPrice(stripe: Stripe, plan: PlanKey): Promise<Stripe.Price | null> {
  const key = env.stripeSecretKey() || '';
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) return null;

  const product = await slipperyProduct(stripe);
  if (!product) return null;

  return stripe.prices.create({
    product,
    currency: 'gbp',
    unit_amount: PRICES[plan].pence,
    recurring: { interval: plan === 'monthly' ? 'month' : 'year' },
    nickname: `Slippery ${plan}`,
    lookup_key: LOOKUP[plan],
  });
}

let productId: string | null = null;

/** One product, found by its metadata marker so a rename cannot orphan it. */
async function slipperyProduct(stripe: Stripe): Promise<string | null> {
  if (productId) return productId;
  const existing = await stripe.products.search({ query: `metadata['slippery']:'plan'`, limit: 1 })
    .catch(() => null);
  if (existing && existing.data[0]) {
    productId = existing.data[0].id;
    return productId;
  }
  const made = await stripe.products.create({
    name: 'Slippery',
    description:
      'Bet slip tracker. Forward a slip when you place it; Slippery reads it, ' +
      'tracks it live, settles it and shows real P/L.',
    metadata: { slippery: 'plan' },
  });
  productId = made.id;
  return productId;
}
