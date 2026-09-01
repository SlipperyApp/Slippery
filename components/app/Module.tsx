import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** One fixed layout. No edit overview, no packer, no pinning, no drag
 *  reorder. Every module has a fixed column span and a fixed height token,
 *  so rows match by construction rather than by stretching.
 *
 *  A module states what it means or it does not ship. That is a figure and a
 *  label, with the figure leading: definition survives, interpretation does
 *  not. */
export function Module({
  title, span = 4, size = 'm', note, children, footer, id, tools,
}: {
  title: string;
  span?: 4 | 5 | 6 | 7 | 8 | 12;
  size?: 's' | 'm' | 'l' | 'xl' | 'xxl';
  /** Exactly three modules ignore the scope bar and say so here. */
  note?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  id?: string;
  /** The corner: a ⋯ menu, a share control, whatever this module needs.
   *  Anything a module can be adjusted by lives HERE, not above its content,
   *  so the module shows the thing it is for and nothing else. */
  tools?: React.ReactNode;
}) {
  return (
    <section className={`card col-${span} h-${size}`} aria-labelledby={id ? `${id}-t` : undefined} id={id}>
      <header className="card__head">
        <h2 className="card__title" id={id ? `${id}-t` : undefined}>{title}</h2>
        <div className="card__tools">
          {note ? <p className="card__note">{note}</p> : null}
          {tools}
        </div>
      </header>
      <div className="grow" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {footer ? <div className="card__foot">{footer}</div> : null}
    </section>
  );
}

export function ModuleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s1)', minHeight: 44, textDecoration: 'none', color: 'var(--accent-2)' }}>
      {children} <Icon name="arrowRight" size={14} />
    </Link>
  );
}

/** The figure leads, the label captions it. A 16px title at 600 against a
 *  34px figure at 800 is the separation, and the weight drop does more work
 *  than the size does. */
export function Figure({
  value, label, tone, sub, size = 'lg',
}: {
  value: string;
  label: string;
  tone?: '' | 'pos' | 'neg';
  sub?: string;
  size?: 'lg' | 'md' | 'sm';
}) {
  const cls = size === 'lg' ? 'fig' : size === 'md' ? 'fig fig--m' : 'fig fig--s';
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`${cls} ${tone ?? ''}`}>{value}</p>
      {sub ? <p className="small dim" style={{ marginTop: 4 }}>{sub}</p> : null}
    </div>
  );
}
