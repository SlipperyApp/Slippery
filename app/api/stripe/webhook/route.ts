import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { env } from '@/lib/server/env';
import { afterPaymentFailure, PLAN_AT_TRIAL_END } from '@/lib/server/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Stripe's own account of what happened, verified before it is believed.
 *
 * An unsigned webhook is a way for anybody to mark any account as paid, so
 * the signature check is not optional and there is no development bypass. */
export async function POST(req: NextRequest) {
  const key = env.stripeSecretKey();
  const secret = env.stripeWebhookSecret();
  if (!key || !secret) return NextResponse.json({ ok: true });

  const raw = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!dbReady()) return NextResponse.json({ received: true });
  const db = getDb();

  const byCustomer = async (customerId: string) => {
    const rows = await db.select().from(schema.accounts)
      .where(eq(schema.accounts.stripeCustomerId, customerId)).limit(1);
    return rows[0] ?? null;
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const accountId = s.metadata?.accountId;
      if (accountId) {
        await db.update(schema.accounts).set({
          stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : null,
          plan: (s.metadata?.plan as string) || PLAN_AT_TRIAL_END,
          planState: 'active',
          paymentFailures: 0,
        }).where(eq(schema.accounts.id, accountId));
      }
      break;
    }

    case 'customer.subscription.trial_will_end':
      /* Deliberately nothing. There is no trial-end reminder: it was decided
         against, and sending one here would reintroduce it quietly. */
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const account = await byCustomer(String(sub.customer));
      if (account) {
        const active = ['active', 'trialing'].includes(sub.status);
        await db.update(schema.accounts).set({
          planState: active ? (sub.status === 'trialing' ? 'trialing' : 'active') : account.planState,
          paymentFailures: active ? 0 : account.paymentFailures,
        }).where(eq(schema.accounts.id, account.id));
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const account = await byCustomer(String(sub.customer));
      /* Cancelled, not deleted. The ledger and the export stay live: a
         betting record belongs to the person who kept it. */
      if (account) {
        await db.update(schema.accounts).set({ planState: 'cancelled' })
          .where(eq(schema.accounts.id, account.id));
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const account = await byCustomer(String(invoice.customer));
      if (account) {
        const failures = account.paymentFailures + 1;
        const next = afterPaymentFailure(failures);
        await db.update(schema.accounts).set({
          paymentFailures: failures,
          planState: next.planState,
        }).where(eq(schema.accounts.id, account.id));
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const account = await byCustomer(String(invoice.customer));
      /* A working card reverses read only. */
      if (account) {
        await db.update(schema.accounts).set({ paymentFailures: 0, planState: 'active' })
          .where(eq(schema.accounts.id, account.id));
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
