// Extract the two authored atlas cells; retain alpha and nearest-neighbor pixels.
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const [source, outputs] of [
      ['public/assets/actors/sources/hero-sleeping-atlas-v1.png', ['public/assets/actors/hero-sleeping.png', 'public/assets/actors/hero-sleeping-topdown.png']],
      ['public/assets/biomes/sources/hero-den-atlas-v2.png', ['public/assets/biomes/hero-den-topdown-v2.png', 'public/assets/biomes/hero-den-standee-v2.png']],
    ]) {
      const cells = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
        return [0, 1].map(cell => {
          let left = image.width, top = image.height, right = 0, bottom = 0;
          for (let y = 0; y < image.height; y++) for (let x = cell * image.width / 2; x < (cell + 1) * image.width / 2; x++) {
            if (pixels[(y * image.width + x) * 4 + 3] > 16) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
          }
          const width = right - left + 1, height = bottom - top + 1;
          const output = document.createElement('canvas'); output.width = 128; output.height = Math.round(128 * height / width);
          const out = output.getContext('2d'); out.imageSmoothingEnabled = false;
          out.drawImage(image, left, top, width, height, 0, 0, output.width, output.height);
          return output.toDataURL('image/png').split(',')[1];
        });
      }, 'data:image/png;base64,' + fs.readFileSync(source).toString('base64'));
      outputs.forEach((file, index) => fs.writeFileSync(file, Buffer.from(cells[index], 'base64')));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
