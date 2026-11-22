// views.js — Las pantallas. Cada función devuelve HTML; app.js engancha los eventos por delegación.
import { eur, signedEur, pct, num, price, cls, date, dateTime, daysUntil, esc, paras, isNum, time } from './format.js';
import { DEFAULT_PROXY } from './data.js';

const SCN = [['bear', 'Bajista'], ['conservative', 'Conservador'], ['base', 'Base'], ['bull', 'Alcista']];
const SCN_SHORT = { bear: 'baj.', conservative: 'cons.', base: 'base', bull: 'alc.' };
const TY = { all: 'Todas', 'Acción': 'Acciones', Cripto: 'Cripto', Fondo: 'Fondos' };
export const SORTS = [
  ['val', 'Valor'], ['chg', 'Día %'], ['dayPl', 'Día €'], ['plPct', 'Ganancia %'], ['pl', 'Ganancia €'], ['health', 'Salud'], ['name', 'Nombre'],
];

const prob = (x) => (isNum(x) ? (x > 1 ? x / 100 : x) : null);
const healthCls = (h) => (!isNum(h) ? 'na' : h >= 70 ? 'good' : h >= 40 ? 'mid' : 'bad');
const dayWord = (d) => (d.today ? 'hoy' : 'últ. sesión');
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

function healthDot(h) {
  return '<span class="hdot ' + healthCls(h) + '" title="Salud ' + (isNum(h) ? Math.round(h) : '—') + '">' + (isNum(h) ? Math.round(h) : '–') + '</span>';
}
function chip(text, kind) { return '<span class="chip ' + (kind || '') + '">' + esc(text) + '</span>'; }

// ---------- Resumen ----------
function cycleLine(c) {
  if (!c) return '';
  let svg = '';
  if (isNum(c.phase)) {
    const W = 300, gap = 6, n = 6, w = (W - gap * (n - 1)) / n;
    for (let i = 1; i <= n; i++) {
      const x = (i - 1) * (w + gap);
      const k = i === c.phase ? 'cur' : i === c.next ? 'next' : i < c.phase ? 'past' : '';
      svg += '<rect class="seg ' + k + '" x="' + x + '" y="8" width="' + w + '" height="10" rx="3"/>' +
        '<text class="segn ' + k + '" x="' + (x + w / 2) + '" y="34">' + i + '</text>';
    }
    svg = '<svg class="cyc" viewBox="0 0 300 40" role="img" aria-label="Fase ' + c.phase + ' de 6">' + svg + '</svg>';
  }
  const tags = [];
  if (c.prov) tags.push(chip('provisional', 'warn'));
  if (isNum(c.week)) tags.push(chip('semana ' + c.week));
  let fga = '';
  if (c.fga) {
    fga = '<div class="cyc-fga">FGA: <b>' + esc(c.fga.lbl || '—') + '</b>' + (c.fga.watch ? ' ' + chip('vigilar', 'warn') : '') +
      (c.fga.stale ? ' ' + chip('lectura antigua', 'warn') : '') + (c.fga.date ? ' <span class="muted">· ' + date(c.fga.date) + '</span>' : '') + '</div>';
  }
  return '<section class="card"><h2>Ciclo</h2>' + svg +
    '<div class="cyc-txt">' + (isNum(c.phase) ? '<b>Fase ' + c.phase + '</b> · ' : '') + esc(c.lbl || '') +
    (isNum(c.R) ? ' <span class="muted">· R ' + num(c.R, 2) + '</span>' : '') + '</div>' +
    (c.next ? '<div class="cyc-next">→ Fase ' + c.next + ' · ' + esc(c.nextLbl || '') + (isNum(c.p) ? ' <b>' + pct(c.p, 0, false) + '</b>' : '') + '</div>' : '') +
    (tags.length ? '<div class="tags">' + tags.join(' ') + '</div>' : '') + fga + '</section>';
}

function moverRow(d) {
  return '<a class="row" href="#/pos/' + encodeURIComponent(d.p.id) + '"><div class="row-l"><b>' + esc(d.p.t) + '</b><small>' + esc(d.p.n) + '</small></div>' +
    '<div class="row-r"><span class="' + cls(d.chg) + '">' + pct(d.chg) + '</span><small class="' + cls(d.dayPl) + '">' + signedEur(d.dayPl) + '</small></div>' + chev + '</a>';
}

export function summary(S) {
  const { M, pkg, alerts } = S;
  const T = M.totals;
  const withChg = M.pos.filter((d) => isNum(d.chg));
  const up = withChg.filter((d) => d.chg > 0).sort((a, b) => b.chg - a.chg).slice(0, 3);
  const down = withChg.filter((d) => d.chg < 0).sort((a, b) => a.chg - b.chg).slice(0, 3);
  const noDay = !withChg.length;
  return '<section class="hero">' +
    '<div class="lbl">Patrimonio</div><div class="big">' + eur(T.grand) + '</div>' +
    '<div class="day ' + cls(T.dayPl) + '">' + (noDay ? '<span class="muted">Sin variación del día todavía</span>' : signedEur(T.dayPl) + ' · ' + pct(T.dayPct) + (M.anyToday ? ' hoy' : ' en la última sesión')) + '</div>' +
    '<div class="kv3">' +
      '<div><span>Posiciones</span><b>' + eur(T.value) + '</b></div>' +
      '<div><span>Ganancia</span><b class="' + cls(T.pl) + '">' + signedEur(T.pl) + '</b><small class="' + cls(T.pl) + '">' + pct(T.plPct, 1) + '</small></div>' +
      '<div><span>Liquidez</span><b>' + eur(T.cash) + '</b><small class="muted">' + (T.grand > 0 ? pct(T.cash / T.grand, 1, false) : '') + '</small></div>' +
    '</div></section>' +
    (alerts.count ? '<a class="card alert-link" href="#/avisos"><span class="badge">' + alerts.count + '</span> ' + (alerts.count === 1 ? 'aviso importante' : 'avisos importantes') + chev + '</a>' : '') +
    cycleLine(pkg.cycle) +
    '<section class="card"><h2>Las que más suben</h2>' + (up.length ? up.map(moverRow).join('') : '<p class="empty">' + (noDay ? 'Esperando cotizaciones…' : 'Ninguna sube hoy.') + '</p>') + '</section>' +
    '<section class="card"><h2>Las que más bajan</h2>' + (down.length ? down.map(moverRow).join('') : '<p class="empty">' + (noDay ? 'Esperando cotizaciones…' : 'Ninguna baja hoy.') + '</p>') + '</section>' +
    (pkg.cash.length ? '<section class="card"><h2>Liquidez</h2>' + pkg.cash.map((c) => '<div class="kv"><span>' + esc(c.n) + '</span><b>' + eur(c.a) + '</b></div>').join('') + '</section>' : '');
}

// ---------- Posiciones ----------
function sortVal(d, k) {
  switch (k) {
    case 'chg': return d.chg; case 'dayPl': return d.dayPl; case 'plPct': return d.plPct; case 'pl': return d.pl;
    case 'health': return d.p.th && d.p.th.health; default: return d.val;
  }
}
export function positions(S) {
  const { M, ui } = S;
  let list = M.pos.slice();
  if (ui.filter !== 'all') list = list.filter((d) => d.p.ty === ui.filter);
  const dir = ui.dir === 'asc' ? 1 : -1;
  if (ui.sort === 'name') list.sort((a, b) => dir * -1 * String(a.p.t).localeCompare(String(b.p.t), 'es'));
  else list.sort((a, b) => {
    const x = sortVal(a, ui.sort), y = sortVal(b, ui.sort);
    if (!isNum(x) && !isNum(y)) return 0; if (!isNum(x)) return 1; if (!isNum(y)) return -1;
    return dir * (x - y);
  });
  const types = ['all', ...new Set(M.pos.map((d) => d.p.ty).filter(Boolean))];
  const total = list.reduce((s, d) => s + d.val, 0);
  return '<div class="toolbar">' +
    '<div class="seg-ctl">' + types.map((t) => '<button data-filter="' + esc(t) + '" class="' + (ui.filter === t ? 'on' : '') + '">' + esc(TY[t] || t) + '</button>').join('') + '</div>' +
    '<div class="sort"><label>Ordenar <select id="sort">' + SORTS.map(([k, l]) => '<option value="' + k + '"' + (ui.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
    '<button id="sortdir" class="icon" aria-label="Cambiar sentido">' + (ui.dir === 'asc' ? '↑' : '↓') + '</button></div></div>' +
    '<div class="list-head"><span>' + list.length + ' posiciones</span><span>' + eur(total) + '</span></div>' +
    '<section class="card flush">' + list.map((d) => {
      const p = d.p;
      return '<a class="prow" href="#/pos/' + encodeURIComponent(p.id) + '">' +
        healthDot(p.th && p.th.health) +
        '<div class="prow-l"><b>' + esc(p.t) + (d.isLive ? '' : ' <i class="stale" title="Precio del escritorio">•</i>') + '</b><small>' + esc(p.n) + '</small><small class="muted">' + pct(d.w, 1, false) + ' de la cartera</small></div>' +
        '<div class="prow-r"><b>' + eur(d.val) + '</b><span class="' + cls(d.chg) + '">' + (isNum(d.chg) ? pct(d.chg) + ' ' + dayWord(d) : '— hoy') + '</span><small class="' + cls(d.pl) + '">' + pct(d.plPct, 1) + ' · ' + signedEur(d.pl) + '</small></div></a>';
    }).join('') + '</section>' +
    '<p class="foot">• = sin cotización actual, valorada con el último precio del escritorio.</p>';
}

// ---------- Ficha ----------
function rangeBar(lo, hi, marks) {
  if (!(isNum(lo) && isNum(hi) && hi > lo)) return '';
  const pos = (v) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
  return '<div class="rbar"><div class="rtrack"></div>' + marks.filter((m) => isNum(m.v)).map((m) =>
    '<div class="rmark ' + m.k + '" style="left:' + pos(m.v).toFixed(1) + '%"><span>' + esc(m.l) + '</span></div>').join('') + '</div>';
}

function scenarios(d) {
  const th = d.p.th || {}, sc = th.sc || {};
  const keys = SCN.filter(([k]) => sc[k] && isNum(sc[k].p));
  if (!keys.length) return '';
  const cur = th.cur || d.p.cur, now = d.priceIn(cur);
  let sw = 0, sp = 0;
  keys.forEach(([k]) => { const pr = prob(sc[k].pr); if (isNum(pr)) { sw += pr; sp += pr * sc[k].p; } });
  const ev = sw > 0 ? sp / sw : null;
  const vals = keys.map(([k]) => sc[k].p).concat(isNum(now) ? [now] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.06 || hi * 0.05;
  return '<section class="card"><h2>Escenarios</h2>' +
    rangeBar(lo - pad, hi + pad, keys.map(([k, l]) => ({ v: sc[k].p, k: 'sc-' + k, l: SCN_SHORT[k] })).concat([{ v: now, k: 'now', l: 'hoy' }])) +
    '<table class="tbl"><thead><tr><th></th><th>Precio</th><th>Potencial</th><th>Prob.</th></tr></thead><tbody>' +
    keys.map(([k, l]) => {
      const s = sc[k], up = isNum(now) && now > 0 ? s.p / now - 1 : null;
      return '<tr><td><span class="sw sc-' + k + '"></span>' + l + (s.d ? '<small>' + date(s.d) + '</small>' : '') + '</td><td>' + price(s.p, cur) + '</td><td class="' + cls(up) + '">' + pct(up, 0) + '</td><td>' + (isNum(prob(s.pr)) ? pct(prob(s.pr), 0, false) : '—') + '</td></tr>';
    }).join('') +
    (isNum(ev) ? '<tr class="ev"><td>Esperado</td><td>' + price(ev, cur) + '</td><td class="' + cls(isNum(now) ? ev / now - 1 : null) + '">' + (isNum(now) ? pct(ev / now - 1, 0) : '—') + '</td><td></td></tr>' : '') +
    '</tbody></table>' + (isNum(now) ? '' : '<p class="foot">No se puede comparar: falta el cambio a ' + esc(cur) + '.</p>') + '</section>';
}

function healthCard(p) {
  const th = p.th || {}, h = th.health;
  const C = 2 * Math.PI * 26, f = isNum(h) ? Math.max(0, Math.min(100, h)) / 100 : 0;
  const conv = isNum(th.conv) ? '<div class="conv" aria-label="Convicción ' + th.conv + ' de 5">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= th.conv ? 'on' : '') + '"></i>').join('') + '</div>' : '';
  return '<section class="card"><h2>Salud de la tesis</h2><div class="health">' +
    '<svg viewBox="0 0 64 64" class="ring ' + healthCls(h) + '"><circle cx="32" cy="32" r="26" class="bg"/><circle cx="32" cy="32" r="26" class="fg" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
    '<text x="32" y="37">' + (isNum(h) ? Math.round(h) : '—') + '</text></svg>' +
    '<div class="health-txt"><b>' + esc(th.verdict || 'Sin veredicto') + '</b>' +
    (th.status ? '<div>' + chip(th.status) + '</div>' : '') +
    (conv ? '<div class="muted small">Convicción ' + conv + '</div>' : '') +
    (th.updated ? '<div class="muted small">Notas actualizadas el ' + date(th.updated) + '</div>' : '') + '</div></div>' +
    ((th.avisos || []).length ? '<div class="alist">' + th.avisos.map((a) => '<div class="aitem ' + (a.s === 'high' ? 'high' : 'med') + '"><b>' + esc(a.t) + '</b>' + (a.d ? '<p>' + esc(a.d) + '</p>' : '') + '</div>').join('') + '</div>' : '') +
    '</section>';
}

function sellCard(p) {
  const s = (p.th && p.th.sell) || [];
  if (!s.length) return '';
  return '<section class="card"><h2>Criterios de venta</h2><ul class="sell">' + s.map((c) =>
    '<li class="' + (c.x ? 'hit' : '') + '"><span class="mark">' + (c.x ? '!' : '') + '</span><div>' + esc(c.t) +
    '<div class="tags">' + (c.l ? chip(c.l) : '') + (c.x ? chip('tocado', 'bad') : '') + '</div></div></li>').join('') + '</ul></section>';
}

function datesCard(p) {
  const th = p.th || {}, rows = [];
  const when = (s) => { const n = daysUntil(s); return n == null ? '' : n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 0 ? 'hace ' + -n + ' días' : 'en ' + n + ' días'; };
  if (th.nextE) rows.push({ d: th.nextE, k: 'Próximos resultados', t: '' });
  (th.ev || []).forEach((e) => { if (e.d !== th.nextE || (e.t && e.t.trim())) rows.push({ d: e.d, k: e.k || 'Evento', t: e.t, ok: e.ok }); });
  if (th.review) rows.push({ d: th.review, k: 'Revisión de la tesis', t: '' });
  if (!rows.length) return '';
  rows.sort((a, b) => (a.d < b.d ? -1 : 1));
  return '<section class="card"><h2>Próximas fechas</h2>' + rows.map((r) =>
    '<div class="date-row"><div class="date-d"><b>' + date(r.d) + '</b><small>' + when(r.d) + '</small></div><div><b>' + esc(r.k) + '</b>' +
    (r.ok === true ? ' ' + chip('confirmada', 'ok') : r.ok === false ? ' ' + chip('estimada') : '') + (r.t ? '<p>' + esc(r.t) + '</p>' : '') + '</div></div>').join('') + '</section>';
}

function textBlock(id, title, body, ui) {
  if (!body || !String(body).trim()) return '';
  const open = ui.open.has(id);
  return '<section class="card"><button class="fold' + (open ? ' open' : '') + '" data-fold="' + id + '"><h2>' + title + '</h2>' + chev + '</button>' + (open ? '<div class="prose">' + paras(body) + '</div>' : '') + '</section>';
}

export function detail(S, id) {
  const d = S.M.pos.find((x) => String(x.p.id) === String(id));
  if (!d) return '<p class="empty">Esa posición ya no está en el paquete.</p><p><a class="btn" href="#/posiciones">Volver a posiciones</a></p>';
  const p = d.p, cur = p.cur;
  const now = d.priceIn(cur);
  const meta = [p.ty, p.ctry, p.sec, p.q && p.q.ex].filter(Boolean).map(esc).join(' · ');
  return '<a class="back" href="#/posiciones">‹ Posiciones</a>' +
    '<section class="hero detail"><div class="lbl">' + esc(p.t) + (p.q && p.q.isin ? ' · ' + esc(p.q.isin) : '') + '</div>' +
    '<h1>' + esc(p.n) + '</h1><div class="muted small">' + meta + '</div>' +
    '<div class="big">' + price(d.px, d.cur) + '</div>' +
    '<div class="day ' + cls(d.chg) + '">' + (isNum(d.chg) ? pct(d.chg) + ' ' + (d.today ? 'hoy' : 'en la última sesión') + ' · ' + signedEur(d.dayPl) : '<span class="muted">Sin variación del día</span>') + '</div>' +
    '<div class="muted small">' + esc(d.src) + ' · ' + (d.isLive ? (d.today ? time(d.at) : dateTime(new Date(d.at).toISOString())) : 'precio del ' + dateTime(S.pkg.generatedAt)) + '</div>' +
    (p.strat ? '<div class="tags">' + chip(p.strat, 'accent') + '</div>' : '') + '</section>' +
    '<section class="card"><h2>Posición</h2><div class="grid2">' +
      '<div><span>Valor</span><b>' + eur(d.val) + '</b></div>' +
      '<div><span>Peso</span><b>' + pct(d.w, 1, false) + '</b></div>' +
      '<div><span>Ganancia</span><b class="' + cls(d.pl) + '">' + signedEur(d.pl) + '</b></div>' +
      '<div><span>Ganancia %</span><b class="' + cls(d.plPct) + '">' + pct(d.plPct, 1) + '</b></div>' +
      '<div><span>Títulos</span><b>' + num(p.sh, p.sh % 1 ? 4 : 0) + '</b></div>' +
      '<div><span>Precio medio</span><b>' + price(p.buy, cur) + '</b></div>' +
      '<div><span>Invertido</span><b>' + eur(p.inv) + '</b></div>' +
      '<div><span>Moneda</span><b>' + esc(cur || '—') + '</b></div>' +
    '</div>' +
    (isNum(p.lo) && isNum(p.hi) ? '<h3>Rango de 52 semanas</h3>' + rangeBar(Math.min(p.lo, now || p.lo), Math.max(p.hi, now || p.hi), [{ v: p.buy, k: 'buy', l: 'compra' }, { v: now, k: 'now', l: 'hoy' }]) +
      '<div class="rlbl"><span>' + price(p.lo, cur) + '</span><span>' + price(p.hi, cur) + '</span></div>' : '') +
    '</section>' +
    scenarios(d) + healthCard(p) + sellCard(p) + datesCard(p) +
    textBlock('t:' + p.id, 'Tesis', p.th && p.th.text, S.ui) +
    textBlock('c:' + p.id, 'Catalizadores', p.th && p.th.cat, S.ui) +
    textBlock('r:' + p.id, 'Riesgos', p.th && p.th.risks, S.ui) +
    '<p class="foot">Salud, avisos, escenarios y criterios son del escritorio, a fecha de ' + dateTime(S.pkg.generatedAt) + '.</p>';
}

// ---------- Avisos ----------
export function alerts(S) {
  const A = S.alerts;
  const link = (p) => '<a href="#/pos/' + encodeURIComponent(p.id) + '">' + esc(p.t) + '</a>';
  const sec = (title, body) => '<section class="card"><h2>' + title + '</h2>' + body + '</section>';
  let h = '';
  if (A.data.length) h += sec('Estado de los datos', A.data.map((a) => '<div class="aitem ' + a.s + '"><b>' + esc(a.t) + '</b><p>' + esc(a.d) + '</p></div>').join(''));
  if (A.sell.length) h += sec('Criterios de venta tocados', A.sell.map((x) => '<div class="aitem high"><b>' + link(x.p) + ' · ' + esc(x.s.t) + '</b>' + (x.s.l ? '<div class="tags">' + chip(x.s.l) + '</div>' : '') + '</div>').join(''));
  if (A.thesis.length) h += sec('Avisos de las tesis', A.thesis.map((x) => '<div class="aitem ' + (x.a.s === 'high' ? 'high' : 'med') + '"><b>' + link(x.p) + ' · ' + esc(x.a.t) + '</b>' + (x.a.d ? '<p>' + esc(x.a.d) + '</p>' : '') + '</div>').join(''));
  if (A.ideas.length) h += sec('Ideas en precio de compra', A.ideas.map((x) => '<div class="aitem ok"><b>' + esc(x.i.t) + ' · ' + esc(x.i.n) + '</b><p>' + price(x.px, x.i.cur) + ' ' + (x.i.dir === 'above' ? 'por encima de' : 'por debajo de') + ' ' + price(x.i.trg, x.i.cur) +
    (isNum(x.i.base) && x.px > 0 ? ' · objetivo base ' + price(x.i.base, x.i.cur) + ' (' + pct(x.i.base / x.px - 1, 0) + ')' : '') + (x.isLive ? '' : ' · precio del escritorio') + '</p></div>').join(''));
  if (A.dates.length) h += sec('Próximos 14 días', A.dates.map((x) => '<div class="date-row"><div class="date-d"><b>' + date(x.d) + '</b><small>' + (x.n === 0 ? 'hoy' : x.n < 0 ? 'vencida' : x.n === 1 ? 'mañana' : 'en ' + x.n + ' días') + '</small></div><div><b>' + link(x.p) + ' · ' + esc(x.k || 'Evento') + '</b>' + (x.ok === false ? ' ' + chip('estimada') : '') + (x.t ? '<p>' + esc(x.t) + '</p>' : '') + '</div></div>').join(''));
  const near = S.M.ideas.filter((x) => !x.hit && isNum(x.dist) && Math.abs(x.dist) <= 0.05);
  if (near.length) h += sec('Ideas cerca del disparo', near.map((x) => '<div class="kv"><span>' + esc(x.i.t) + ' <small class="muted">' + esc(x.i.n) + '</small></span><b>' + pct(x.dist, 1) + '</b></div>').join(''));
  if (!h) h = '<div class="card"><p class="empty">Sin avisos. Todo en orden a fecha de ' + dateTime(S.pkg.generatedAt) + '.</p></div>';
  return h;
}

// ---------- Configuración y acceso ----------
export function setup(cfg, msg) {
  return '<section class="card form"><h1>Conectar con el escritorio</h1>' +
    '<p class="muted">En la app de escritorio abre «Sincronizar con el móvil» y copia el identificador del gist. La contraseña es la misma que pusiste allí.</p>' +
    '<form id="f-setup" autocomplete="off">' +
    '<label>Identificador del gist<input name="gist" required value="' + esc(cfg.gistId || '') + '" placeholder="p. ej. 8f3c…e21a" autocapitalize="off" spellcheck="false"></label>' +
    '<label>Contraseña de cifrado<input name="pass" type="password" required autocomplete="current-password"></label>' +
    '<label class="check"><input name="remember" type="checkbox"> Recordar la contraseña en este móvil</label>' +
    '<p class="foot">Si la recuerdas, se guarda sin cifrar en el almacenamiento de esta app: quien tenga tu móvil desbloqueado podrá ver la cartera. Si no, te la pedirá cada vez que abras la app.</p>' +
    (msg ? '<p class="msg err">' + esc(msg) + '</p>' : '') +
    '<button class="btn primary" type="submit">Conectar</button></form></section>';
}

export function locked(cfg, msg, offline) {
  return '<section class="card form"><h1>Cartera bloqueada</h1>' +
    '<p class="muted">Escribe la contraseña de cifrado para abrir la copia de la cartera.</p>' +
    '<form id="f-unlock" autocomplete="off">' +
    '<label>Contraseña<input name="pass" type="password" required autocomplete="current-password" autofocus></label>' +
    '<label class="check"><input name="remember" type="checkbox"> Recordar en este móvil</label>' +
    (msg ? '<p class="msg err">' + esc(msg) + '</p>' : '') +
    (offline ? '<p class="msg">Sin conexión: se abrirá la última copia guardada.</p>' : '') +
    '<button class="btn primary" type="submit">Abrir</button></form>' +
    '<p class="foot">Gist ' + esc(cfg.gistId) + ' · <a href="#/ajustes">Ajustes</a></p></section>';
}

export function settings(cfg, info) {
  return '<a class="back" href="#/resumen">‹ Volver</a>' +
    '<section class="card form"><h1>Ajustes</h1><form id="f-settings" autocomplete="off">' +
    '<label>Identificador del gist<input name="gist" value="' + esc(cfg.gistId || '') + '" autocapitalize="off" spellcheck="false"></label>' +
    '<label>Clave de Twelve Data <small>(opcional: tiempo real para acciones de EE. UU.)</small><input name="td" type="password" value="' + esc(cfg.tdKey || '') + '" autocapitalize="off" spellcheck="false" placeholder="Sin clave: todo por Yahoo, ~15 min de retraso"></label>' +
    '<label>Intermediario para Yahoo y fondos<input name="proxy" value="' + esc(cfg.proxy || '') + '" placeholder="' + esc(DEFAULT_PROXY) + '" autocapitalize="off" spellcheck="false"></label>' +
    '<p class="foot">{url} se sustituye por la dirección de Yahoo tal cual; {urlenc}, codificada. Vacío = ' + esc(DEFAULT_PROXY) + '.</p>' +
    '<label class="check"><input name="remember" type="checkbox"' + (cfg.pass ? ' checked' : '') + '> Recordar la contraseña en este móvil</label>' +
    '<button class="btn primary" type="submit">Guardar</button></form></section>' +
    '<section class="card"><h2>Estado</h2>' + info.map(([k, v]) => '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</section>' +
    '<section class="card"><h2>Este dispositivo</h2>' +
    '<button class="btn" id="b-lock">Bloquear ahora</button> ' +
    '<button class="btn danger" id="b-forget">Olvidar todo</button>' +
    '<p class="foot">«Olvidar todo» borra de este móvil el identificador, la contraseña, las claves y la copia cifrada. No toca el gist ni el escritorio.</p></section>';
}

export function loading(text) {
  return '<div class="loading"><div class="spin"></div><p>' + esc(text || 'Cargando…') + '</p></div>';
}

export function errorView(msg) {
  return '<section class="card"><h2>No se pudo abrir la cartera</h2><p class="msg err">' + esc(msg) + '</p><button class="btn" id="b-retry">Reintentar</button> <a class="btn" href="#/ajustes">Ajustes</a></section>';
}
