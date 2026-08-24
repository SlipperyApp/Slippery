import Link from 'next/link';
import './proto.css';

/* The 404 is part of the product, not a default page in a different
   typeface. It says what happened in one line and offers the two places
   anybody arriving here actually wants.

   It also used to link to /dashboard, which is not a route — a broken link
   on the page somebody reaches by following a broken link. */
export default function NotFound() {
  return (
    <div className="stage">
      <div className="ph" data-t="periwinkle">
        <main className="body">
          <div className="pane" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>That page is not here</h1>
            <p className="lsub" style={{ margin: '0 auto 22px', maxWidth: '34ch' }}>
              The link may be old, or the address may have a typo in it. Nothing in your
              ledger has changed.
            </p>
            <Link className="btn" href="/app" style={{ display: 'block', maxWidth: 280, margin: '0 auto 10px' }}>
              Go to your dashboard
            </Link>
            <Link className="lnk" href="/">Back to the start</Link>
          </div>
        </main>
      </div>
    </div>
  );
}
