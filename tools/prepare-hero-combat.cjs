// Asset preparation only: measure transparent silhouettes; preserve generated pixels.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    const layout = {};
    for (const pose of ['flinch', 'down']) {
      const file = `public/assets/deprecated/pixel/characters/battle/hero-${pose}-atlas-v1.png`;
      layout[pose] = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
        const visited = new Uint8Array(image.width * image.height), queue = new Int32Array(visited.length), components = [];
        for (let start = 0; start < visited.length; start++) if (!visited[start] && rgba[start * 4 + 3] > 16) {
          let read = 0, count = 1, left = image.width, right = 0, top = image.height, bottom = 0;
          visited[start] = 1; queue[0] = start;
          while (read < count) {
            const p = queue[read++], x = p % image.width, y = Math.floor(p / image.width);
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!(dx || dy) || x + dx < 0 || x + dx >= image.width || y + dy < 0 || y + dy >= image.height) continue;
              const next = p + dy * image.width + dx;
              if (!visited[next] && rgba[next * 4 + 3] > 16) {visited[next] = 1; queue[count++] = next;}
            }
          }
          if (count > 1000) components.push([left, top, right - left + 1, bottom - top + 1]);
        }
        if (components.length !== 9) throw new Error(`Expected nine silhouettes, found ${components.length}`);
        components.sort((a, b) => (a[1] + a[3] / 2) - (b[1] + b[3] / 2));
        const rects = [0, 1, 2].flatMap(row => components.slice(row * 3, row * 3 + 3).sort((a, b) => a[0] - b[0]));
        return {width: image.width, height: image.height, rects};
      }, 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'));
    }
    fs.writeFileSync('src/proto/art/heroCombatLayout.json', JSON.stringify(layout, null, 2) + '\n');
    fs.writeFileSync('public/assets/deprecated/pixel/characters/battle/hero-combat-layout.json', JSON.stringify(layout, null, 2) + '\n');
    console.log(JSON.stringify(layout));
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exit(1);});
