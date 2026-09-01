'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

/** The ⋯ in the corner of a module.
 *
 *  Every module that has settings has ONE of these, and the settings live
 *  inside it. The calendar previously carried a four button segmented control
 *  above the grid, which took two rows of a narrow card and left the calendar
 *  itself 17px cells; every other module that grows a control would do the
 *  same thing to itself.
 *
 *  It is a disclosure, not a menu widget: the trigger is a button with
 *  aria-expanded and the panel is a plain region. A real menu implies
 *  arrow-key roving and a single activation per item, and what is inside here
 *  is a set of toggles you may want to change two of. */
export function ModuleMenu({
  label, children, align = 'end',
}: {
  /** What this menu belongs to, said out loud for a screen reader. */
  label: string;
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>('.modmenu__btn')?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="modmenu" ref={wrap}>
      <button
        type="button"
        className="modmenu__btn"
        aria-expanded={open}
        aria-controls={`mm-${id}`}
        aria-label={`${label} settings`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" size={16} />
      </button>

      <div
        id={`mm-${id}`}
        className={`modmenu__pop modmenu__pop--${align}`}
        role="group"
        aria-label={`${label} settings`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}

/** One labelled row of choices inside a menu. */
export function MenuChoice<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="modmenu__row">
      <p className="label">{label}</p>
      <div className="seg seg--xs" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="seg__btn"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
