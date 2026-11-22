// app.js — Arranque, estado, rutas y eventos.
import { loadCfg, saveCfg, cachedEnvelope, forgetAll, fetchEnvelope, decryptEnvelope, normalizeGistId, UserError } from './data.js';
import { createQuotes } from './quotes.js';
import { compute, alertsOf } from './model.js';
import * as V from './views.js';
import { ago, time, dateTime } from './format.js';

const UI_KEY = 'cm_ui_v1';
const QUOTE_EVERY = 5 * 60 * 1000;
const $ = (s) => document.querySelector(s);

const S = {
  cfg: loadCfg(),
  pass: null,          // contraseña en memoria (solo si no se recuerda)
  env: null, envFrom: null, envAt: null, gistErr: null,
  pkg: null, M: null, alerts: null,
  phase: 'boot',       // boot | setup | locked | loading | ready | error
  msg: null,
  ui: Object.assign({ sort: 'val', dir: 'desc', filter: 'all' }, (() => { try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; } })(), { open: new Set() }),
};
const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ sort: S.ui.sort, dir: S.ui.dir, filter: S.ui.filter })); } catch (e) {} };

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
  let key = S.phase + ':' + r.name + ':' + (r.arg || '');
  const formy = S.phase === 'setup' || S.phase === 'locked' || r.name === 'ajustes';
  // Las pantallas con formularios no se repintan por las cotizaciones: se perdería lo escrito.
  if (!force && formy && key === lastKey) { header(); return; }
  const changedView = key !== lastKey;
  lastKey = key;

  if (S.pkg) { S.M = compute(S.pkg, quotes); S.alerts = alertsOf(S.pkg, S.M, quotes); }
  header();
  tabs(r.name);
  const v = $('#view');
  let html;
  if (r.name === 'ajustes' && S.phase !== 'boot') html = V.settings(S.cfg, statusInfo());
  else if (S.phase === 'setup') html = V.setup(S.cfg, S.msg);
  else if (S.phase === 'locked') html = V.locked(S.cfg, S.msg, !navigator.onLine && !!cachedEnvelope());
  else if (S.phase === 'loading' || S.phase === 'boot') html = V.loading(S.msg);
  else if (S.phase === 'error') html = V.errorView(S.msg);
  else if (r.name === 'posiciones') html = V.positions(S);
  else if (r.name === 'pos') html = V.detail(S, r.arg);
  else if (r.name === 'avisos') html = V.alerts(S);
  else html = V.summary(S);
  v.innerHTML = html;
  if (changedView) window.scrollTo(0, 0);
  const pw = v.querySelector('input[type=password][autofocus]');
  if (pw && changedView) pw.focus();
}

function header() {
  const sub = $('#sub'), ready = S.phase === 'ready' && S.pkg;
  document.body.classList.toggle('clone', !!(S.pkg && S.pkg.clone));
  $('#b-refresh').hidden = !ready;
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
}

function statusInfo() {
  const st = quotes.status, fx = quotes.fx;
  const info = [];
  if (S.pkg) {
    info.push(['Datos del escritorio', dateTime(S.pkg.generatedAt) + ' (v' + (S.pkg.appVersion || '?') + ')']);
    info.push(['Copia descargada', S.envFrom === 'red' ? 'ahora, del gist' : 'guardada en el móvil']);
    info.push(['Posiciones con precio actual', (S.M ? S.M.nLive : 0) + ' de ' + S.pkg.positions.length]);
    info.push(['Cambio de divisas', fx.src ? fx.src : 'el del paquete']);
    info.push(['Última actualización de precios', st.lastAt ? time(st.lastAt) : '—']);
  }
  info.push(['Twelve Data', S.cfg.tdKey ? 'con clave' : 'sin clave']);
  info.push(['Contraseña', S.cfg.pass ? 'recordada en este móvil' : 'se pide al abrir']);
  info.push(['Versión de la app', '1.0.0']);
  return info;
}

// ---------- carga ----------
function passNow() { return S.cfg.pass || S.pass; }

async function open(pass, { fromForm } = {}) {
  S.phase = 'loading'; S.msg = 'Descifrando…'; render(true);
  const cached = cachedEnvelope();
  const haveCache = cached && cached.gistId === S.cfg.gistId;
  let env = null, from = null, err = null;
  // Con copia guardada y contraseña recordada se abre al instante y luego se consulta el gist.
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
    S.pkg = pkg; S.phase = 'ready'; S.msg = null;
    render(true);
    if (from === 'copia' && !err) background(pass);
    else quotes.refresh(S.pkg);
    return true;
  } catch (e) {
    if (e instanceof UserError && e.code === 'badpass') {
      S.cfg.pass = undefined; saveCfg(S.cfg); S.pass = null;
      S.phase = 'locked'; S.msg = 'Contraseña incorrecta.';
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

function boot() {
  if (!S.cfg.gistId) { S.phase = 'setup'; render(true); return; }
  if (!passNow()) { S.phase = 'locked'; render(true); return; }
  open(passNow());
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
    if (await open(pass, { fromForm: true })) location.hash = '#/resumen';
  } else if (f.id === 'f-settings') {
    const gist = normalizeGistId(val('gist'));
    const gistChanged = gist && gist !== S.cfg.gistId;
    S.cfg.tdKey = val('td').trim() || undefined;
    S.cfg.proxy = val('proxy').trim() || undefined;
    if (!chk('remember')) { if (S.cfg.pass) S.pass = S.cfg.pass; S.cfg.pass = undefined; }
    else if (!S.cfg.pass && passNow()) S.cfg.pass = passNow();
    if (gistChanged) S.cfg.gistId = gist;
    saveCfg(S.cfg);
    if (gistChanged) { quotes.stop(); S.pkg = null; location.hash = '#/resumen'; if (passNow()) open(passNow(), { fromForm: true }); else { S.phase = 'locked'; render(true); } }
    else { location.hash = '#/resumen'; if (S.phase === 'ready') quotes.refresh(S.pkg); }
  }
});

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.id === 'b-refresh') manualRefresh();
  else if (t.id === 'b-retry') boot();
  else if (t.dataset.filter) { S.ui.filter = t.dataset.filter; saveUi(); render(true); }
  else if (t.id === 'sortdir') { S.ui.dir = S.ui.dir === 'asc' ? 'desc' : 'asc'; saveUi(); render(true); }
  else if (t.dataset.fold) { const k = t.dataset.fold; S.ui.open.has(k) ? S.ui.open.delete(k) : S.ui.open.add(k); render(true); }
  else if (t.id === 'b-lock') { S.cfg.pass = undefined; saveCfg(S.cfg); S.pass = null; S.pkg = null; quotes.stop(); S.phase = 'locked'; S.msg = null; location.hash = '#/resumen'; render(true); }
  else if (t.id === 'b-forget') {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = '¿Seguro? Pulsa otra vez'; return; }
    forgetAll(); quotes.stop(); S.cfg = {}; S.pass = null; S.pkg = null; S.phase = 'setup'; S.msg = null; location.hash = '#/resumen'; render(true);
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'sort') { S.ui.sort = ev.target.value; S.ui.dir = 'desc'; saveUi(); render(true); }
});
window.addEventListener('hashchange', () => render(true));
window.addEventListener('online', () => { if (S.phase === 'ready') manualRefresh(); else render(true); });
window.addEventListener('offline', () => render(false));

// Precios: al volver a la app y cada 5 minutos mientras está a la vista.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.phase === 'ready' && !quotes.status.running && Date.now() - quotes.status.lastAt > QUOTE_EVERY) quotes.refresh(S.pkg);
});
setInterval(() => {
  if (document.visibilityState === 'visible' && S.phase === 'ready' && navigator.onLine && !quotes.status.running) quotes.refresh(S.pkg);
}, QUOTE_EVERY);
setInterval(() => { if (S.phase === 'ready') header(); }, 30000);

// ---------- service worker ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const n = $('#update'); n.hidden = false;
        }
      });
    });
  }).catch(() => {});
}
$('#update').addEventListener('click', async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg && reg.waiting) reg.waiting.postMessage('skip'); else location.reload();
});
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && $('#update').hidden === false) { reloaded = true; location.reload(); } });
}

boot();
