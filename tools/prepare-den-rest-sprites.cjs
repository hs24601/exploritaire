// Trim atlas cells and resize with nearest-neighbor sampling, preserving generated alpha.
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const name of ['mochi', 'hero-mochi']) {
      const source = `public/assets/deprecated/pixel/sources/characters/${name}-sleeping-atlas-v1.png`;
      if (!fs.existsSync(source)) continue;
      const cells = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
        // ImageGen may space the views unevenly. Find the clear gutter rather
        // than slicing a silhouette at the exact canvas midpoint.
        let split = Math.floor(image.width / 2), longest = 0, start = -1;
        for (let x = Math.floor(image.width * .4); x < image.width * .65; x++) {
          let opaque = false;
          for (let y = 0; y < image.height; y++) if (pixels[(y * image.width + x) * 4 + 3] > 16) { opaque = true; break; }
          if (!opaque && start < 0) start = x;
          if (opaque && start >= 0) { if (x - start > longest) { longest = x - start; split = Math.floor((start + x) / 2); } start = -1; }
        }
        if (!longest) throw new Error('No clear atlas gutter');
        return [0, 1].map(cell => {
          let left = image.width, top = image.height, right = -1, bottom = -1;
          for (let y = 0; y < image.height; y++) for (let x = cell ? split : 0; x < (cell ? image.width : split); x++) {
            if (pixels[(y * image.width + x) * 4 + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
          }
          if (right < left) throw new Error('Empty sprite cell');
          const out = document.createElement('canvas'); out.width = 128; out.height = Math.round(128 * (bottom - top + 1) / (right - left + 1));
          const draw = out.getContext('2d'); draw.imageSmoothingEnabled = false;
          draw.drawImage(image, left, top, right-left+1, bottom-top+1, 0, 0, out.width, out.height);
          return out.toDataURL('image/png').split(',')[1];
        });
      }, 'data:image/png;base64,' + fs.readFileSync(source).toString('base64'));
      cells.forEach((cell, i) => fs.writeFileSync(`public/assets/deprecated/pixel/characters/${name}-sleeping${i ? '-topdown' : ''}.png`, Buffer.from(cell, 'base64')));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
