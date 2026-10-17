// Deterministic packing of generated faces only. Original body/ears stay untouched.
const fs = require('node:fs');
const { chromium } = require('playwright');
const layout = require('../src/proto/art/heroSittingLayout.json');
const path = 'public/assets/actors/hero/faces-watercolor-v1';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const tier of ['low', 'high']) {
      const original = fs.readFileSync(`public/assets/actors/battle/bobtail-v3/hero-sitting-${tier}-body-v3.png`).toString('base64');
      const generated = fs.readFileSync(`output/imagegen/hero-faces-v1/hero-sitting-sad-${tier}-source.png`).toString('base64');
      const packed = await page.evaluate(async ({ original, generated, layout }) => {
        const load = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode(); return img; };
        const source = await load(generated), base = await load(original);
        const canvas = document.createElement('canvas'); canvas.width = layout.width; canvas.height = layout.height;
        const ctx = canvas.getContext('2d');
        const bounds = (img, cell) => {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0); const data = g.getImageData(0, 0, c.width, c.height).data;
          const [x, y, w, h] = cell; let l = x+w, t=y+h, r=x, b=y;
          for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++) if(data[(py*c.width+px)*4+3]>24){l=Math.min(l,px);t=Math.min(t,py);r=Math.max(r,px);b=Math.max(b,py);}
          return [l,t,r-l+1,b-t+1];
        };
        // Bounds are local to each pose; never stretch a front face onto a profile.
        const masks = [[.06,.19,.68,.39],[0,.20,.62,.41],[0,.19,.51,.40],[0,.16,.32,.35],null,[.68,.16,.32,.35],[.49,.19,.51,.40],[.38,.20,.62,.41],null];
        for(let i=0;i<9;i++) {
          if(!masks[i]) continue; // Back/true overhead have no readable expression.
          const [x,y,w,h] = layout.rects[i], col=i%3,row=Math.floor(i/3);
          const sx=Math.round(col*source.width/3),sy=Math.round(row*source.height/3);
          const src=bounds(source,[sx,sy,Math.round((col+1)*source.width/3)-sx,Math.round((row+1)*source.height/3)-sy]);
          const dst=bounds(base,[x,y,w,h]);
          const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
          const g=layer.getContext('2d');g.drawImage(source,...src,...dst);
          const [mx,my,mw,mh]=masks[i],left=x+mx*w,top=y+my*h,width=mw*w,height=mh*h;
          // A soft rectangular wash keeps the old eyes/mouth covered and blends
          // into the original cheek pigment, without replacing crown or ears.
          const pixels=g.getImageData(0,0,layer.width,layer.height);
          for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
            const d=Math.min(px-left,left+width-px,py-top,top+height-py);
            const a=Math.max(0,Math.min(1,d/5));pixels.data[(py*layer.width+px)*4+3]*=a;
          }
          g.putImageData(pixels,0,0);ctx.drawImage(layer,0,0);
        }
        return canvas.toDataURL('image/png').split(',')[1];
      }, { original, generated, layout: layout[tier] });
      fs.writeFileSync(`${path}/hero-sitting-sad-${tier}-face-v1.png`, Buffer.from(packed, 'base64'));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
