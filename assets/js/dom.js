export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
// Add structured benefits only when the title/description does not already state them.
export function dealBenefits(deal) {
  const text = `${deal.title || ''} ${deal.description || ''}`.toLowerCase();
  const parts = [];
  const value = Number(deal.discount_value);
  const type = String(deal.discount_type || '').trim().toLowerCase();
  if (type === 'percentage' && Number.isFinite(value) && value > 0 && value <= 100) {
    const mentioned = new RegExp(`(?:^|[^\\d.])${String(value).replace('.', '\\.')}\\s*(?:%|percent\\b|per cent\\b)`, 'i');
    if (!mentioned.test(text)) parts.push(`${value}% off`);
  }
  if (type === 'fixed' && Number.isFinite(value) && value > 0) {
    const amount = money(value);
    const plain = text.replace(/,/g, '');
    if (!plain.includes(`aed ${value}`) && !plain.includes(`${value} aed`)) parts.push(`${amount} off`);
  }
  const item = String(deal.free_item || '').trim();
  if (item && !(text.includes(item.toLowerCase()) && /\b(free|complimentary)\b/.test(text))) parts.push(`Free: ${item}`);
  return parts.join(' · ');
}
export function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function telephoneUrl(value) {
  const number = String(value ?? '').replace(/[\s()-]/g, '');
  // Never guess a country code for a number stored numerically in Sheets.
  return /^\+[1-9]\d{7,14}$/.test(number) ? 'tel:' + number : '';
}
export function whatsappUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  return url.hostname === 'wa.me' && /^\/[1-9]\d{7,14}\/?$/.test(url.pathname) ? safe : '';
}
export const money = value => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(value);
export function date(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
}
