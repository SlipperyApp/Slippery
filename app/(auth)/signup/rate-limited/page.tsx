import type { Metadata } from 'next';
import { RateLimited } from '@/components/auth/RateLimited';

export const metadata: Metadata = {
  title: 'Too many attempts',
  description: 'A real countdown, and what to do while it runs down.',
  alternates: { canonical: '/signup/rate-limited' },
  robots: { index: false, follow: true },
};

export default async function RateLimitedPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const wait = Number(Array.isArray(sp.wait) ? sp.wait[0] : sp.wait) || 60;
  const from = (Array.isArray(sp.from) ? sp.from[0] : sp.from) ?? 'signup';
  return <RateLimited seconds={Math.min(3600, Math.max(1, wait))} from={from} />;
}
