/**
 * Email-safe HTML renderer.
 * Single 600px table, inline styles only (Gmail strips <style>).
 * Uses web-safe font fallbacks since subscribers won't have Fraunces locally.
 */
import { marked } from 'marked';

const SERIF = "'Georgia','Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const COLORS = {
  bg: '#F8F4EC',
  bgElev: '#FFFEFA',
  text: '#1A1612',
  textMuted: '#6B6258',
  rule: '#E6DECE',
  accent: '#B5563A',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineStyle(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
    .join(';');
}

const baseTextStyle = inlineStyle({
  fontFamily: SANS,
  fontSize: '16px',
  lineHeight: '1.7',
  color: COLORS.text,
  margin: '0 0 1em 0',
});

/**
 * Apply inline styles to the markdown-rendered HTML.
 * marked outputs <p>, <h2>, <ul>, <ol>, <li>, <a>, <strong>, <em>, <blockquote>.
 */
function styleElements(html) {
  return html
    .replace(/<p>/g, `<p style="${baseTextStyle}">`)
    .replace(
      /<h2>/g,
      `<h2 style="${inlineStyle({
        fontFamily: SERIF,
        fontSize: '22px',
        fontWeight: '600',
        color: COLORS.text,
        marginTop: '2em',
        marginBottom: '0.5em',
      })}">`,
    )
    .replace(
      /<h3>/g,
      `<h3 style="${inlineStyle({
        fontFamily: SERIF,
        fontSize: '18px',
        fontWeight: '600',
        color: COLORS.text,
        marginTop: '1.5em',
        marginBottom: '0.4em',
      })}">`,
    )
    .replace(
      /<a /g,
      `<a style="${inlineStyle({ color: COLORS.accent, textDecoration: 'underline' })}" `,
    )
    .replace(/<ul>/g, `<ul style="${inlineStyle({ paddingLeft: '20px', margin: '1em 0' })}">`)
    .replace(/<ol>/g, `<ol style="${inlineStyle({ paddingLeft: '20px', margin: '1em 0' })}">`)
    .replace(
      /<li>/g,
      `<li style="${inlineStyle({
        fontFamily: SANS,
        fontSize: '16px',
        lineHeight: '1.7',
        color: COLORS.text,
        marginBottom: '0.5em',
      })}">`,
    )
    .replace(
      /<blockquote>/g,
      `<blockquote style="${inlineStyle({
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: '18px',
        color: COLORS.textMuted,
        margin: '2em 0',
        paddingLeft: '1em',
        borderLeft: `2px solid ${COLORS.accent}`,
      })}">`,
    )
    .replace(/<strong>/g, '<strong style="font-weight:600">');
}

/**
 * Render the "If this hooked you" section as inline-styled email HTML.
 * Returns empty string if no items — keep the spacing clean.
 */
function renderFurtherReading(items) {
  if (!items || items.length === 0) return '';

  const itemsHtml = items
    .map((it) => {
      const note = it.note
        ? `<div style="${inlineStyle({
            fontFamily: SANS,
            fontSize: '13px',
            color: COLORS.textMuted,
            lineHeight: '1.45',
            marginTop: '2px',
          })}">${esc(it.note)}</div>`
        : '';
      const kind = it.kind
        ? `<span style="${inlineStyle({
            fontFamily: SANS,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
            marginLeft: '8px',
          })}">· ${esc(it.kind)}</span>`
        : '';
      return `<li style="${inlineStyle({
        marginBottom: '12px',
        listStyle: 'none',
      })}">
        <a href="${esc(it.url)}" style="${inlineStyle({
          color: COLORS.text,
          fontFamily: SANS,
          fontSize: '15px',
          fontWeight: '500',
          textDecoration: 'none',
        })}">${esc(it.label)}</a>${kind}
        ${note}
      </li>`;
    })
    .join('');

  return `<div style="${inlineStyle({
    marginTop: '24px',
    padding: '16px 18px 14px 18px',
    border: `1px solid ${COLORS.rule}`,
    borderRadius: '8px',
    backgroundColor: COLORS.bg,
  })}">
    <div style="${inlineStyle({
      fontFamily: SERIF,
      fontSize: '17px',
      fontWeight: '600',
      color: COLORS.text,
      marginBottom: '2px',
    })}">If this hooked you</div>
    <div style="${inlineStyle({
      fontFamily: SERIF,
      fontStyle: 'italic',
      fontSize: '14px',
      color: COLORS.textMuted,
      marginBottom: '10px',
    })}">Where we'd send you next.</div>
    <ul style="${inlineStyle({ padding: '0', margin: '0', listStyle: 'none' })}">
      ${itemsHtml}
    </ul>
  </div>`;
}

export function renderEmail({
  title,
  subtitle,
  bodyMdx,
  epigraph,
  monthlyTheme,
  curator,
  postSlug,
  pubDate,
  siteUrl,
  furtherReading,
  // buttondownHandle reserved for future use (e.g. archive link)
}) {
  const bodyHtml = styleElements(marked.parse(bodyMdx ?? ''));
  const webUrl = `${siteUrl}/articles/${postSlug}`;

  const subject = title;
  const preheader = subtitle || epigraph?.text || 'A small flame for your morning.';

  const furtherReadingBlock = renderFurtherReading(furtherReading);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${esc(subject)}</title>
</head>
<body style="${inlineStyle({
    margin: '0',
    padding: '0',
    backgroundColor: COLORS.bg,
    fontFamily: SANS,
  })}">
<!-- preheader -->
<div style="display:none;font-size:1px;color:${COLORS.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLORS.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:${COLORS.bgElev};border:1px solid ${COLORS.rule};border-radius:10px;">
      <tr><td style="padding:32px 32px 16px 32px;text-align:center;">
        <p style="${inlineStyle({
          margin: '0',
          fontFamily: SERIF,
          fontSize: '14px',
          fontStyle: 'italic',
          color: COLORS.textMuted,
        })}">The Daily Wick · ${esc(pubDate)}</p>
        ${
          monthlyTheme
            ? `<p style="${inlineStyle({
                display: 'inline-block',
                margin: '12px 0 0 0',
                fontFamily: SANS,
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: COLORS.accent,
                backgroundColor: '#B5563A1A',
                padding: '4px 12px',
                borderRadius: '999px',
              })}">${esc(monthlyTheme)}</p>`
            : ''
        }
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;text-align:center;">
        <h1 style="${inlineStyle({
          fontFamily: SERIF,
          fontSize: '30px',
          fontWeight: '600',
          color: COLORS.text,
          margin: '0',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
        })}">${esc(title)}</h1>
        ${
          subtitle
            ? `<p style="${inlineStyle({
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: '17px',
                color: COLORS.textMuted,
                margin: '12px 0 0 0',
                lineHeight: '1.4',
              })}">${esc(subtitle)}</p>`
            : ''
        }
      </td></tr>
      ${
        epigraph
          ? `<tr><td style="padding:24px 48px 8px 48px;text-align:center;">
              <p style="${inlineStyle({
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: '16px',
                color: COLORS.textMuted,
                margin: '0',
                lineHeight: '1.5',
              })}">“${esc(epigraph.text)}”</p>
              <p style="${inlineStyle({
                fontFamily: SANS,
                fontSize: '13px',
                color: COLORS.textMuted,
                margin: '6px 0 0 0',
              })}">— ${esc(epigraph.attribution)}</p>
            </td></tr>`
          : ''
      }
      <tr><td style="padding:24px 32px 16px 32px;color:${COLORS.text};">
        ${bodyHtml}
        ${furtherReadingBlock}
      </td></tr>
      <tr><td style="padding:8px 32px 24px 32px;border-top:1px solid ${COLORS.rule};margin-top:24px;">
        <p style="${inlineStyle({
          fontFamily: SANS,
          fontSize: '13px',
          color: COLORS.textMuted,
          margin: '16px 0 8px 0',
          textAlign: 'center',
        })}">
          <a href="${esc(webUrl)}" style="color:${COLORS.accent};text-decoration:underline;">Read on the web</a>
          &nbsp;·&nbsp;
          <a href="${esc(siteUrl)}/archive" style="color:${COLORS.accent};text-decoration:underline;">Archive</a>
        </p>
        <p style="${inlineStyle({
          fontFamily: SANS,
          fontSize: '12px',
          color: COLORS.textMuted,
          margin: '12px 0 0 0',
          textAlign: 'center',
          lineHeight: '1.5',
        })}">
          Drafted with AI (Gemini 2.5 Flash) and curated by <em>${esc(curator)}</em>.<br>
          Read our <a href="${esc(siteUrl)}/editorial-standards" style="color:${COLORS.textMuted};">editorial standards</a>.
        </p>
      </td></tr>
    </table>
    <p style="${inlineStyle({
      fontFamily: SANS,
      fontSize: '12px',
      color: COLORS.textMuted,
      margin: '16px 0 0 0',
      textAlign: 'center',
    })}">© ${new Date().getUTCFullYear()} The Daily Wick · A small flame, every morning.</p>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, preheader };
}
