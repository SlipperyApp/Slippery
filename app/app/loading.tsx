import { Skeleton } from '@/components/app/Skeleton';

/*  The fallback for /app and for every segment under it that does not name
 *  its own. The dashboard is what /app is, and it is also the shape a
 *  reader is most likely to be arriving at, so this is the dashboard's
 *  outline: hero, calendar, running.
 *
 *  The chrome is NOT in here. The layout above has already rendered the top
 *  bar, the sidebar and the tab bar by the time this shows, which is the
 *  point of putting the boundary at this level: on a move between app pages
 *  the frame stays put and only the work area changes. */
export default function Loading() {
  return <Skeleton shape="dashboard" />;
}
