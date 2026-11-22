// proxy.js — Intermediario propio para la app del móvil (Cloudflare Workers, plan gratuito).
//
// Sustituye a r.jina.ai: reenvía las peticiones de cotizaciones a Yahoo, quefondos y CoinGecko y
// añade la cabecera CORS que esos servicios no ponen. Solo admite esos destinos y solo responde
// a la app publicada (ORIGINS), para que nadie más lo use a tu costa.
//
// Uso desde la app: Ajustes → Intermediario → https://<tu-worker>.workers.dev/?url={urlenc}

const ORIGINS = ['https://carlosderek.github.io', 'http://localhost:8080'];
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'www.quefondos.com', 'api.coingecko.com'];
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'GET') return new Response('Método no admitido', { status: 405, headers: cors(origin) });
    if (origin && !ORIGINS.includes(origin)) return new Response('Origen no admitido', { status: 403 });

    let target;
    try { target = new URL(new URL(request.url).searchParams.get('url') || ''); } catch (e) { return new Response('Falta ?url=', { status: 400, headers: cors(origin) }); }
    if (target.protocol !== 'https:' || !HOSTS.includes(target.hostname)) return new Response('Destino no admitido', { status: 403, headers: cors(origin) });

    // Caché corta en el borde de Cloudflare: varias aperturas seguidas no repiten la petición.
    const ttl = target.hostname === 'www.quefondos.com' ? 3600 : 60;
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json,text/html;q=0.9,*/*;q=0.8' },
      cf: { cacheTtl: ttl, cacheEverything: true },
    });
    const h = new Headers(cors(origin));
    h.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8');
    h.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: h });
  },
};
