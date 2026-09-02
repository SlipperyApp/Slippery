'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Open one balance from the sheet.
 *
 *  The same cookie the top bar's switcher writes, because there is one
 *  answer to "which books am I looking at" and two controls that set it. A
 *  link with a query parameter would be a second answer, and the two would
 *  disagree the moment somebody bookmarked one. */
export function OpenBalance({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      onClick={() => {
        document.cookie = `slip_balance=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
        router.push('/app');
        router.refresh();
      }}
    >
      Open<span className="sr-only"> {name}</span> <Icon name="arrowRight" size={14} />
    </button>
  );
}
