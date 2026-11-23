// model.js — Valoración con los precios descargados por el móvil.
// Calcula: valor, variación del día, ganancia frente a `inv`, pesos y patrimonio.
// No recalcula: nota de salud, avisos, escenarios ni ciclo (son del escritorio, a fecha de generatedAt).
import { SUB, normCur } from './quotes.js';
import { isNum, todayStr, daysUntil } from './format.js';

export function makeRates(pkg, fx) {
  const fromPkg = {};
  pkg.positions.forEach((p) => {
    const c = normCur(p.cur);
    if (!(p.fx > 0) || !c) return;
    if (SUB[c]) fromPkg[SUB[c][0]] = p.fx * SUB[c][1]; else fromPkg[c] = p.fx;
  });
  const used = new Set(); // divisas valoradas con el cambio del paquete
  function rate(cur) {
    const c = normCur(cur);
    if (!c || c === 'EUR') return 1;
    if (SUB[c]) { const b = rate(SUB[c][0]); return b == null ? null : b / SUB[c][1]; }
    if (fx.live[c] > 0) return fx.live[c];
    if (fromPkg[c] > 0) { used.add(c); return fromPkg[c]; }
    return null;
  }
  return { rate, used };
}

export function compute(pkg, quotes) {
  const { live, fx } = quotes;
  const R = makeRates(pkg, fx);
  const gen = pkg.generatedAt ? new Date(pkg.generatedAt) : null;
  const sameDay = gen && (gen.getFullYear() + '-' + String(gen.getMonth() + 1).padStart(2, '0') + '-' + String(gen.getDate()).padStart(2, '0')) === todayStr();

  let value = 0, dayPl = 0, invested = 0, nLive = 0;
  const pos = pkg.positions.map((p) => {
    const q = live['p:' + p.id];
    const isLive = !!q;
    const px = isLive ? q.px : p.px;
    const cur = normCur(isLive ? q.cur || p.cur : p.cur);
    const chg = isLive ? q.chg : (sameDay ? p.chg : null);
    let r = R.rate(cur);
    if (r == null && cur === normCur(p.cur) && p.fx > 0) r = p.fx;
    let val = isNum(px) && isNum(p.sh) && r != null ? p.sh * px * r : p.val;
    if (!isNum(val)) val = 0;
    const dpl = isNum(chg) && chg > -1 ? val * chg / (1 + chg) : 0;
    const pl = isNum(p.inv) ? val - p.inv : p.pl;
    const plPct = p.inv > 0 ? pl / p.inv : p.plPct;
    if (isLive) nLive++;
    value += val; dayPl += dpl; invested += isNum(p.inv) ? p.inv : 0;
    // Precio expresado en otra divisa (para escenarios, compra, 52 semanas).
    const priceIn = (c2) => {
      if (!isNum(px)) return null;
      const a = normCur(c2) || cur;
      if (a === cur) return px;
      const r2 = R.rate(a);
      return r != null && r2 ? px * r / r2 : null;
    };
    const at = isLive ? q.at : Date.parse(pkg.generatedAt);
    const today = isNum(chg) && isNum(at) && new Date(at).toDateString() === new Date().toDateString();
    const thc = (p.th && p.th.cur) || p.cur;
    const base = p.th && p.th.sc && p.th.sc.base && p.th.sc.base.p;
    const pxTh = isNum(px) ? priceIn(thc) : null;
    const pot = isNum(base) && pxTh > 0 ? base / pxTh - 1 : null;              // potencial al escenario base
    const pxCur = isNum(px) ? priceIn(p.cur) : null;
    const vsBuy = p.buy > 0 && isNum(pxCur) ? pxCur / p.buy - 1 : null;          // precio frente a tu compra (en su moneda)
    return { p, px, cur, chg, today, isLive, pot, vsBuy, src: isLive ? q.src : 'Escritorio', at: isLive ? q.at : Date.parse(pkg.generatedAt), val, dayPl: dpl, pl, plPct, priceIn, w: 0 };
  });
  pos.forEach((d) => { d.w = value > 0 ? d.val / value : null; });

  const cash = isNum(pkg.totals.cash) ? pkg.totals.cash : pkg.cash.reduce((s, c) => s + (c.a || 0), 0);
  const ideas = pkg.ideas.map((i) => {
    const q = live['i:' + i.t];
    const px = q ? q.px : i.px;
    const cur = normCur(q ? q.cur || i.cur : i.cur);
    let pxIn = px;
    if (q && cur !== normCur(i.cur)) { const a = R.rate(cur), b = R.rate(i.cur); pxIn = a && b ? px * a / b : null; }
    const hit = isNum(pxIn) && isNum(i.trg) && (i.dir === 'above' ? pxIn >= i.trg : pxIn <= i.trg);
    return { i, px: pxIn, chg: q ? q.chg : (sameDay ? i.chg : null), isLive: !!q, hit, dist: isNum(pxIn) && i.trg > 0 ? pxIn / i.trg - 1 : null };
  });

  // Índice compuesto: variación del día (media ponderada de sus patas, como el escritorio).
  let bench = null;
  if (pkg.bench && pkg.bench.legs && pkg.bench.legs.length) {
    let cv = 0, cc = 0;
    pos.forEach((d) => { if (d.p.ty === 'Cripto' && isNum(d.chg)) { cv += d.val; cc += d.val * d.chg; } });
    let acc = 0, ws = 0, missing = [];
    pkg.bench.legs.forEach((l) => {
      const c = l.y ? (live['b:' + l.k] ? live['b:' + l.k].chg : null) : (cv > 0 ? cc / cv : null);
      if (isNum(c) && l.w > 0) { acc += l.w * c; ws += l.w; } else missing.push(l.n);
    });
    bench = { name: pkg.bench.name || 'Índice compuesto', chg: ws > 0 ? acc / ws : null, cover: ws, missing };
  }

  return {
    pos, ideas, sameDay, bench, anyToday: pos.some((d) => d.today) && pos.filter((d) => isNum(d.chg) && d.p.ty !== 'Cripto').every((d) => d.today),
    totals: { value, dayPl, dayPct: value - dayPl > 0 ? dayPl / (value - dayPl) : null, invested, pl: value - invested, plPct: invested > 0 ? (value - invested) / invested : null, cash, grand: value + cash },
    nLive, nPos: pos.length, fxFallback: [...R.used], rate: R.rate,
  };
}

// ---------- avisos agregados ----------
export function alertsOf(pkg, M, quotes) {
  const out = { data: [], sell: [], thesis: [], ideas: [], dates: [], later: [] };
  if (pkg.clone) out.data.push({ s: 'high', t: 'Datos del clon de pruebas', d: 'Este paquete lo subió el clon de pruebas del escritorio, no la app real.' });
  const age = (Date.now() - Date.parse(pkg.generatedAt)) / 86400000;
  if (age >= 2) out.data.push({ s: age >= 7 ? 'high' : 'med', t: 'Datos del escritorio de hace ' + Math.floor(age) + ' días', d: 'Nota de salud, avisos, escenarios y ciclo valen a esa fecha. Abre la app de escritorio para que suba una copia nueva.' });
  if (M.fxFallback.length) out.data.push({ s: 'med', t: 'Cambio de divisa del escritorio', d: 'No se pudo obtener el cambio actual de ' + M.fxFallback.join(', ') + '; se usa el del paquete.' });
  const st = quotes.status;
  if (!st.running && st.lastAt && M.nPos - M.nLive > 0) {
    const miss = M.pos.filter((d) => !d.isLive).map((d) => d.p.t);
    out.data.push({ s: 'med', t: miss.length + ' sin cotización actual', d: 'Se valoran con el último precio del escritorio: ' + miss.join(', ') + '.' });
  }

  M.pos.forEach((d) => {
    const p = d.p, th = p.th || {};
    (th.sell || []).forEach((s) => { if (s.x) out.sell.push({ p, s }); });
    (th.avisos || []).forEach((a) => out.thesis.push({ p, a }));
    (th.ev || []).forEach((e) => { const n = daysUntil(e.d); if (n != null && n >= 0) (n <= 14 ? out.dates : out.later).push({ p, d: e.d, n, k: e.k, t: e.t, ok: e.ok }); });
    const ne = daysUntil(th.nextE);
    if (ne != null && ne >= 0 && !(th.ev || []).some((e) => e.d === th.nextE)) (ne <= 14 ? out.dates : out.later).push({ p, d: th.nextE, n: ne, k: 'Resultados', t: '', ok: null });
    const rv = daysUntil(th.review);
    if (rv != null) (rv <= 14 ? out.dates : out.later).push({ p, d: th.review, n: rv, k: 'Revisión de la tesis', t: rv < 0 ? 'Vencida' : '', ok: null });
  });
  out.thesis.sort((a, b) => (a.a.s === b.a.s ? 0 : a.a.s === 'high' ? -1 : 1));
  out.dates.sort((a, b) => a.n - b.n);
  out.later.sort((a, b) => a.n - b.n);
  out.ideas = M.ideas.filter((x) => x.hit);
  out.count = out.sell.length + out.thesis.filter((x) => x.a.s === 'high').length + out.ideas.length + out.data.filter((x) => x.s === 'high').length;
  return out;
}

// ---------- distribución ----------
export const DIST = { ty: 'Tipo', sec: 'Sector', ctry: 'País', cur: 'Moneda' };
export function distribution(M, by) {
  const g = {};
  M.pos.forEach((d) => {
    let k = by === 'cur' ? (SUB[d.p.cur] ? SUB[d.p.cur][0] : d.p.cur) : d.p[by];
    if (by === 'cur' && d.p.ty === 'Cripto') k = 'Cripto';
    k = k || 'Sin dato';
    g[k] = (g[k] || 0) + d.val;
  });
  const tot = M.totals.value || 1;
  return Object.entries(g).map(([k, v]) => ({ k, v, w: v / tot })).sort((a, b) => b.v - a.v);
}

// ---------- series ----------
export const RANGES = [['1m', '1 mes'], ['3m', '3 meses'], ['ytd', 'Este año'], ['1y', '1 año'], ['all', 'Todo']];
function cutDate(r) {
  const d = new Date();
  if (r === 'ytd') return d.getFullYear() + '-01-01';
  if (r === 'all') return '0000';
  const n = { '1m': 1, '3m': 3, '1y': 12 }[r] || 12;
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}
// Patrimonio real (fotos diarias del escritorio) + el punto de hoy con los precios del móvil.
export function histSeries(pkg, M, r) {
  if (!pkg.hist || !pkg.hist.length) return null;
  const pts = pkg.hist.map(([d, v, inv]) => ({ d, v, inv }));
  const t = todayStr();
  const last = pts[pts.length - 1];
  const now = { d: t, v: M.totals.value, inv: M.totals.invested };
  if (last.d === t) pts[pts.length - 1] = now; else if (last.d < t) pts.push(now);
  const c = cutDate(r);
  let out = pts.filter((p) => p.d >= c);
  if (out.length < 2) out = pts.slice(-2);
  return out.length >= 2 ? out : null;
}
// Cartera (posiciones de hoy) frente al índice, rebasadas a 100 el primer día común del periodo.
export function vsBench(pkg, r) {
  if (!pkg.nav || !pkg.bench || !pkg.bench.s) return null;
  const b = new Map(pkg.bench.s.map(([d, v]) => [d, v]));
  const c = cutDate(r);
  const common = pkg.nav.filter(([d]) => d >= c && b.has(d)).map(([d, v]) => ({ d, a: v, b: b.get(d) }));
  if (common.length < 2) return null;
  const a0 = common[0].a, b0 = common[0].b;
  const pts = common.map((x) => ({ d: x.d, a: x.a / a0 * 100, b: x.b / b0 * 100 }));
  const L = pts[pts.length - 1];
  return { pts, port: L.a / 100 - 1, bench: L.b / 100 - 1 };
}
