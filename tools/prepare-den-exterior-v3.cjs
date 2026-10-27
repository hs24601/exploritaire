const { chromium } = require('playwright');
const fs = require('node:fs');

// ImageGen supplies the painted exterior. Restore the original mouth/floor and
// original alpha so this art pass cannot move the entrance or roof silhouette.
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5178/proto.html');
    const result = await page.evaluate(async () => {
      const load = src => new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
      });
      const [original, painted] = await Promise.all([
        load('/assets/runtime/environment/watercolor/v1/hero-den-overhead-v2.png'),
        load('/assets/sources/environment/watercolor/v1/hero-den-exterior-v3-generated.png'),
      ]);
      const canvas = document.createElement('canvas'); canvas.width = original.width; canvas.height = original.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(original, 0, 0);
      const old = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.drawImage(painted, 0, 0, canvas.width, canvas.height);
      const fresh = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let protectedPixels = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const u = x / canvas.width, v = y / canvas.height;
        // Preserve the whole mouth end plus the original hollow and inner walls.
        const interior = v > .40 && u > .265 && u < .79;
        const distance = Math.hypot(Math.max(.265-u, 0, u-.79), Math.max(.40-v, 0));
        const restore = Math.max(Math.max(0, Math.min(1, (v-.74)/.05)), Math.max(0, 1-distance/.035));
        const weight = fresh.data[i+3] < 128 ? 1 : restore;
        for (let c = 0; c < 3; c++) fresh.data[i+c] = Math.round(old.data[i+c]*weight + fresh.data[i+c]*(1-weight));
        if (v > .79 || interior) protectedPixels++;
        fresh.data[i + 3] = old.data[i + 3];
      }
      ctx.putImageData(fresh, 0, 0);
      const png=canvas.toDataURL('image/png').split(',')[1];
      const [earth,stone]=await Promise.all([load('/assets/runtime/environment/watercolor/v1/woodland-ground-v1.png'),load('/assets/runtime/environment/watercolor/v1/mountain-ground-v1.png')]);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(earth,0,0,canvas.width,canvas.height);
      const floor=ctx.getImageData(0,0,canvas.width,canvas.height);
      ctx.drawImage(stone,0,0,canvas.width,canvas.height);const rock=ctx.getImageData(0,0,canvas.width,canvas.height);
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const u=x/canvas.width,v=y/canvas.height,i=(y*canvas.width+x)*4;
        // The source mouth is at the bottom; its entire edge stays earth.
        const edge=Math.min(u,1-u,v),weight=Math.max(0,Math.min(1,(.10-edge)/.025))*Math.max(0,Math.min(1,(.91-v)/.08));
        for(let c=0;c<3;c++)floor.data[i+c]=Math.round(floor.data[i+c]*(1-weight)+rock.data[i+c]*weight);
      }
      ctx.putImageData(floor,0,0);
      return { png, ground:canvas.toDataURL('image/png').split(',')[1], protectedPixels, width: canvas.width, height: canvas.height };
    });
    fs.writeFileSync('public/assets/runtime/environment/watercolor/v1/hero-den-overhead-v3.png', Buffer.from(result.png, 'base64'));
    fs.writeFileSync('public/assets/runtime/environment/watercolor/v1/hero-den-ground-v2.png',Buffer.from(result.ground,'base64'));
    delete result.png;delete result.ground; console.log(result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
