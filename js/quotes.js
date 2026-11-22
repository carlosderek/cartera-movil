// quotes.js — Cotizaciones y tipos de cambio, pedidos por el móvil (no vienen en el paquete).
//
//   Acciones EE. UU. → Twelve Data (clave del usuario, tiempo real, 8 símbolos/min en el plan gratuito)
//   Resto de bolsas  → Yahoo /v8/finance/chart a través de un intermediario (por defecto r.jina.ai,
//                      20 peticiones/min por IP; aquí se gastan como mucho 18)
//   Cripto           → CoinGecko en EUR (CORS abierto)
//   Fondos           → quefondos.com por ISIN a través del intermediario (valor liquidativo diario)
//   Divisas          → BCE vía Frankfurter; si falla, el cambio del paquete (y se avisa)
//
// Nada de esto se guarda en el dispositivo: los precios viven en memoria mientras la app está abierta.
import { DEFAULT_PROXY } from './data.js';

const YF_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const CG_URL = 'https://api.coingecko.com/api/v3/simple/price';
const TD_URL = 'https://api.twelvedata.com/quote';
const FX_URL = 'https://api.frankfurter.dev/v1/latest';
const QF_URL = 'https://www.quefondos.com/es/fondos/ficha/index.html?isin=';
const PROXY_PER_MIN = 18, TD_PER_MIN = 8, CONC = 3;

// Subunidades: precio en peniques/céntimos → divisa base / 100
export const SUB = { GBX: ['GBP', 100], GBp: ['GBP', 100], ZAc: ['ZAR', 100], ZAC: ['ZAR', 100], ILA: ['ILS', 100] };
export const normCur = (c) => (c === 'GBp' ? 'GBX' : c === 'ZAC' ? 'ZAc' : c || null);
const baseCur = (c) => (SUB[c] ? SUB[c][0] : c);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

function extractJson(text, marker) {
  const start = marker ? text.indexOf(marker) : text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(text.slice(start, end)); } catch (e) { return null; }
}

const isUS = (sym) => !!sym && !/\.[A-Za-z]{1,3}$/.test(sym) && !/[=^]/.test(sym);

export function createQuotes({ getCfg, onChange }) {
  const live = {};            // clave → { px, chg, cur, src, at }
  const fx = { live: {}, at: 0, src: null, err: null };
  const status = { running: false, total: 0, done: 0, failed: [], lastAt: 0, waiting: false };
  let gen = 0, proxyHits = [], tdLastAt = 0;
  const changed = () => { try { onChange(); } catch (e) {} };

  // ---------- intermediario con presupuesto por minuto ----------
  async function proxyText(url, g) {
    for (;;) {
      if (g !== gen) return null;
      const now = Date.now();
      proxyHits = proxyHits.filter((t) => now - t < 60000);
      if (proxyHits.length < PROXY_PER_MIN) break;
      status.waiting = true; changed();
      await sleep(60000 - (now - proxyHits[0]) + 250);
    }
    status.waiting = false;
    proxyHits.push(Date.now());
    const tpl = (getCfg().proxy || '').trim() || DEFAULT_PROXY;
    const target = tpl.includes('{urlenc}') ? tpl.replace('{urlenc}', encodeURIComponent(url))
      : tpl.includes('{url}') ? tpl.replace('{url}', url) : tpl + url;
    try {
      const r = await fetch(target, { cache: 'no-store', signal: withTimeout(12000) });
      if (r.status === 429) { proxyHits = Array(PROXY_PER_MIN).fill(Date.now()); return null; }
      if (!r.ok) return null;
      return await r.text();
    } catch (e) { return null; }
  }

  // ---------- Yahoo ----------
  async function yahoo(sym, g) {
    const text = await proxyText(YF_CHART + encodeURIComponent(sym) + '?range=5d&interval=1d', g);
    if (!text) return null;
    const j = extractJson(text, '{"chart"');
    const res = j && j.chart && j.chart.result && j.chart.result[0];
    const m = res && res.meta;
    if (!m || !(m.regularMarketPrice > 0)) return null;
    const px = m.regularMarketPrice;
    // Cierre anterior: última vela de un día anterior al de la última cotización.
    let prev = null;
    const ts = res.timestamp || [], cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
    const off = m.gmtoffset || 0, dayOf = (t) => Math.floor((t + off) / 86400);
    if (m.regularMarketTime && ts.length === cl.length) {
      const today = dayOf(m.regularMarketTime);
      for (let i = ts.length - 1; i >= 0; i--) if (cl[i] > 0 && dayOf(ts[i]) < today) { prev = cl[i]; break; }
    }
    if (!(prev > 0)) prev = m.previousClose > 0 ? m.previousClose : null;
    return { px, chg: prev ? px / prev - 1 : null, cur: normCur(m.currency), src: 'Yahoo · ~15 min', at: (m.regularMarketTime || 0) * 1000 || Date.now() };
  }

  // ---------- Twelve Data ----------
  async function twelve(syms, key) {
    const out = {};
    if (!syms.length || !key) return out;
    tdLastAt = Date.now();
    try {
      const r = await fetch(TD_URL + '?' + new URLSearchParams({ symbol: syms.join(','), apikey: key }), { cache: 'no-store', signal: withTimeout(10000) });
      if (!r.ok) return out;
      const j = await r.json();
      if (j && j.status === 'error') return out;
      const one = syms.length === 1;
      for (const s of syms) {
        const q = one ? j : j[s];
        if (!q || q.status === 'error') continue;
        const px = parseFloat(q.close != null ? q.close : q.price), ch = parseFloat(q.percent_change);
        if (!(px > 0)) continue;
        out[s] = { px, chg: isFinite(ch) ? ch / 100 : null, cur: normCur(q.currency || 'USD'), src: 'Twelve Data · tiempo real', at: (q.last_quote_at || q.timestamp || 0) * 1000 || Date.now() };
      }
    } catch (e) {}
    return out;
  }

  // ---------- CoinGecko ----------
  async function coingecko(ids, g) {
    if (!ids.length) return {};
    const url = CG_URL + '?ids=' + ids.map(encodeURIComponent).join(',') + '&vs_currencies=eur&include_24hr_change=true';
    let j = null;
    try { const r = await fetch(url, { cache: 'no-store', signal: withTimeout(8000) }); if (r.ok) j = await r.json(); } catch (e) {}
    if (!j) { const t = await proxyText(url, g); if (t) j = extractJson(t); }
    const out = {};
    if (j) for (const id of ids) if (j[id] && j[id].eur > 0) out[id] = { px: j[id].eur, chg: j[id].eur_24h_change != null ? j[id].eur_24h_change / 100 : null, cur: 'EUR', src: 'CoinGecko', at: Date.now() };
    return out;
  }

  // ---------- fondos ----------
  async function quefondos(isin, cur, g) {
    const t = await proxyText(QF_URL + encodeURIComponent(isin), g);
    if (!t) return null;
    const m = t.match(/Valor liquidativo[\s\S]{0,300}?([0-9][0-9.]*,[0-9]+|[0-9]+\.[0-9]+)/i);
    if (!m) return null;
    const s = m[1].includes(',') ? m[1].replace(/\./g, '').replace(',', '.') : m[1];
    const v = parseFloat(s);
    return v > 0 ? { px: v, chg: null, cur: normCur(cur), src: 'quefondos · valor liquidativo', at: Date.now() } : null;
  }

  // ---------- divisas ----------
  async function loadFx(curs) {
    const need = [...new Set(curs.map((c) => baseCur(normCur(c))).filter((c) => c && c !== 'EUR'))];
    if (!need.length) { fx.at = Date.now(); fx.src = null; fx.err = null; return; }
    try {
      const r = await fetch(FX_URL + '?base=EUR&symbols=' + need.join(','), { cache: 'no-store', signal: withTimeout(8000) });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const out = {};
      for (const c of need) if (j.rates && j.rates[c] > 0) out[c] = 1 / j.rates[c];
      fx.live = out; fx.at = Date.now(); fx.src = 'BCE' + (j.date ? ' · ' + j.date : ''); fx.err = need.filter((c) => !out[c]);
    } catch (e) {
      fx.err = need; fx.src = null;
    }
  }

  // ---------- ciclo completo ----------
  async function refresh(pkg) {
    if (!pkg) return;
    const g = ++gen;
    const cfg = getCfg();
    const items = [];
    pkg.positions.forEach((p) => items.push({ key: 'p:' + p.id, ty: p.ty, y: (p.q && p.q.y) || p.t, cg: p.q && p.q.cg, isin: p.q && p.q.isin, cur: p.cur, ref: p.px, refCur: p.cur }));
    pkg.ideas.forEach((i) => { if (i.q && i.q.y) items.push({ key: 'i:' + i.t, ty: 'Acción', y: i.q.y, cur: i.cur, ref: i.px, refCur: i.cur, idea: true }); });
    status.running = true; status.total = items.length; status.done = 0; status.failed = []; changed();

    const curs = [];
    pkg.positions.forEach((p) => { curs.push(p.cur); if (p.th && p.th.cur) curs.push(p.th.cur); });
    pkg.ideas.forEach((i) => curs.push(i.cur));
    const fxJob = loadFx(curs).then(changed);

    const put = (it, q) => {
      if (g !== gen) return;
      if (q) live[it.key] = q; else status.failed.push(it.key);
      status.done++; changed();
    };

    // Cripto
    const cryptos = items.filter((i) => i.ty === 'Cripto' && i.cg);
    const cgJob = coingecko([...new Set(cryptos.map((i) => i.cg))], g).then((res) => cryptos.forEach((i) => put(i, res[i.cg] || null)));

    // Fondos y acciones
    const funds = items.filter((i) => i.ty === 'Fondo');
    const eq = items.filter((i) => i.ty !== 'Cripto' && i.ty !== 'Fondo' && i.y);
    items.filter((i) => (i.ty === 'Cripto' && !i.cg) || (i.ty !== 'Cripto' && i.ty !== 'Fondo' && !i.y)).forEach((i) => put(i, null));

    // Twelve Data: americanas, primero posiciones; como mucho 8 por minuto.
    let viaYahoo = eq;
    if (cfg.tdKey && Date.now() - tdLastAt >= 60000) {
      const us = eq.filter((i) => isUS(i.y)).slice(0, TD_PER_MIN);
      const syms = [...new Set(us.map((i) => i.y))];
      const res = await twelve(syms, cfg.tdKey);
      const ok = new Set();
      us.forEach((i) => {
        const q = res[i.y];
        // Un precio que se aparta más de un 35 % del último conocido suele ser un homónimo de otra bolsa.
        if (q && !(i.ref > 0 && q.cur === normCur(i.refCur) && Math.abs(q.px / i.ref - 1) > 0.35)) { put(i, q); ok.add(i.key); }
      });
      viaYahoo = eq.filter((i) => !ok.has(i.key));
    }

    // Orden de la cola: acciones en cartera, fondos y, al final, ideas.
    const yq = (i) => async () => put(i, await yahoo(i.y, g));
    const queue = viaYahoo.filter((i) => !i.idea).map(yq)
      .concat(funds.map((i) => async () => {
        let q = null;
        if (i.isin) q = await quefondos(i.isin, i.cur, g);
        if (!q && i.y && i.y !== i.isin) q = await yahoo(i.y, g);
        put(i, q);
      }))
      .concat(viaYahoo.filter((i) => i.idea).map(yq));
    const workers = Array.from({ length: CONC }, async () => { while (queue.length && g === gen) await queue.shift()(); });
    await Promise.all([fxJob, cgJob, ...workers]);
    if (g !== gen) return;
    status.running = false; status.waiting = false; status.lastAt = Date.now(); changed();
  }

  function stop() { gen++; status.running = false; status.waiting = false; changed(); }

  return { live, fx, status, refresh, stop };
}
