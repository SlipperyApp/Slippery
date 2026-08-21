'use client';

/* The bridge between the render layer and Next.js.
 *
 * The prototype painted into a fixed phone frame and kept its whole state in
 * one mutable object. Two things had to change for a real deployment and only
 * two: the frame becomes the page, and `go()` becomes a route push, so every
 * screen has an address. Everything the layer draws is unchanged.
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { pathForView, viewForPath, sectionForPath } from '@/lib/proto/routes';
import type { ProtoApi } from '@/lib/proto/types';

export function AppShell() {
  const host = useRef<HTMLDivElement | null>(null);
  const api = useRef<ProtoApi | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  /* Held in a ref rather than in state: `go()` runs inside the render layer,
     which must not cause a React render, or the layer would be torn down and
     rebuilt on every navigation and lose its scroll position. */
  const applying = useRef(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    import('@/lib/proto/runtime.js').then(({ mountProto }) => {
      if (cancelled || !host.current) return;
      dispose = mountProto(host.current, {
        onReady(a: ProtoApi) {
          api.current = a;
          /* The audit drives the product through the same entry points the
             interface uses, rather than hunting for selectors that a copy
             change would break. Exposed on purpose and harmless: everything
             here is already reachable by clicking. */
          (window as unknown as { __slippery: unknown }).__slippery = {
            go: a.go,
            sheet: a.sheet,
            closeSheet: a.closeSheet,
            repaint: a.repaint,
            setTheme: a.setTheme,
            startTutorial: a.startTutorial,
            setHeroAnim: a.setHeroAnim,
            /* The live state object, not a copy: the audit changes a setting
               and repaints, which is what the interface does, rather than
               reaching for a control whose selector a copy change would
               break. */
            cur: a.cur,
            sheetKeys: Object.keys(a.sheets),
            viewKeys: Object.keys(a.views),
          };
          hydrateFromServer(a);
          a.go(viewForPath(window.location.pathname));
          /* A path naming a landing section renders the landing page and
             then scrolls to it, so a pricing link in an email arrives at
             pricing rather than at the top. */
          const section = sectionForPath(window.location.pathname);
          if (section) {
            requestAnimationFrame(() => {
              const target = document.querySelector(`[data-sec="${section}"]`);
              if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
            });
          }
        },
        onView(view: string) {
          const next = pathForView(view);
          if (applying.current) return;
          if (window.location.pathname !== next) {
            window.history.pushState({}, '', next);
          }
        },
      });
    });

    return () => {
      cancelled = true;
      if (dispose) dispose();
    };
  }, []);

  /* Back and forward. The layer is told to repaint the view the URL now names,
     with the push suppressed so the two cannot chase each other. */
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const want = viewForPath(pathname);
    if (a.cur.view === want) return;
    applying.current = true;
    a.go(want);
    applying.current = false;
  }, [pathname]);

  useEffect(() => {
    const onPop = () => {
      const a = api.current;
      if (!a) return;
      applying.current = true;
      a.go(viewForPath(window.location.pathname));
      applying.current = false;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="stage">
      <div className="ph" id="ph" data-t="carbon" ref={host} />
    </div>
  );
}

/* Real figures replace the worked example the moment the server says who this
   is. An unauthenticated visitor keeps the example, which is what the landing
   page and the demo account are for; nothing else may ever see it. */
async function hydrateFromServer(a: ProtoApi) {
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (!r.ok) return;
    const body = await r.json();
    if (!body.user) return;
    a.hydrate({
      signedIn: true,
      theme: body.user.theme || 'carbon',
      oddsFmt: body.user.oddsFormat || 'Decimal',
      showIn: body.user.showProfitIn || 'Currency',
      weekStart: body.user.weekStart ?? 1,
      calDates: body.user.calendarDates ?? true,
    });
    a.setTheme(body.user.theme || 'carbon');
  } catch {
    /* Offline is a state the product already draws, not an error to throw. */
  }
}
