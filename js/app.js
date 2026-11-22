// app.js — Arranque, estado, rutas y eventos.
import { loadCfg, saveCfg, cachedEnvelope, forgetAll, fetchEnvelope, decryptEnvelope, normalizeGistId, UserError } from './data.js';
import { createQuotes } from './quotes.js';
import { compute, alertsOf } from './model.js';
import * as V from './views.js';
import * as Bio from './bio.js';
import { ago, time, dateTime, setPriv } from './format.js';

const APP_VERSION = '1.2.0';
const UI_KEY = 'cm_ui_v1';
const QUOTE_EVERY = 5 * 60 * 1000;
const $ = (s) => document.querySelector(s);

const S = {
  cfg: loadCfg(),
  pass: null,          // contraseña en memoria (si no se recuerda o va con huella)
  env: null, envFrom: null, envAt: null, gistErr: null,
  pkg: null, M: null, alerts: null,
  phase: 'boot',       // boot | setup | locked | loading | ready | error
  msg: null,
  ui: Object.assign({ sort: 'val', dir: 'desc', filter: 'all', range: '1y', brange: '1y', dist: 'ty', q: '' },
    (() => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } })(), { open: new Set() }),
};
const saveUi = () => { try { const u = S.ui; localStorage.setItem(UI_KEY, JSON.stringify({ sort: u.sort, dir: u.dir, filter: u.filter, priv: !!u.priv, range: u.range, brange: u.brange, dist: u.dist })); } catch (e) {} };
if (S.cfg.privStart) S.ui.priv = true;
setPriv(S.ui.priv);

const quotes = createQuotes({ getCfg: () => S.cfg, onChange: () => schedule() });

// ---------- render ----------
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(false); }); }

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: name || 'resumen', arg: arg ? decodeURIComponent(arg) : null };
}
let lastKey = '';

function render(force) {
  const r = route();
  const key = S.phase + ':' + r.name + ':' + (r.arg || '');
  const formy = S.phase === 'setup' || S.phase === 'locked' || r.name === 'ajustes';
  // Las pantallas con formularios no se repintan por las cotizaciones: se perdería lo escrito.
  if (!force && formy && key === lastKey) { header(); return; }
  const changedView = key !== lastKey;
  lastKey = key;

  if (S.pkg) { S.M = compute(S.pkg, quotes); S.alerts = alertsOf(S.pkg, S.M, quotes); }
  header();
  tabs(r.name);
  const v = $('#view');
  // Posiciones: con el buscador abierto, solo se repinta la lista (no se pierde el foco al escribir).
  if (!force && !changedView && S.phase === 'ready' && r.name === 'posiciones' && v.querySelector('#plist')) {
    v.querySelector('#plist').innerHTML = V.positionsList(S);
    return;
  }
  let html;
  if (r.name === 'ajustes' && S.phase !== 'boot') html = V.settings(S.cfg, statusInfo(), Bio.supported());
  else if (S.phase === 'setup') html = V.setup(S.cfg, S.msg);
  else if (S.phase === 'locked') html = V.locked(S.cfg, S.msg, !navigator.onLine && !!cachedEnvelope());
  else if (S.phase === 'loading' || S.phase === 'boot') html = V.loading(S.msg);
  else if (S.phase === 'error') html = V.errorView(S.msg);
  else if (r.name === 'posiciones') html = V.positions(S);
  else if (r.name === 'pos') html = V.detail(S, r.arg);
  else if (r.name === 'ideas') html = V.ideas(S);
  else if (r.name === 'avisos') html = V.alerts(S);
  else html = V.summary(S);
  const y = window.scrollY;
  v.innerHTML = html;
  if (changedView) window.scrollTo(0, 0); else if (window.scrollY !== y) window.scrollTo(0, y);
  const pw = v.querySelector('input[type=password][autofocus]');
  if (pw && changedView) pw.focus();
}

function header() {
  const sub = $('#sub'), ready = S.phase === 'ready' && S.pkg;
  document.body.classList.toggle('clone', !!(S.pkg && S.pkg.clone));
  $('#b-refresh').hidden = !ready;
  const eye = $('#b-priv');
  eye.hidden = !ready;
  eye.setAttribute('aria-pressed', S.ui.priv ? 'true' : 'false');
  eye.setAttribute('aria-label', S.ui.priv ? 'Mostrar importes' : 'Ocultar importes');
  eye.classList.toggle('on', !!S.ui.priv);
  if (!ready) { sub.textContent = ''; $('#notice').hidden = true; return; }
  const st = quotes.status;
  const q = st.running ? (st.waiting ? 'Precios ' + st.done + '/' + st.total + ' · esperando turno' : 'Precios ' + st.done + '/' + st.total + '…')
    : st.lastAt ? 'Precios ' + time(st.lastAt) : (navigator.onLine ? 'Precios…' : 'Sin conexión');
  sub.textContent = 'Escritorio ' + ago(S.pkg.generatedAt) + ' · ' + q;
  $('#b-refresh').classList.toggle('spinning', st.running);
  const n = $('#notice');
  const notes = [];
  if (S.pkg.clone) notes.push('<b>CLON DE PRUEBAS</b> · estos datos no son los de la app real');
  if (S.gistErr) notes.push('No se pudo actualizar del gist: ' + S.gistErr + ' Mostrando la copia del ' + dateTime(S.envAt) + '.');
  n.innerHTML = notes.join('<br>');
  n.hidden = !notes.length;
  n.className = 'notice' + (S.pkg.clone ? ' clone' : '');
}

function tabs(name) {
  const show = S.phase === 'ready';
  $('#tabs').hidden = !show;
  if (!show) return;
  const cur = name === 'pos' ? 'posiciones' : name;
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === cur));
  const b = $('#tab-badge'), c = S.alerts ? S.alerts.count : 0;
  b.textContent = c; b.hidden = !c;
  const ib = $('#tab-ideas'), ic = S.M ? S.M.ideas.filter((x) => x.hit).length : 0;
  ib.textContent = ic; ib.hidden = !ic;
}

function statusInfo() {
  const st = quotes.status, fx = quotes.fx;
  const info = [];
  if (S.pkg) {
    info.push(['Datos del escritorio', dateTime(S.pkg.generatedAt) + ' (v' + (S.pkg.appVersion || '?') + ', formato ' + S.pkg.schema + ')']);
    info.push(['Copia descargada', S.envFrom === 'red' ? 'ahora, del gist' : 'guardada en el móvil']);
    info.push(['Posiciones con precio actual', (S.M ? S.M.nLive : 0) + ' de ' + S.pkg.positions.length]);
    info.push(['Cambio de divisas', fx.src ? fx.src : 'el del paquete']);
    info.push(['Última actualización de precios', st.lastAt ? time(st.lastAt) : '—']);
  }
  info.push(['Twelve Data', S.cfg.tdKey ? 'con clave' : 'sin clave']);
  info.push(['Intermediario', S.cfg.proxy ? 'propio' : 'r.jina.ai']);
  info.push(['Contraseña', S.cfg.bio ? 'cifrada con la huella' : S.cfg.pass ? 'recordada sin cifrar' : 'se pide al abrir']);
  info.push(['Versión de la app', APP_VERSION]);
  return info;
}

// ---------- carga ----------
function passNow() { return S.cfg.pass || S.pass; }

async function open(pass, { fromForm } = {}) {
  S.phase = 'loading'; S.msg = 'Descifrando…'; render(true);
  const cached = cachedEnvelope();
  const haveCache = cached && cached.gistId === S.cfg.gistId;
  let env = null, from = null, err = null;
  // Con copia guardada se abre al instante y luego se consulta el gist.
  if (haveCache && !fromForm) { env = cached.env; from = 'copia'; }
  else {
    try { env = await fetchEnvelope(S.cfg.gistId); from = 'red'; }
    catch (e) { err = e; if (haveCache) { env = cached.env; from = 'copia'; } }
  }
  if (!env) { S.phase = fromForm ? 'locked' : 'error'; S.msg = err ? err.message : 'No hay datos.'; render(true); return false; }
  try {
    const pkg = await decryptEnvelope(env, pass);
    S.env = env; S.envFrom = from; S.envAt = haveCache && from === 'copia' ? cached.fetchedAt : new Date().toISOString();
    S.gistErr = err ? err.message : null;
    S.pass = pass;
    S.pkg = pkg; S.phase = 'ready'; S.msg = null;
    render(true);
    if (from === 'copia' && !err) background(pass);
    else { lastGistAt = Date.now(); quotes.refresh(S.pkg); }
    return true;
  } catch (e) {
    if (e instanceof UserError && e.code === 'badpass') {
      S.cfg.pass = undefined; saveCfg(S.cfg); S.pass = null;
      S.phase = 'locked'; S.msg = S.cfg.bio ? 'La contraseña guardada con la huella ya no vale (¿la cambiaste en el escritorio?). Escribe la nueva.' : 'Contraseña incorrecta.';
    } else { S.phase = 'error'; S.msg = e.message || String(e); }
    render(true);
    return false;
  }
}

// Consulta el gist en segundo plano y, si hay copia nueva, la descifra.
let lastGistAt = 0;
async function background(pass) {
  lastGistAt = Date.now();
  quotes.refresh(S.pkg);
  try {
    const env = await fetchEnvelope(S.cfg.gistId);
    S.gistErr = null; S.envFrom = 'red'; S.envAt = new Date().toISOString();
    if (!S.env || env.ct !== S.env.ct) {
      const pkg = await decryptEnvelope(env, pass);
      S.env = env; S.pkg = pkg;
      quotes.refresh(S.pkg);
    }
  } catch (e) {
    if (e instanceof UserError && e.code === 'badpass') {
      // La contraseña cambió en el escritorio: la copia antigua se abría, la nueva no.
      S.cfg.pass = undefined; saveCfg(S.cfg); S.pass = null; S.pkg = null; quotes.stop();
      S.phase = 'locked'; S.msg = 'El escritorio ha subido una copia con otra contraseña. Escribe la nueva.';
    } else S.gistErr = e.message || String(e);
  }
  render(S.phase !== 'ready');
}

function manualRefresh() {
  if (S.phase !== 'ready') return;
  // GitHub sin credencial: 60 peticiones/hora. Como mucho una consulta del gist por minuto.
  if (Date.now() - lastGistAt > 60000) background(passNow());
  else quotes.refresh(S.pkg);
}

async function bioUnlock() {
  if (!S.cfg.bio) return;
  try {
    const pass = await Bio.unlock(S.cfg.bio);
    if (await open(pass)) location.hash = location.hash || '#/resumen';
  } catch (e) { S.phase = 'locked'; S.msg = e.message; render(true); }
}

function boot() {
  if (!S.cfg.gistId) { S.phase = 'setup'; render(true); return; }
  if (passNow()) { open(passNow()); return; }
  S.phase = 'locked'; render(true);
  if (S.cfg.bio) bioUnlock();
}

function lock() {
  S.cfg.pass = undefined; saveCfg(S.cfg); S.pass = null; S.pkg = null; quotes.stop();
  if (S.cfg.privStart) { S.ui.priv = true; setPriv(true); }
  S.phase = 'locked'; S.msg = null; location.hash = '#/resumen'; render(true);
}

// ---------- eventos ----------
document.addEventListener('submit', async (ev) => {
  const f = ev.target;
  ev.preventDefault();
  const val = (n) => (f.elements[n] ? f.elements[n].value : '');
  const chk = (n) => !!(f.elements[n] && f.elements[n].checked);
  if (f.id === 'f-setup') {
    const gist = normalizeGistId(val('gist')), pass = val('pass');
    if (!gist) return;
    S.cfg.gistId = gist; S.cfg.pass = chk('remember') ? pass : undefined; S.pass = pass; saveCfg(S.cfg);
    const ok = await open(pass, { fromForm: true });
    if (!ok && S.phase !== 'ready') { S.phase = 'setup'; render(true); }
    if (ok) location.hash = '#/resumen';
  } else if (f.id === 'f-unlock') {
    const pass = val('pass');
    S.pass = pass; if (chk('remember')) { S.cfg.pass = pass; saveCfg(S.cfg); }
    if (await open(pass, { fromForm: true })) {
      // Con huella activada y contraseña nueva: se vuelve a guardar cifrada.
      if (S.cfg.bio) Bio.rewrap(S.cfg.bio, pass).then((b) => { S.cfg.bio = b; saveCfg(S.cfg); }).catch(() => {});
      location.hash = '#/resumen';
    }
  } else if (f.id === 'f-settings') {
    const gist = normalizeGistId(val('gist'));
    const gistChanged = gist && gist !== S.cfg.gistId;
    S.cfg.tdKey = val('td').trim() || undefined;
    S.cfg.proxy = val('proxy').trim() || undefined;
    S.cfg.privStart = chk('privStart') || undefined;
    if (!S.cfg.bio) {
      if (!chk('remember')) { if (S.cfg.pass) S.pass = S.cfg.pass; S.cfg.pass = undefined; }
      else if (!S.cfg.pass && passNow()) S.cfg.pass = passNow();
    }
    if (gistChanged) S.cfg.gistId = gist;
    saveCfg(S.cfg);
    if (gistChanged) { quotes.stop(); S.pkg = null; location.hash = '#/resumen'; if (passNow()) open(passNow(), { fromForm: true }); else { S.phase = 'locked'; render(true); } }
    else { location.hash = '#/resumen'; if (S.phase === 'ready') quotes.refresh(S.pkg); }
  }
});

async function bioOn(btn) {
  const msg = $('#bio-msg');
  const pass = passNow();
  if (!pass) { msg.textContent = 'Abre antes la cartera con la contraseña.'; return; }
  btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Sigue las instrucciones del móvil…';
  try {
    const bio = await Bio.enable(pass);
    // Comprobación: la huella devuelve la misma contraseña antes de borrar la copia en claro.
    if ((await Bio.unlock(bio)) !== pass) throw new Error('La comprobación no coincide; no se ha activado.');
    S.cfg.bio = bio; S.cfg.pass = undefined; S.pass = pass; saveCfg(S.cfg);
    render(true);
  } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; btn.disabled = false; }
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (t.id === 'b-refresh') manualRefresh();
  else if (t.id === 'b-priv') { S.ui.priv = !S.ui.priv; setPriv(S.ui.priv); saveUi(); render(true); }
  else if (t.id === 'b-retry') boot();
  else if (t.id === 'b-bio') bioUnlock();
  else if (t.id === 'b-bio-on') bioOn(t);
  else if (t.id === 'b-bio-off') {
    if (d.sure !== '1') { d.sure = '1'; t.textContent = '¿Seguro? Pulsa otra vez'; return; }
    S.cfg.bio = undefined; saveCfg(S.cfg); render(true);
  }
  else if (d.filter) { S.ui.filter = d.filter; saveUi(); render(true); }
  else if (d.range) { S.ui.range = d.range; saveUi(); render(true); }
  else if (d.brange) { S.ui.brange = d.brange; saveUi(); render(true); }
  else if (d.dist) { S.ui.dist = d.dist; saveUi(); render(true); }
  else if (t.id === 'sortdir') { S.ui.dir = S.ui.dir === 'asc' ? 'desc' : 'asc'; saveUi(); render(true); }
  else if (d.fold) { const k = d.fold; S.ui.open.has(k) ? S.ui.open.delete(k) : S.ui.open.add(k); render(true); }
  else if (t.id === 'b-lock') lock();
  else if (t.id === 'b-forget') {
    if (d.sure !== '1') { d.sure = '1'; t.textContent = '¿Seguro? Pulsa otra vez'; return; }
    forgetAll(); quotes.stop(); S.cfg = {}; S.pass = null; S.pkg = null; S.phase = 'setup'; S.msg = null; location.hash = '#/resumen'; render(true);
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'sort') { S.ui.sort = ev.target.value; S.ui.dir = 'desc'; saveUi(); render(true); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'q') { S.ui.q = ev.target.value; const l = $('#plist'); if (l) l.innerHTML = V.positionsList(S); }
});
window.addEventListener('hashchange', () => render(true));
window.addEventListener('online', () => { if (S.phase === 'ready') manualRefresh(); else render(true); });
window.addEventListener('offline', () => render(false));

// ---------- deslizar hacia abajo para refrescar ----------
(() => {
  const ind = $('#ptr');
  let y0 = null, dy = 0;
  const TH = 70;
  document.addEventListener('touchstart', (e) => {
    y0 = S.phase === 'ready' && window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || window.scrollY > 0) { ind.style.transform = ''; ind.classList.remove('show', 'ready'); return; }
    const h = Math.min(dy, TH * 1.6);
    ind.classList.add('show');
    ind.classList.toggle('ready', dy >= TH);
    ind.style.transform = 'translate(-50%,' + (h * 0.6) + 'px) rotate(' + (h * 3) + 'deg)';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 != null && dy >= TH && window.scrollY <= 0) manualRefresh();
    y0 = null; dy = 0; ind.style.transform = ''; ind.classList.remove('show', 'ready');
  });
})();

// Precios: al volver a la app y cada 5 minutos mientras está a la vista.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.phase === 'ready' && !quotes.status.running && Date.now() - quotes.status.lastAt > QUOTE_EVERY) quotes.refresh(S.pkg);
  // «Abrir siempre oculto»: al salir de la app se vuelven a ocultar los importes.
  if (document.visibilityState === 'hidden' && S.cfg.privStart && !S.ui.priv) { S.ui.priv = true; setPriv(true); saveUi(); render(true); }
});
setInterval(() => {
  if (document.visibilityState === 'visible' && S.phase === 'ready' && navigator.onLine && !quotes.status.running) quotes.refresh(S.pkg);
}, QUOTE_EVERY);
setInterval(() => { if (S.phase === 'ready') header(); }, 30000);

// ---------- service worker ----------
// Cuando se activa una versión nueva, se avisa para recargar (los archivos nuevos ya están descargados).
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) $('#update').hidden = false; });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
$('#update').addEventListener('click', () => location.reload());

boot();
