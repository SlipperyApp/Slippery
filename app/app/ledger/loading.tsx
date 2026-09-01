import { Skeleton } from '@/components/app/Skeleton';

/* A ledger is a list, so its outline is a list. */
export default function Loading() {
  return <Skeleton shape="list" />;
}
