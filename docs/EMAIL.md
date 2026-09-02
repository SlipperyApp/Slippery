# Email

Signup verification, the resend, and the password reset all go out the same
way: **Gmail, over SMTP, with a Google App Password**. There is no provider
account and no third party API on this path. `lib/server/smtp.ts` is the whole
client, about three hundred lines over `node:tls`, and `lib/server/mail.ts` is
the layer above it.

**No value appears in this file and none may ever be written into a file, a
commit, a log or a message.** The repository is public and GitHub's secret
scanner revokes exposed keys automatically. Every example below is a
placeholder.

---

## The variables

Two names for each of the three things, because the deployment was configured
by hand before this code existed. Either set works. **`EMAIL_*` wins where
both are set**, so the explicit name is always the one in charge, and each
pair is resolved together so a password from one set cannot be used with an
address from the other.

| Variable | Alias | What it is |
|---|---|---|
| `EMAIL_API_KEY` | `GMAIL_APP_PASSWORD` | The 16 character Google App Password. Not the account password. |
| `EMAIL_FROM` | `MAIL_FROM` | The From header. May carry a display name. |
| | `GMAIL_USER` | The Google account the app password belongs to. The SMTP username and the envelope sender. |
| `EMAIL_SMTP_HOST` | | Optional. Defaults to `smtp.gmail.com`. |
| `EMAIL_SMTP_PORT` | | Optional. Defaults to `465`. |

The smallest working set is two variables:

```
GMAIL_USER=you@gmail.example
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

The spaces are fine. Google's dialog prints the password in four groups of
four and copying what is on the screen is the obvious thing to do, so
`emailCredentials()` strips them, but only from a value that is exactly
sixteen lowercase letters in four groups. A passphrase for some other SMTP
host keeps every character it was given.

Sending from your own domain rather than from the Gmail address is three:

```
GMAIL_USER=you@gmail.example
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=Slippery <post@your-domain.example>
```

Read the next section before doing that.

### GMAIL_USER and the From address are two different things

The envelope sender, which is what goes in `MAIL FROM` and what SPF is checked
against, is **always `GMAIL_USER`**. Gmail refuses an envelope sender that is
not the authenticated account or one of its verified aliases, so it cannot be
anything else.

The `From:` header carries `EMAIL_FROM` or `MAIL_FROM`. **Gmail rewrites that
header to the account address unless it is a verified "Send mail as" alias on
that account.** That is Google's rule and no setting here changes it. If mail
arrives showing the Gmail address when you set `MAIL_FROM` to your own domain,
add the domain address under Gmail Settings, Accounts and Import, "Send mail
as", and complete the confirmation. `GET /api/sources` reports
`email.fromIsAccount` as a boolean so you can see which case you are in
without anybody reading a value.

### The port decides how TLS starts

| Port | How |
|---|---|
| `465` | TLS from the first byte. The default, and what Gmail wants. |
| `587`, `25` | A plain socket upgraded with `STARTTLS` after `EHLO`. |

On `587` and `25` the client checks that the host actually advertised
`STARTTLS` and **stops before AUTH if it did not**. A Google App Password is
never written to a socket that is not encrypted, whatever the host claims,
and a send that stops there reports `starttls_unsupported` rather than
appearing to work.

An unparseable `EMAIL_SMTP_PORT` falls back to 465 rather than connecting to
`NaN`.

---

## Getting a Google App Password

An App Password only exists on an account with 2-Step Verification switched
on. If the option is missing, that is why.

1. Sign in to the Google account you want the mail to come from.
2. Turn on **2-Step Verification**: Google Account, Security, How you sign in
   to Google, 2-Step Verification. This is a requirement of this transport,
   not a suggestion. Google has not accepted an ordinary account password over
   SMTP since May 2022.
3. Go to Google Account, Security, **App passwords**
   (`myaccount.google.com/apppasswords`). Name it something that says where it
   is used, for instance `slippery-production`, so it can be revoked without
   guessing.
4. Google shows sixteen lowercase letters in four groups. **This is the only
   time it is shown.** Paste it straight into the environment variable, never
   into a file, a commit or a message.
5. Set `GMAIL_USER` to that account's full address, and
   `GMAIL_APP_PASSWORD` to what Google showed you.

Rotating it is: create a new one, change the variable, redeploy, then revoke
the old one in the same screen. Rotation is on the FLAG list in `CLAUDE.md`,
so ask before doing it on production.

Gmail's own sending limits apply: roughly 500 messages a day on a free
account, 2,000 on Workspace. Verification codes for a product this size sit
well under that, and the number is the reason to watch it rather than assume.

---

## Verifying it

### Without sending anything

```
curl -s https://<deployment>/api/sources | jq '.email, .variables'
```

`variables` is every environment variable this deployment has, by name, as a
boolean. `email` is the same discipline applied to this path:

| Field | True means |
|---|---|
| `configured` | A password and a from address both resolved. |
| `transport` | `smtp` for the Gmail path, `resend` for a key starting `re_`, `none` for nothing set. |
| `senderResolved` | A username was derived for the from address. |
| `fromIsAccount` | The From address is the authenticated account, so Gmail will not rewrite it. |
| `gmailHost` | `EMAIL_SMTP_HOST` is unset, so mail goes to `smtp.gmail.com`. |
| `implicitTls` | The port is TLS from the first byte rather than a STARTTLS upgrade. |
| `knownPort` | The port is 465, 587 or 25. |
| `appPasswordShaped` | The credential is sixteen lowercase letters. **False on a Gmail host almost always means an account password was pasted instead of an app password.** |

No value from `process.env` is ever returned by that route, and none of these
fields is derived from one in a way that could be read backwards.

### Reaching the host, still without sending anything

```
curl -s 'https://<deployment>/api/sources?probe=email' | jq '.email.probe'
```

That opens a socket to the configured host, negotiates TLS, reads back the
extension list and quits. **It carries no credential and sends no message.**

| Field | True means |
|---|---|
| `reachable` | The host answered with a greeting. |
| `encrypted` | The conversation is over TLS: implicit, or upgraded. |
| `authOffered` | The host offers `AUTH LOGIN`, which is the mechanism this client speaks. |

A failure adds `reason` and `detail`. `detail` is a fixed sentence from
`SMTP_DETAIL` in `lib/server/smtp.ts`, never text copied off the wire, because
a real SMTP refusal quotes the recipient address back at you.

The probe is rate limited to six calls in five minutes per address, because it
is the one branch of that route that does outbound work.

### Actually sending one

Sign up with an address you can read. The route answers
`{ "ok": true, "emailSent": true|false }`. It never says why: "Google refused
the app password" is an operator's problem and a stranger's reconnaissance.
The reason is in the deployment logs, as a `reason` from a closed vocabulary
and an SMTP status, with no address, subject, body or credential anywhere near
it.

### The tests

```
npm test
```

`tests/smtp.test.ts` runs the client against a fake SMTP server over real TLS
on localhost, with a self-signed certificate generated in-process. It asserts
the conversation happens entirely over TLS, the AUTH LOGIN sequence and its
waits, header shape, base64 line length, CRLF normalisation, dot handling,
header injection refusal on every field, that no credential leaves the process
on a host without STARTTLS, and one distinct reason for each class of failure.
Nothing there needs a credential and nothing reaches Gmail.

---

## What each failure means

`reason` from `lib/server/mail.ts` and the log line, in the order you are
likely to meet them.

| Reason | What to do |
|---|---|
| `not_configured` | Neither pair of variables resolved. Set `GMAIL_USER` and `GMAIL_APP_PASSWORD`. |
| `dns_failure` | `EMAIL_SMTP_HOST` does not resolve. Unset it for `smtp.gmail.com`. |
| `connection_refused` | Nothing is listening on that port. Check `EMAIL_SMTP_PORT`. |
| `connect_timeout` | Outbound SMTP is blocked. Common on hosts that do not expect you to send mail directly. |
| `tls_failed` | The certificate did not verify, or the port speaks plain SMTP and was addressed as implicit TLS. Check the port against the host. |
| `starttls_unsupported` | A 587 or 25 host that does not offer STARTTLS. Nothing was sent and no credential left the process. Use 465. |
| `auth_unsupported` | No `AUTH LOGIN` offered on this connection. On Gmail that means the session was not encrypted when AUTH was due. |
| `auth_app_password_required` | Google answered 534. The value is an account password on an account with 2-Step Verification on. Get an App Password. |
| `auth_rejected` | Google answered 535. Either `GMAIL_USER` is not the account the password belongs to, or the App Password is revoked, or 2-Step Verification is off, in which case no App Password exists. |
| `auth_temporary` | Throttled. Retry rather than rotating the password. |
| `sender_rejected` | Gmail refused the envelope sender. It only takes the authenticated account or a verified alias. |
| `recipient_rejected` | The address does not exist, or this account may not send to it. |
| `message_rejected` | Envelope accepted, message refused. Usually size or content filtering. |
| `timeout`, `connection_lost` | The host stopped answering part way through. |

---

## What is never written down

- The verification code. Not at any level, in any environment. The privacy
  policy commits to it and a log line outlives the ten minutes a code is valid
  for.
- The recipient address, the subject, or the body.
- The App Password, or any part of it, or its length.

`lib/server/smtp.ts` writes no log line at all. `lib/server/mail.ts` writes
one on a failure, carrying a reason from a closed set and an SMTP status.
`tests/smtp.test.ts` captures everything both modules print during a
successful send and a failed one and fails if any of the above appears in it.
