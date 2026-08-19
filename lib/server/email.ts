/* Pure validation, no environment and no connection, so the tests import it
   directly. The one function that reaches the network reads its key inside
   the call rather than at module scope. */

/* A real email address, checked properly.
 *
 * The old app accepted `a@b..com`. This is not a regex trying to be RFC 5322;
 * it is the set of rules that reject the addresses people actually mistype,
 * plus the ones that would bounce. */
export function validEmail(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const email = input.trim();
  if (email.length < 6 || email.length > 254) return false;
  if (/\s/.test(email)) return false;

  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;

  if (domain.length > 253) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  /* The exact case the old validator let through. */
  if (domain.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[A-Za-z0-9-]+$/.test(label)) return false;
  }
  /* A bare numeric TLD is never a real one. */
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) return false;

  return true;
}

/* Password rules, stated once, so the live ticks on the signup screen and the
   server cannot disagree about what a valid password is. */
export const PASSWORD_RULES = [
  { id: 'len', label: '8 characters', test: (p: string) => p.length >= 8 },
  { id: 'cap', label: 'one capital', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'sym', label: 'one special', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordProblems = (password: string) =>
  PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);

type Mail = { to: string; subject: string; text: string };

/* Transactional email. Without a key the message is dropped rather than
   thrown, because a missing key must not make signup fail in a preview
   deployment, and the code is never written to a log either way. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const key = process.env.EMAIL_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Slippery <no-reply@slippery.app>',
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
