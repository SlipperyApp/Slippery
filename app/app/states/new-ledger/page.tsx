import type { Metadata } from 'next';
import { EmptyLedger } from '@/components/app/EmptyLedger';
import { emptyReason } from '@/lib/data/viewer';

export const metadata: Metadata = {
  title: 'An empty ledger',
  description: 'The ledger before the first slip: the rows ghosted, with the action on top.',
};

/*  The same component the real ledger renders when the account has no rows.
 *  Two copies of this screen were two screens that could disagree, and the
 *  one an account was actually shown was the example account's ledger. */
export default function NewLedger() {
  return <EmptyLedger reason={emptyReason(true)} />;
}
