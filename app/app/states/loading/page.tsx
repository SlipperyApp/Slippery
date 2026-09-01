import type { Metadata } from 'next';
import { Skeleton } from '@/components/app/Skeleton';

export const metadata: Metadata = {
  title: 'While a page is loading',
  description: 'The outline the app shows between a tap and the data arriving.',
};

/*  The loading state, standing still so it can be looked at.
 *
 *  Every other state in this folder is here for the same reason: a state you
 *  can only reach by breaking something is a state nobody reviews. The
 *  skeleton is the extreme case: it exists for a few hundred milliseconds
 *  and only when the database is slow, so without this route the only way to
 *  see it is to make the database slow.
 *
 *  It is the same component the real boundaries render, not a copy of it, so
 *  this page cannot drift away from what /app actually shows. It also means
 *  the sweep measures the skeleton's contrast and its overflow at every
 *  width and in all eight themes, which is the whole argument for it being a
 *  route rather than a screenshot. */
export default function LoadingState() {
  return (
    <>
      <h1 className="sr-only">Loading state</h1>
      <Skeleton shape="dashboard" />
    </>
  );
}
