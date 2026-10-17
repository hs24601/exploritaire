// Deterministic atlas packing only: keep generated watercolor RGBA pixels intact.
const fs = require('node:fs');
const { chromium } = require('playwright');
const names = ['happy', 'blush', 'heartEyes', 'sad', 'stars', 'upset', 'upsetWithSymbol', 'behind'];
const directory = 'public/assets/actors/hero/emojis-watercolor-v1';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ data, names }) => {
      const image = new Image(); image.src = data; await image.decode();
      const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
      const ctx = source.getContext('2d'); ctx.drawImage(image, 0, 0);
      const sheet = document.createElement('canvas'); sheet.width = 2048; sheet.height = 1024;
      const dest = sheet.getContext('2d'); dest.imageSmoothingQuality = 'high';
      const frames = {}, individual = {};
      for (const [i, name] of names.entries()) {
        const col = i % 4, row = Math.floor(i / 4);
        const sx = Math.round(col * image.width / 4), sy = Math.round(row * image.height / 2);
        const baseW = Math.round((col + 1) * image.width / 4) - sx;
        // The generated speech puff slightly crosses the nominal column edge.
        const cellW = baseW + (name === 'upsetWithSymbol' ? 24 : 0);
        const cellH = Math.round((row + 1) * image.height / 2) - sy;
        const pixels = ctx.getImageData(sx, sy, cellW, cellH), rgba = pixels.data;
        if (name === 'upsetWithSymbol') for (let y = 125; y < cellH; y++) for (let x = baseW; x < cellW; x++) rgba[(y * cellW + x) * 4 + 3] = 0;
        if (name === 'behind') for (let y = 0; y < 170; y++) for (let x = 0; x < 24; x++) rgba[(y * cellW + x) * 4 + 3] = 0;
        if (row === 1) for (let y = 0; y < 9; y++) for (let x = 150; x < cellW - 100; x++) rgba[(y * cellW + x) * 4 + 3] = 0;
        // Remove tiny disconnected source-sheet flecks, including bleed from the neighboring row.
        const seen = new Uint8Array(cellW * cellH);
        for (let start = 0; start < seen.length; start++) {
          if (seen[start] || !rgba[start * 4 + 3]) continue;
          const queue = [start]; seen[start] = 1;
          for (let q = 0; q < queue.length; q++) {
            const p = queue[q], x = p % cellW, y = Math.floor(p / cellW);
            for (const n of [x ? p - 1 : -1, x + 1 < cellW ? p + 1 : -1, y ? p - cellW : -1, y + 1 < cellH ? p + cellW : -1]) {
              if (n >= 0 && !seen[n] && rgba[n * 4 + 3]) { seen[n] = 1; queue.push(n); }
            }
          }
          if (queue.length < (name === 'behind' ? 1500 : 120)) for (const p of queue) rgba[p * 4 + 3] = 0;
        }
        const isolated = document.createElement('canvas'); isolated.width = cellW; isolated.height = cellH;
        isolated.getContext('2d').putImageData(pixels, 0, 0);
        let left = cellW, top = cellH, right = -1, bottom = -1, transparent = 0, partial = 0;
        for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) {
          const alpha = rgba[(y * cellW + x) * 4 + 3];
          if (!alpha) transparent++; else if (alpha < 255) partial++;
          if (alpha > 8) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
        }
        if (!transparent || !partial || right < left) throw Error(`${name}: missing artwork or watercolor transparency`);
        left = Math.max(0, left - 4); top = Math.max(0, top - 4);
        const w = Math.min(cellW, right + 5) - left, h = Math.min(cellH, bottom + 5) - top;
        const scale = Math.min(448 / w, 448 / h), width = Math.round(w * scale), height = Math.round(h * scale);
        const tile = document.createElement('canvas'); tile.width = tile.height = 512;
        const tc = tile.getContext('2d'); tc.imageSmoothingQuality = 'high';
        tc.drawImage(isolated, left, top, w, h, Math.floor((512 - width) / 2), Math.floor((512 - height) / 2), width, height);
        const x = i % 4 * 512, y = Math.floor(i / 4) * 512;
        dest.drawImage(tile, x, y);
        frames[name] = { frame: { x, y, w: 512, h: 512 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 512, h: 512 }, sourceSize: { w: 512, h: 512 }, pivot: { x: .5, y: .5 } };
        individual[name] = tile.toDataURL('image/png').split(',')[1];
      }
      return { png: sheet.toDataURL('image/png').split(',')[1], frames, individual, sourceSize: [image.width, image.height] };
    }, { data: 'data:image/png;base64,' + fs.readFileSync(process.argv[2]).toString('base64'), names });
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(`${directory}/hero-emojis-v1.png`, Buffer.from(result.png, 'base64'));
    for (const name of names) fs.writeFileSync(`${directory}/hero_emoji_${name}.png`, Buffer.from(result.individual[name], 'base64'));
    const atlas = { frames: result.frames, meta: { image: 'hero-emojis-v1.png', format: 'RGBA8888', size: { w: 2048, h: 1024 }, scale: '1' } };
    fs.writeFileSync(`${directory}/hero-emojis-v1.json`, JSON.stringify(atlas, null, 2) + '\n');
    console.log(JSON.stringify({ sourceSize: result.sourceSize, atlasSize: atlas.meta.size, frames: names, alphaValidated: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
