/**
 * The shell every SPYDIR email is rendered into.
 *
 * Email is not the web. There is no external CSS, no custom fonts worth relying on, and no layout
 * engine two clients agree about — so this is tables, inline styles, and colours light enough to
 * survive a dark-mode client inverting them. Every template also produces a plain-text version,
 * because some people read mail as text and because an HTML-only message looks like spam to the
 * filters that decide whether a licence key arrives at all.
 */

export interface Email {
  subject: string
  html: string
  text: string
}

const BRAND = '#0f766e'
const INK = '#111418'
const MUTED = '#5c6675'
const LINE = '#e4e7ec'

/** Escaped, because a name or an address ends up inside this markup. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function layout(options: { preview: string; body: string; footer?: string }): string {
  const footer =
    options.footer ??
    'You are receiving this because someone asked for a SPYDIR licence key with this address. If that was not you, ignore this email — nothing has been created.'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>SPYDIR</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;">
<!-- The line clients show beside the subject. Hidden, then padded so nothing else is pulled in. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(options.preview)}${'&#8203;'.repeat(80)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
        <tr>
          <td style="padding:28px 32px 0 32px;">
            <span style="font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                         letter-spacing:0.14em;color:${BRAND};">SPYDIR</span>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px 32px;
                     font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                     color:${INK};">
            ${options.body}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px 32px;">
            <hr style="border:0;border-top:1px solid ${LINE};margin:0 0 16px 0;">
            <p style="margin:0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">
              ${esc(footer)}
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;font:400 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${MUTED};">
        SPYDIR — read-only Active Directory explorer · spydir.io
      </p>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** A big, spaced, selectable value — a code or a key. Monospace so 0 and O are distinguishable. */
export function panel(value: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
  <tr>
    <td style="background:#f5f6f8;border:1px solid ${LINE};border-radius:10px;padding:16px 22px;
               font:600 26px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
               letter-spacing:0.12em;color:${INK};white-space:nowrap;">${esc(value)}</td>
  </tr>
</table>`
}

export function p(text: string): string {
  return `<p style="margin:0 0 14px 0;">${text}</p>`
}
