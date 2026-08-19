import { viewer } from '@/lib/server/session';
import { trialState } from '@/lib/server/promo';
import { ok, publicUser } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await viewer();
  if (!account) return ok({ user: null });
  return ok({
    user: publicUser(account),
    /* The client is told what the trial state is rather than working it out,
       so the counter on the dashboard cannot disagree with what blocks an
       upload. */
    trial: trialState(account),
  });
}
