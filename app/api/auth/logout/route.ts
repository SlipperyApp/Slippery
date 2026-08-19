import { destroySession } from '@/lib/server/session';
import { ok } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  return ok({ signedOut: true });
}
