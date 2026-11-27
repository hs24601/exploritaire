// Repack generated standing/reaction cutouts into guttered cells and measure registration.
// The authored paintings stay intact; connected alpha separates overlapping atlas bounds.
import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const combat = process.argv.includes('--combat');
const columns = combat ? 4 : 3, rows = combat ? 3 : 2;
try {
  const page = await browser.newPage();
  const measurements = {};
  for (const [tier, count] of combat ? [['hit',11],['flinch',11]] : [['low', 5], ['high', 6]]) {
    const name = combat ? `dem-${tier}` : `dem-standing-${tier}`;
    const source = `public/assets/sources/kin/dem/sprites/combat/standing-and-reactions/${name}-source-v1.png`;
    const result = await page.evaluate(async ({ url, count, columns, rows }) => {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height), pixels = data.data;
      const width = canvas.width, height = canvas.height, total = width * height;
      const labels = new Int32Array(total), queue = new Int32Array(total), components = [];
      let label = 0, transparent = 0;
      for (let i = 0; i < total; i++) {
        if (pixels[i * 4 + 3] <= 24) { transparent++; continue; }
        if (labels[i]) continue;
        label++;
        let start = 0, end = 1, x0 = width, y0 = height, x1 = 0, y1 = 0;
        queue[0] = i; labels[i] = label;
        while (start < end) {
          const index = queue[start++], x = index % width, y = Math.floor(index / width);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy, next = ny * width + nx;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || labels[next] || pixels[next * 4 + 3] <= 24) continue;
            labels[next] = label; queue[end++] = next;
          }
        }
        if (end > 5000) components.push({ label, x0, y0, x1, y1, area: end });
      }
      if (transparent < total * .2 || components.length !== count) throw Error(`Expected ${count} transparent cutouts, found ${components.length}`);
      components.sort((a,b) => Math.floor((a.y0+a.y1)*rows/(2*height)) - Math.floor((b.y0+b.y1)*rows/(2*height)) || (a.x0+a.x1)-(b.x0+b.x1));
      const output = document.createElement('canvas'); output.width = columns*512; output.height = rows*512;
      const ink = output.getContext('2d'), rects = [];
      for (const [index, part] of components.entries()) {
        const x0 = Math.max(0, part.x0-3), y0 = Math.max(0, part.y0-3);
        const w = Math.min(width, part.x1+4)-x0, h = Math.min(height, part.y1+4)-y0;
        const cutout = document.createElement('canvas'); cutout.width = w; cutout.height = h;
        const crop = cutout.getContext('2d'), rgba = crop.createImageData(w,h);
        for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
          const original = (y+y0)*width+x+x0, own = labels[original];
          // Preserve the original antialiased edge, but never include another bear.
          if (own && own !== part.label && components.some(other => other.label === own)) continue;
          if (own !== part.label) {
            let touches = false;
            for(let dy=-2;dy<=2&&!touches;dy++) for(let dx=-2;dx<=2;dx++) {
              const nx=x+x0+dx,ny=y+y0+dy;
              if(nx>=0&&nx<width&&ny>=0&&ny<height&&labels[ny*width+nx]===part.label){touches=true;break;}
            }
            if(!touches)continue;
          }
          rgba.data.set(pixels.subarray(original*4,original*4+4),(y*w+x)*4);
        }
        crop.putImageData(rgba,0,0);
        const scale = Math.min(464/w,464/h), dw=Math.round(w*scale),dh=Math.round(h*scale);
        const dx=index%columns*512+Math.floor((512-dw)/2),dy=Math.floor(index/columns)*512+488-dh;
        ink.drawImage(cutout,dx,dy,dw,dh);rects.push([dx,dy,dw,dh]);
      }
      return { png:output.toDataURL(), size:[output.width,output.height], rects, sourceBounds:components.map(p=>[p.x0,p.y0,p.x1-p.x0+1,p.y1-p.y0+1]), transparent };
    }, { url: 'data:image/png;base64,' + fs.readFileSync(source).toString('base64'), count, columns, rows });
    const { png, ...layout } = result;
    fs.writeFileSync(`public/assets/runtime/kin/dem/sprites/combat/standing-and-reactions/${name}-v1.png`, Buffer.from(png.split(',')[1], 'base64'));
    measurements[tier] = layout;
    console.log(tier, layout);
  }
  fs.writeFileSync(`src/proto/art/dem${combat?'Combat':'Standing'}Layout.json`, JSON.stringify(measurements,null,2)+'\n');
} finally { await browser.close(); }
