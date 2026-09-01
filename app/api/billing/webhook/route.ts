import { NextResponse } from 'next/server';
import { verifyStripeSignature, planStateAfterFailure, accountRoutes } from '@/lib/server/stripe';
import { hasDatabase, query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stripe's webhook.
 *
 *  The signature is verified before anything is read out of the body. An
 *  unverified webhook is a way for anybody to mark any account as paid.
 *
 *  RESOLVING THE ACCOUNT, which is the part that was wrong.
 *
 *  Only two of the four events carry a route back to an account:
 *
 *    checkout.session.completed     Session, has client_reference_id
 *    customer.subscription.deleted  Subscription, has metadata.account_id
 *                                   because checkout set subscription_data
 *    invoice.payment_succeeded      Invoice. Has NEITHER.
 *    invoice.payment_failed         Invoice. Has NEITHER.
 *
 *  Stripe does not copy subscription metadata onto an invoice, so reading
 *  client_reference_id or metadata.account_id off an invoice gets an empty
 *  string every time. Both invoice branches were therefore dead: a paid
 *  invoice never moved an account to active, and a FAILED one never counted
 *  towards the two attempt rule, which is the whole billing safety net.
 *
 *  An invoice does carry `customer` and `subscription`, and both are stored
 *  on the account at checkout.session.completed. So the account is looked up
 *  by those, and the metadata path stays for the events that have it. */
export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!verifyStripeSignature(payload, sig)) {
    // 400 rather than 401: Stripe reads this as "do not retry, it was wrong".
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try { event = JSON.parse(payload); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const type = event.type ?? '';
  const object = event.data?.object ?? {};

  if (!hasDatabase()) {
    // Answer 200 anyway: a retry storm helps nobody and there is nothing to
    // write to.
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    /*  Idempotency, and it only matters for one branch. Everything else here
     *  SETS a state, so a duplicate is harmless; failed_payments INCREMENTS,
     *  and a duplicate of that event puts a paying account into read only
     *  after one real failure. */
    if (event.id) {
      const first = await query<{ event_id: string }>(
        `insert into stripe_events (event_id, type) values ($1, $2)
           on conflict (event_id) do nothing
           returning event_id`,
        [event.id, type],
      );
      if (first.length === 0) return NextResponse.json({ ok: true, duplicate: true });
    }

    const accountId = await resolveAccount(object);
    if (!accountId) return NextResponse.json({ ok: true, stored: false });

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

/** The account this event is about, by whichever route the object offers.
 *
 *  Checked in order of directness: an id the object states outright, then the
 *  subscription it belongs to, then the customer. */
async function resolveAccount(object: Record<string, unknown>): Promise<string> {
  const { stated, subscription, customer } = accountRoutes(object);
  if (stated) return stated;

  if (subscription) {
    const rows = await query<{ id: string }>(
      'select id from accounts where stripe_subscription_id = $1 limit 1', [subscription],
    );
    if (rows[0]) return rows[0].id;
  }

  if (customer) {
    const rows = await query<{ id: string }>(
      'select id from accounts where stripe_customer_id = $1 limit 1', [customer],
    );
    if (rows[0]) return rows[0].id;
  }

  return '';
}
