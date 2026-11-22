/** Builds safe, pre-filled contact links for a prospect. */

export type ContactInput = {
  contact_name?: string | null;
  company_name: string;
  phone?: string | null;
  email?: string | null;
  whatsapp_link?: string | null;
  email_link?: string | null;
  telegram_link?: string | null;
  prefilled_message?: string | null;
};

export type ContactLinks = { whatsapp?: string; email?: string; telegram?: string; call?: string };

export function defaultMessage(p: ContactInput): string {
  return (
    p.prefilled_message?.trim() ||
    `Hello ${p.contact_name || 'there'}, I’m reaching out regarding ${p.company_name}. I’m with Vector Codes and would love to discuss how we could help your business.`
  );
}

/** Only http(s) links are allowed for stored URLs — blocks javascript:/data: links from imported data. */
function safeHttp(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function withParam(url: string, key: string, value: string): string {
  const u = new URL(url);
  if (!u.searchParams.has(key)) u.searchParams.set(key, value);
  return u.toString();
}

/** Nigerian numbers: 0803… → 234803…; keeps international numbers as given. */
function digits(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  return d.startsWith('0') ? `234${d.slice(1)}` : d;
}

export function contactLinks(p: ContactInput): ContactLinks {
  const message = defaultMessage(p);
  const links: ContactLinks = {};

  const wa = (p.whatsapp_link || '').trim();
  if (wa) {
    const safe = /^https?:/i.test(wa) ? safeHttp(wa) : null;
    if (safe) links.whatsapp = withParam(safe, 'text', message);
    else if (!/^https?:/i.test(wa) && digits(wa).length >= 8) links.whatsapp = `https://wa.me/${digits(wa)}?text=${encodeURIComponent(message)}`;
  } else if (p.phone && digits(p.phone).length >= 8) {
    links.whatsapp = `https://wa.me/${digits(p.phone)}?text=${encodeURIComponent(message)}`;
  }

  const em = (p.email_link || p.email || '').trim().replace(/^mailto:/i, '').split('?')[0];
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
    links.email = `mailto:${em}?subject=${encodeURIComponent('A quick introduction from Vector Codes')}&body=${encodeURIComponent(message)}`;
  }

  const tg = (p.telegram_link || '').trim();
  if (tg) {
    if (/^https?:/i.test(tg)) { const safe = safeHttp(tg); if (safe) links.telegram = withParam(safe, 'text', message); }
    else if (/^@?[A-Za-z0-9_]{4,}$/.test(tg)) links.telegram = `https://t.me/${tg.replace(/^@/, '')}?text=${encodeURIComponent(message)}`;
  }

  if (p.phone && digits(p.phone).length >= 8) links.call = `tel:+${digits(p.phone)}`;
  return links;
}
