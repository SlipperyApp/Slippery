import { NextResponse } from 'next/server';
import { verifyStripeSignature, planStateAfterFailure } from '@/lib/server/stripe';
import { hasDatabase, query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stripe's webhook.
 *
 *  The signature is verified before anything is read out of the body. An
 *  unverified webhook is a way for anybody to mark any account as paid. */
export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!verifyStripeSignature(payload, sig)) {
    // 400 rather than 401: Stripe reads this as "do not retry, it was wrong".
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(payload); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const type = event.type ?? '';
  const object = event.data?.object ?? {};
  const accountId = String(
    (object.client_reference_id as string | undefined)
    ?? ((object.metadata as Record<string, string> | undefined)?.account_id)
    ?? '',
  );

  if (!hasDatabase() || !accountId) {
    // Answer 200 anyway: a retry storm helps nobody and there is nothing to
    // write to.
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    if (type === 'checkout.session.completed') {
      await query(
        `update accounts set stripe_customer_id = $1, stripe_subscription_id = $2,
                             plan_state = 'trial', failed_payments = 0, updated_at = now()
          where id = $3`,
        [String(object.customer ?? ''), String(object.subscription ?? ''), accountId],
      );
    } else if (type === 'invoice.payment_succeeded') {
      await query(
        `update accounts set plan_state = 'active', failed_payments = 0, updated_at = now() where id = $1`,
        [accountId],
      );
    } else if (type === 'invoice.payment_failed') {
      const rows = await query<{ failed_payments: number }>(
        'update accounts set failed_payments = failed_payments + 1, updated_at = now() where id = $1 returning failed_payments',
        [accountId],
      );
      const attempts = rows[0]?.failed_payments ?? 1;
      await query('update accounts set plan_state = $1 where id = $2', [planStateAfterFailure(attempts), accountId]);
    } else if (type === 'customer.subscription.deleted') {
      // Cancelled keeps the ledger and the export. History is never deleted.
      await query(`update accounts set plan_state = 'cancelled', updated_at = now() where id = $1`, [accountId]);
    }
  } catch {
    // Still 200. Stripe retries on any non-200 and a retry cannot fix a bad
    // row here.
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true });
}
