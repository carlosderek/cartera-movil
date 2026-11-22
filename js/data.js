// data.js — Configuración, descarga del gist y descifrado del paquete.
// Contrato: SINCRONIZACION-MOVIL.md (sobre v1, paquete schema 1).

const CFG_KEY = 'cm_cfg_v1';   // { gistId, pass?, tdKey?, proxy? }
const ENV_KEY = 'cm_env_v1';   // último sobre CIFRADO descargado (para abrir sin conexión)
const FILE = 'cartera-movil.json';
export const SCHEMA = 1;
export const DEFAULT_PROXY = 'https://r.jina.ai/{url}';
export const DEMO_ID = 'demo';

export class UserError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

export function loadCfg() { return lsGet(CFG_KEY) || {}; }
export function saveCfg(c) { lsSet(CFG_KEY, c); }
export function cachedEnvelope() { return lsGet(ENV_KEY); }
export function forgetAll() { lsSet(CFG_KEY, null); lsSet(ENV_KEY, null); }

// Acepta el identificador o la URL completa del gist.
export function normalizeGistId(s) {
  s = String(s || '').trim();
  if (s.toLowerCase() === DEMO_ID) return DEMO_ID;
  const m = /([0-9a-f]{20,})\/?(?:#.*)?$/i.exec(s);
  return m ? m[1].toLowerCase() : s;
}

// ---------- descarga ----------
function validEnvelope(e) {
  return e && e.app === 'cartera-movil' && e.v === 1 && typeof e.ct === 'string' && typeof e.iv === 'string' && typeof e.salt === 'string';
}

export async function fetchEnvelope(gistId) {
  if (!navigator.onLine) throw new UserError('Sin conexión.', 'offline');
  let text;
  try {
    if (gistId === DEMO_ID) {
      const r = await fetch('demo/' + FILE, { cache: 'no-store' });
      if (!r.ok) throw new UserError('No se encuentra el paquete de ejemplo.', 'http');
      text = await r.text();
    } else {
      const r = await fetch('https://api.github.com/gists/' + encodeURIComponent(gistId), {
        cache: 'no-store', headers: { Accept: 'application/vnd.github+json' },
      });
      if (r.status === 404) throw new UserError('No existe ese gist. Revisa el identificador.', 'notfound');
      if (r.status === 403 || r.status === 429) {
        const reset = +r.headers.get('x-ratelimit-reset');
        const when = reset ? ' Vuelve a intentarlo después de las ' + new Date(reset * 1000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + '.' : '';
        throw new UserError('GitHub ha limitado las consultas desde esta conexión (60 por hora).' + when, 'ratelimit');
      }
      if (!r.ok) throw new UserError('GitHub respondió ' + r.status + '.', 'http');
      const g = await r.json();
      const f = g.files && g.files[FILE];
      if (!f) throw new UserError('El gist no contiene ' + FILE + '.', 'nofile');
      text = f.content;
      if (f.truncated || !text) {
        const rr = await fetch(f.raw_url, { cache: 'no-store' });
        if (!rr.ok) throw new UserError('No se pudo leer el contenido completo del gist.', 'http');
        text = await rr.text();
      }
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError('No se pudo conectar con GitHub.', 'network');
  }
  let env;
  try { env = JSON.parse(text); } catch (e) { throw new UserError('El archivo del gist no es un sobre válido.', 'format'); }
  if (!validEnvelope(env)) throw new UserError('El archivo del gist no es un sobre de cartera-movil (v1).', 'format');
  lsSet(ENV_KEY, { gistId, env, fetchedAt: new Date().toISOString() });
  return env;
}

// ---------- descifrado ----------
const unb64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const keyCache = new Map(); // salt|iter|pass → CryptoKey (solo en memoria)

async function keyOf(pass, saltB64, iter) {
  const k = saltB64 + '|' + iter + '|' + pass;
  if (keyCache.has(k)) return keyCache.get(k);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  keyCache.clear();
  keyCache.set(k, key);
  return key;
}

export async function decryptEnvelope(env, pass) {
  if (!(window.crypto && crypto.subtle)) throw new UserError('Este navegador no permite descifrar (hace falta HTTPS).', 'crypto');
  if (!(env.iter > 0)) throw new UserError('El sobre no indica las iteraciones.', 'format');
  let pt;
  try {
    const key = await keyOf(pass, env.salt, env.iter);
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
  } catch (e) {
    throw new UserError('Contraseña incorrecta.', 'badpass');
  }
  let pkg;
  try { pkg = JSON.parse(new TextDecoder().decode(pt)); } catch (e) { throw new UserError('El paquete descifrado no es JSON válido.', 'format'); }
  if (!pkg || pkg.app !== 'cartera-movil') throw new UserError('El paquete no es de cartera-movil.', 'format');
  if (pkg.schema > SCHEMA) throw new UserError('El escritorio usa un formato más nuevo (schema ' + pkg.schema + '). Actualiza esta app.', 'schema');
  if (!Array.isArray(pkg.positions)) pkg.positions = [];
  if (!Array.isArray(pkg.cash)) pkg.cash = [];
  if (!Array.isArray(pkg.ideas)) pkg.ideas = [];
  pkg.totals = pkg.totals || {};
  pkg.positions.forEach((p) => { p.th = p.th || {}; p.q = p.q || {}; });
  return pkg;
}
