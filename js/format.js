// format.js — Formato de números, fechas y texto en español.
const NF = {};
function nf(d) {
  const k = String(d);
  if (!NF[k]) {
    try { NF[k] = new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' }); }
    catch (e) { NF[k] = new Intl.NumberFormat('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  }
  return NF[k];
}
export const isNum = (x) => typeof x === 'number' && isFinite(x);

export function num(x, d = 2) { return isNum(x) ? nf(d).format(x) : '—'; }

// Modo privado: oculta importes en euros y número de títulos (porcentajes y precios siguen a la vista).
let PRIV = false;
export function setPriv(b) { PRIV = !!b; }
export const MASK = '•••••';
export function secret(s) { return PRIV ? MASK : s; }

export function eur(x, d = 0) { return isNum(x) ? (PRIV ? MASK + ' €' : nf(d).format(x) + ' €') : '—'; }

export function signedEur(x, d = 0) {
  if (!isNum(x)) return '—';
  if (PRIV) return MASK + ' €';
  return (x > 0 ? '+' : x < 0 ? '−' : '') + nf(d).format(Math.abs(x)) + ' €';
}

export function pct(x, d = 2, sign = true) {
  if (!isNum(x)) return '—';
  const v = x * 100;
  return (sign && v > 0 ? '+' : v < 0 ? '−' : '') + nf(d).format(Math.abs(v)) + ' %';
}

const CUR_SYM = { EUR: '€', USD: '$', GBP: '£', GBX: 'p', GBp: 'p', JPY: '¥', CHF: 'CHF', CAD: 'C$', AUD: 'A$', SEK: 'kr' };
export function curLabel(c) { return CUR_SYM[c] || c || ''; }

export function priceDecimals(x) {
  const a = Math.abs(x);
  return a >= 10000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
}
export function price(x, cur) {
  if (!isNum(x)) return '—';
  return nf(priceDecimals(x)).format(x) + ' ' + curLabel(cur);
}

export function cls(x) { return !isNum(x) || x === 0 ? 'flat' : x > 0 ? 'up' : 'down'; }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export function date(s) {
  if (!s) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return String(s);
  return +m[3] + ' ' + MESES[+m[2] - 1] + ' ' + m[1];
}
export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
export function time(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
export function ago(iso) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!isFinite(t)) return '—';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400 * 1.5) return 'hace ' + Math.round(s / 3600) + ' h';
  return 'hace ' + Math.round(s / 86400) + ' días';
}
export function daysSince(iso) {
  const t = Date.parse(iso);
  return isFinite(t) ? (Date.now() - t) / 86400000 : null;
}
// Días desde hoy hasta una fecha AAAA-MM-DD (negativo si ya pasó).
export function daysUntil(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Texto con saltos de línea → párrafos escapados.
export function paras(s) {
  const t = String(s == null ? '' : s).trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
}
