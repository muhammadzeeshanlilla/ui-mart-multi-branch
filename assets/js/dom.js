export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
export function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export const money = value => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(value);
export function date(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' });
}
