// Genera los iconos PNG de la app sin dependencias (node tools/make-icons.mjs).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, px) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const inRR = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
// Escena en coordenadas 0..1: fondo + tres barras crecientes.
function scene(maskable) {
  const s = maskable ? 0.62 : 0.78, o = (1 - s) / 2; // zona segura del icono adaptable
  const bars = [[0.12, 0.55, '#3a4a63'], [0.40, 0.35, '#5aa2ff'], [0.68, 0.12, '#3fb97a']];
  return (x, y) => {
    let c = null;
    if (maskable || inRR(x, y, 0.02, 0.02, 0.98, 0.98, 0.2)) c = hex('#0e1116');
    const u = (x - o) / s, v = (y - o) / s;
    for (const [bx, top, col] of bars) if (inRR(u, v, bx, top, bx + 0.2, 0.86, 0.04)) c = hex(col);
    if (inRR(u, v, 0.08, 0.9, 0.92, 0.94, 0.02)) c = hex('#7d8592');
    return c;
  };
}
function render(size, maskable) {
  const f = scene(maskable), SS = 4, out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = f((x + (i + 0.5) / SS) / size, (y + (j + 0.5) / SS) / size);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const k = (y * size + x) * 4;
    if (a) { out[k] = r / a; out[k + 1] = g / a; out[k + 2] = b / a; out[k + 3] = 255 * a / (SS * SS); }
  }
  return png(size, out);
}
writeFileSync('icons/icon-192.png', render(192, false));
writeFileSync('icons/icon-512.png', render(512, false));
writeFileSync('icons/maskable-512.png', render(512, true));
console.log('iconos generados');
