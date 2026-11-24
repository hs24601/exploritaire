// Minimal RGBA8 PNG decode/encode and compositing helpers for the Node-only
// painter render tools (no browser, no dependencies).
import fs from 'node:fs';
import zlib from 'node:zlib';

export function decode(file) {
  const b = fs.readFileSync(file); let o = 8, w, h; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12]) throw new Error('RGBA8 only'); }
    if (type === 'IDAT') idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = new Uint8ClampedArray(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) { const a = x >= 4 ? out[y * stride + x - 4] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = y && x >= 4 ? out[(y - 1) * stride + x - 4] : 0;
      let v = raw[row + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255; } }
  return { width: w, height: h, data: out };
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function encode(img, file) {
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) Buffer.from(img.data.buffer, img.data.byteOffset + y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
export function canvas(w, h, fill = 24) { const c = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; c.data.fill(fill); for (let i = 3; i < c.data.length; i += 4) c.data[i] = 255; return c; }
/** Night woodland backdrop like the tableau: slate sky over dark earth, with a soft contact shadow. */
export function scene(dst, x0, y0, w, h, ground = .9) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = y / h, i = ((y0 + y) * dst.width + x0 + x) * 4;
    const earth = v > ground, t = earth ? (v - ground) / (1 - ground) : v / ground;
    const c = earth ? [62 - t * 22, 60 - t * 20, 46 - t * 14] : [40 - t * 14, 58 - t * 18, 76 - t * 24];
    const shadow = Math.exp(-(((x / w - .5) / .18) ** 2 + ((v - ground - .015) / .02) ** 2)) * .45;
    dst.data.set([c[0] * (1 - shadow), c[1] * (1 - shadow), c[2] * (1 - shadow), 255], i); }
}
export function bounds(img) { let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 }; }
/** Box-filtered straight-alpha over of a source region into a destination rect. */
export function blit(dst, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx0 = sx + x / dw * sw, fy0 = sy + y / dh * sh, step = Math.max(1, Math.round(sw / dw)); let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < step; j++) for (let k = 0; k < step; k++) { const px = Math.min(src.width - 1, Math.floor(fx0 + k)), py = Math.min(src.height - 1, Math.floor(fy0 + j)), i = (py * src.width + px) * 4, al = src.data[i + 3] / 255;
      r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++; }
    if (!a) continue; const al = a / n, i = ((dy + y) * dst.width + dx + x) * 4;
    if (dx + x < 0 || dx + x >= dst.width || dy + y < 0 || dy + y >= dst.height) continue;
    dst.data[i] = r / a * al + dst.data[i] * (1 - al); dst.data[i + 1] = g / a * al + dst.data[i + 1] * (1 - al); dst.data[i + 2] = b / a * al + dst.data[i + 2] * (1 - al); }
}
/** Stand a cutout on a panel's ground line at a given painted height, centred. */
export function stand(dst, img, x0, y0, w, h, height, ground = .9) {
  const b = bounds(img), bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, s = height / bh, dw = Math.round(bw * s), dh = Math.round(bh * s);
  blit(dst, img, b.x0, b.y0, bw, bh, x0 + Math.round((w - dw) / 2), y0 + Math.round(h * ground) - dh, dw, dh);
}
export function crop(img, x, y, w, h) { const c = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const sx = x + i, sy = y + j; if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue; const s = (sy * img.width + sx) * 4, d = (j * w + i) * 4; for (let k = 0; k < 4; k++) c.data[d + k] = img.data[s + k]; }
  return c; }
