/** Stripe over fetch.
 *
 *  No SDK: three fewer packages that can drift, nothing to bundle, and the
 *  webhook signature check is thirty lines of node:crypto either way.
 *
 *  Slippery never sees or stores a card number. Everything here is a redirect
 *  to Stripe or a read of what Stripe says happened. */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { has, read } from './env';

const API = 'https://api.stripe.com/v1';

export function stripeReady(): boolean {
  return has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_MONTHLY') && has('STRIPE_PRICE_YEARLY');
}

function form(params: Record<string, string | undefined>): string {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, v);
  return body.toString();
}

async function call<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const key = read('STRIPE_SECRET_KEY');
  if (!key) throw new Error('stripe_not_configured');
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form(params),
  });
  if (!res.ok) {
    // The status is useful. The body may contain identifiers, so it is not
    // logged.
    throw new Error(`stripe_${res.status}`);
  }
  return (await res.json()) as T;
}

export type CheckoutSession = { id: string; url: string };

export async function createCheckout(opts: {
  plan: 'monthly' | 'yearly';
  baseUrl: string;
  accountId: string;
  email?: string;
  trialDays: number;
}): Promise<CheckoutSession> {
  const price = opts.plan === 'yearly' ? read('STRIPE_PRICE_YEARLY') : read('STRIPE_PRICE_MONTHLY');
  if (!price) throw new Error('stripe_not_configured');
  return call<CheckoutSession>('/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    // The card is required to start, and the plan begins automatically when
    // the trial ends.
    'subscription_data[trial_period_days]': String(opts.trialDays),
    'subscription_data[metadata][account_id]': opts.accountId,
    'payment_method_collection': 'always',
    client_reference_id: opts.accountId,
    customer_email: opts.email,
    success_url: `${opts.baseUrl}/app?checkout=done`,
    cancel_url: `${opts.baseUrl}/app/settings/plan?checkout=cancelled`,
  });
}

export async function createPortal(opts: { customerId: string; baseUrl: string }): Promise<{ url: string }> {
  return call<{ url: string }>('/billing_portal/sessions', {
    customer: opts.customerId,
    return_url: `${opts.baseUrl}/app/settings/plan`,
  });
}

/** Verify the webhook signature ourselves. An unverified webhook is a way for
 *  anybody to mark any account as paid. */
export function verifyStripeSignature(payload: string, header: string | null, toleranceSeconds = 300): boolean {
  const secret = read('STRIPE_WEBHOOK_SECRET');
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=', 2) as [string, string]).filter((p) => p.length === 2),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The two-attempt rule, in one place.
 *
 *  Attempt one fails: retry in three days, nothing changes.
 *  Attempt two fails: read only. New slips, imports and the bot pause; the
 *  ledger and the export stay fully live and NOTHING is ever deleted. */
export function planStateAfterFailure(failedAttempts: number): 'past_due' | 'read_only' {
  return failedAttempts >= 2 ? 'read_only' : 'past_due';
}
