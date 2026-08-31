export const SIGNUP_STEPS = [
  { href: '/signup', label: 'Account' },
  { href: '/signup/verify', label: 'Code' },
  { href: '/signup/name', label: 'You' },
  { href: '/signup/unit', label: 'Unit' },
  { href: '/signup/sports', label: 'Sports' },
  { href: '/signup/plan', label: 'Plan' },
];

export function Steps({ current }: { current: number }) {
  return (
    <div style={{ marginBottom: 'var(--s6)' }}>
      <div className="spread" style={{ marginBottom: 'var(--s2)' }}>
        <p className="label">Step {current} of {SIGNUP_STEPS.length}</p>
        <p className="label">{SIGNUP_STEPS[current - 1]?.label}</p>
      </div>
      <div
        className="steps"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={SIGNUP_STEPS.length}
        aria-valuenow={current}
        aria-label="Sign up progress"
      >
        {SIGNUP_STEPS.map((s, i) => (
          <span key={s.href} className={`steps__pip${i < current ? ' steps__pip--on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
