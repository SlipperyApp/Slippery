'use client';

/* The bridge between the render layer and Next.js.
 *
 * The prototype painted into a fixed phone frame and kept its whole state in
 * one mutable object. Two things had to change for a real deployment and only
 * two: the frame becomes the page, and `go()` becomes a route push, so every
 * screen has an address. Everything the layer draws is unchanged.
 */

import { useEffect, useRef, useState } from 'react';
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
            tutorialSteps: a.tutorialSteps,
            hydrateLedger: a.hydrateLedger,
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
      {/* 24 · `.ph` was an empty themed rectangle until the render layer
          mounted, so the first frame was a blank box. A skeleton of the two
          pieces of chrome that are on every screen — the bar and the nav —
          costs nothing and means the frame appears immediately. The layer
          replaces the whole subtree on mount, so this can never go stale. */}
      <div className="ph" id="ph" data-t="carbon" ref={host}>
        {/* 60 · A SKELETON WITH THE SAME BOX MODEL AS WHAT IT REPLACES.
            This was the two pieces of chrome and one empty themed box for
            everything between them, so every module appeared at once and the
            page jumped when data landed. The shapes below are the dashboard's
            first two cards at their real heights and gaps, so the layout it
            hands over to is the layout that was already there.

            It never flickers: `.skel` holds opacity 0 for its first 200ms, so
            a render that beats the delay paints no skeleton at all. The whole
            subtree is replaced on mount, so it cannot go stale. */}
        <div className="phskel" aria-hidden="true">
          <div className="skbar" />
          <div className="sknav" />
          <div className="skbody">
            <div className="skcard">
              <div className="skel skel-lbl" />
              <div className="skel skel-fig" />
              <div className="skel skel-sub" />
              <div className="skel skel-bar" />
            </div>
            <div className="skpair">
              <div className="skcard skcal">
                <div className="skel skel-lbl" />
                <div className="skgrid">
                  {Array.from({ length: 28 }, (_, i) => <div className="skel skcell" key={i} />)}
                </div>
              </div>
              <div className="skcard">
                <div className="skel skel-lbl" />
                <div className="skelrows">
                  {Array.from({ length: 4 }, (_, i) => <div className="skel skel-row" key={i} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ViewportToggle />
    </div>
  );
}

/* 31 · TEMPORARY — DELETE BEFORE LAUNCH.
 *
 * Forces the phone layout inside a desktop window so both can be reviewed
 * side by side without a device. It sets one attribute on <html>; the whole
 * behaviour lives in the `[data-force=mobile]` block in proto.css. It hides
 * itself below 1000px, where the real phone layout is already what you get.
 * There is no persistence on purpose: a reload returns to the true layout,
 * so nobody can leave it switched on and mistake it for a bug. */
function ViewportToggle() {
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  useEffect(() => {
    const r = document.documentElement;
    if (mode === 'mobile') r.setAttribute('data-force', 'mobile');
    else r.removeAttribute('data-force');
    /* The render layer measures the nav and the snap track off real widths,
       so it has to be told the box changed. */
    window.dispatchEvent(new Event('resize'));
  }, [mode]);
  /* An <aside> rather than a <div>, so the control sits inside a landmark.
     axe's `region` rule counts focusable content outside one as a violation,
     and this floats above the page at desktop widths. */
  return (
    <aside className="vptoggle" aria-label="Preview width">
      <button type="button" aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}>
        Desktop
      </button>
      <button type="button" aria-pressed={mode === 'mobile'} onClick={() => setMode('mobile')}>
        Mobile
      </button>
    </aside>
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

    /* THE WORKED EXAMPLE IS FOR SOMEBODY WHO IS NOT SIGNED IN.
       Once there is an account, every figure has to be that account's,
       including the empty answer. Preferences alone were being hydrated,
       so a signed-in person saw the prototype's good month as their own
       ledger. */
    const replaced = await a.hydrateLedger();
    if (replaced) a.repaint();
  } catch {
    /* Offline is a state the product already draws, not an error to throw. */
  }
}
