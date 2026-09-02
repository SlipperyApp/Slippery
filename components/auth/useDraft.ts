'use client';

import { useSearchParams } from 'next/navigation';
import { readDraft, type SignupDraft } from '@/lib/signup-draft';

/** The draft, read from the address bar on the client.
 *
 *  IT IS THE CLIENT AND NOT THE SERVER PROPS, AND THAT IS THE WHOLE POINT.
 *  Measured in a real browser: with the draft written into the history entry
 *  and the address correct on every step, walking back three steps still gave
 *  three EMPTY forms. The URL was right and the markup was wrong, because a
 *  back navigation in the App Router is served from the client router cache,
 *  and the payload cached for a step is the one rendered when that step was
 *  first opened, before anything had been typed into it. A hard reload of the
 *  same address filled the form correctly, which is what named the cause.
 *
 *  Reading the address here sidesteps the cache entirely. On a fresh request
 *  the hook returns the same values the server rendered from, so the markup
 *  that arrives already has the fields filled and nothing flashes; on a back
 *  navigation it returns the restored address, which is the answers.
 *
 *  This is why the signup steps are dynamic. A client hook reading the search
 *  params on a prerendered page has to sit behind a Suspense boundary, and a
 *  boundary around the form means the prerendered HTML is a spinner where the
 *  form should be. */
export function useDraft(): SignupDraft {
  const sp = useSearchParams();
  const flat: Record<string, string> = {};
  sp.forEach((value, key) => { if (!(key in flat)) flat[key] = value; });
  return readDraft(flat);
}
