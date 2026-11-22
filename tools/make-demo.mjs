// Genera demo/cartera-movil.json: un sobre cifrado con datos INVENTADOS para probar la app.
// En la app: identificador del gist «demo» y la contraseña DEMO_PASS de abajo.
// Uso: node tools/make-demo.mjs
import { writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const DEMO_PASS = 'demo-cartera-2026';
const ITER = 310000;
const d = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };

function pos(o) {
  const val = o.sh * o.px * o.fx, inv = o.sh * o.buy * o.fx;
  return { id: o.id, t: o.t, n: o.n, ty: o.ty || 'Acción', cur: o.cur, fx: o.fx, sh: o.sh, px: o.px, chg: o.chg, buy: o.buy,
    inv: Math.round(inv * 100) / 100, val: Math.round(val * 100) / 100, pl: Math.round((val - inv) * 100) / 100, plPct: (val - inv) / inv, w: null,
    ctry: o.ctry, sec: o.sec, lo: o.lo, hi: o.hi, strat: o.strat || null, q: o.q, th: o.th || { avisos: [], sell: [], ev: [], sc: {} } };
}
const positions = [
  pos({ id: 'p1', t: 'MSFT', n: 'Microsoft Corp.', cur: 'USD', fx: 0.92, sh: 30, px: 452.1, chg: 0.0081, buy: 310, ctry: 'EE. UU.', sec: 'Software', lo: 385, hi: 468, strat: 'Compounder',
    q: { y: 'MSFT', ex: 'NASDAQ', isin: 'US5949181045' },
    th: { conv: 5, health: 82, verdict: 'Tesis intacta', status: 'Vigente', cur: 'USD',
      sc: { bear: { p: 340, pr: 0.15, d: d(365) }, conservative: { p: 430, pr: 0.25, d: d(365) }, base: { p: 540, pr: 0.45, d: d(365) }, bull: { p: 650, pr: 0.15, d: d(540) } },
      text: 'Ejemplo inventado. Franquicia de software empresarial con nube creciendo a doble dígito.\n\nLa IA amplía el gasto por cliente.', cat: 'Resultados del trimestre; adopción de Copilot.', risks: 'Capex en centros de datos más alto de lo previsto.',
      sell: [{ t: 'Crecimiento de Azure por debajo del 20 % dos trimestres seguidos', l: 'alto', x: false }, { t: 'Margen operativo < 40 %', l: 'medio', x: false }],
      ev: [{ d: d(9), k: 'Resultados', t: 'Q2 fiscal', ok: true }, { d: d(40), k: 'Dividendo', t: 'Pago trimestral', ok: false }],
      nextE: d(9), review: d(60), updated: d(-12), avisos: [] } }),
  pos({ id: 'p2', t: 'ASML', n: 'ASML Holding', cur: 'EUR', fx: 1, sh: 18, px: 668.4, chg: -0.0214, buy: 702, ctry: 'Países Bajos', sec: 'Semiconductores', lo: 590, hi: 940, strat: 'Calidad a buen precio',
    q: { y: 'ASML.AS', ex: 'AMS', isin: 'NL0010273215' },
    th: { conv: 4, health: 58, verdict: 'Vigilar', status: 'En revisión', cur: 'EUR',
      sc: { bear: { p: 520, pr: 0.2, d: d(365) }, base: { p: 850, pr: 0.6, d: d(365) }, bull: { p: 1050, pr: 0.2, d: d(540) } },
      text: 'Ejemplo inventado. Monopolio en litografía EUV.', cat: 'Pedidos de High-NA.', risks: 'Restricciones de exportación a China.',
      sell: [{ t: 'Pedidos netos por debajo de 3.000 M€ dos trimestres', l: 'alto', x: true }],
      ev: [{ d: d(3), k: 'Día del inversor', t: 'Actualización de objetivos 2030', ok: true }], nextE: d(55), review: d(-2), updated: d(-30),
      avisos: [{ s: 'high', t: 'Criterio de venta tocado', d: 'Los pedidos netos del último trimestre quedaron por debajo del umbral.' }, { s: 'med', t: 'Revisión vencida', d: 'La fecha de revisión de la tesis ya ha pasado.' }] } }),
  pos({ id: 'p3', t: 'ITX', n: 'Industria de Diseño Textil', cur: 'EUR', fx: 1, sh: 220, px: 51.3, chg: 0.0123, buy: 38.5, ctry: 'España', sec: 'Distribución', lo: 41.2, hi: 55.6,
    q: { y: 'ITX.MC', ex: 'BME', isin: 'ES0148396007' },
    th: { conv: 4, health: 74, verdict: 'Tesis intacta', status: 'Vigente', cur: 'EUR', sc: { conservative: { p: 48, pr: 0.3 }, base: { p: 60, pr: 0.5 }, bull: { p: 70, pr: 0.2 } },
      text: 'Ejemplo inventado.', sell: [], ev: [{ d: d(12), k: 'Resultados', t: '9M', ok: true }], nextE: d(12), avisos: [] } }),
  pos({ id: 'p4', t: 'BP', n: 'BP plc', cur: 'GBX', fx: 0.0119, sh: 1500, px: 412.5, chg: -0.0087, buy: 455, ctry: 'Reino Unido', sec: 'Petróleo y gas', lo: 380, hi: 520, strat: 'Valor profundo',
    q: { y: 'BP.L', ex: 'LSE', isin: 'GB0007980591' },
    th: { conv: 2, health: 35, verdict: 'Tesis debilitada', status: 'En revisión', cur: 'GBX', sc: { bear: { p: 330, pr: 0.35 }, base: { p: 480, pr: 0.5 }, bull: { p: 560, pr: 0.15 } },
      text: 'Ejemplo inventado.', sell: [{ t: 'Recorte del dividendo', l: 'alto', x: false }], ev: [], avisos: [{ s: 'high', t: 'Deuda neta al alza', d: 'La deuda neta sube tres trimestres seguidos.' }] } }),
  pos({ id: 'p5', t: 'BTC', n: 'Bitcoin', ty: 'Cripto', cur: 'EUR', fx: 1, sh: 0.25, px: 82000, chg: 0.031, buy: 41000, ctry: null, sec: 'Cripto', lo: 52000, hi: 95000,
    q: { cg: 'bitcoin', y: 'BTC-EUR' }, th: { conv: 3, health: null, sc: {}, sell: [], ev: [], avisos: [] } }),
  pos({ id: 'p6', t: 'VANG-GLB', n: 'Vanguard Global Stock Index EUR Acc', ty: 'Fondo', cur: 'EUR', fx: 1, sh: 140, px: 52.8, chg: 0.004, buy: 41.2, ctry: 'Global', sec: 'Fondo indexado', lo: null, hi: null,
    q: { isin: 'IE00B03HD191' }, th: { sc: {}, sell: [], ev: [], avisos: [] } }),
];
const value = positions.reduce((s, p) => s + p.val, 0), invested = positions.reduce((s, p) => s + p.inv, 0);
positions.forEach((p) => { p.w = p.val / value; });
positions.sort((a, b) => b.val - a.val);
const dayPl = positions.reduce((s, p) => s + p.val * p.chg / (1 + p.chg), 0);
const cash = [{ n: 'Cuenta broker', a: 8200 }, { n: 'Cuenta remunerada', a: 15000 }];
const cashT = cash.reduce((s, c) => s + c.a, 0);
const pkg = {
  schema: 1, app: 'cartera-movil', appVersion: '12.77', generatedAt: new Date(Date.now() - 3 * 3600e3).toISOString(), clone: false,
  totals: { value, invested, pl: value - invested, dayPl, dayPct: dayPl / (value - dayPl), cash: cashT, grand: value + cashT },
  positions, cash,
  ideas: [
    { t: 'NVO', n: 'Novo Nordisk', cur: 'USD', px: 58.2, chg: -0.012, trg: 60, dir: 'below', conv: 4, base: 95, q: { y: 'NVO' } },
    { t: 'RACE', n: 'Ferrari', cur: 'EUR', px: 402, chg: 0.004, trg: 380, dir: 'below', conv: 5, base: 470, q: { y: 'RACE.MI' } },
  ],
  cycle: { phase: 3, lbl: 'Expansión tardía', R: 0.42, next: 4, nextLbl: 'Desaceleración', p: 0.35, week: 47, prov: false,
    fga: { lbl: 'Crecimiento con inflación', watch: true, date: d(-5), stale: false } },
};

const b64 = (u) => Buffer.from(u).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(DEMO_PASS), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(pkg)));
const env = { v: 1, app: 'cartera-movil', alg: 'AES-GCM-256', kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)), at: new Date().toISOString() };
writeFileSync('demo/cartera-movil.json', JSON.stringify(env));
console.log('demo/cartera-movil.json generado (' + positions.length + ' posiciones)');
