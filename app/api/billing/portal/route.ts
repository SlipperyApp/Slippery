import { createPortal, stripeReady } from '@/lib/server/stripe';
import { currentAccount } from '@/lib/server/auth';
import { hasDatabase, query } from '@/lib/server/db';
import { fail, limitOr429, ok } from '@/lib/server/respond';
import { read } from '@/lib/server/env';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'portal', 10, 900);
  if (limited) return limited;

  if (!stripeReady()) {
    return fail(503, 'stripe_not_configured', 'Payments are not set up on this deployment, so nothing was charged.');
  }
  const account = await currentAccount();
  if (!account) return fail(401, 'no_session', 'Sign in first.');
  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database.');

  const rows = await query<{ stripe_customer_id: string | null }>(
    'select stripe_customer_id from accounts where id = $1', [account.id],
  );
  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    return fail(409, 'no_customer', 'There is no card on this account yet. Start a plan instead.');
  }

  try {
    const base = read('NEXT_PUBLIC_APP_URL') ?? new URL(req.url).origin;
    const portal = await createPortal({ customerId, baseUrl: base });
    return ok({ url: portal.url });
  } catch {
    return fail(502, 'stripe_error', 'The payment provider refused that. Nothing was charged.');
  }
}
