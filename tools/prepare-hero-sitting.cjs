// Measure each approved cell and extract the side reference used for fallback/shadows.
// No generated anatomy or pixel edits: source PNGs retain their original alpha.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const measurements = {};
    for (const tier of ['low', 'high']) {
      const file = `public/assets/deprecated/pixel/sources/characters/hero-sitting-${tier}-source-v1.png`;
      const result = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
        // Generated cells are approximate. Measure connected silhouettes rather
        // than slicing equal thirds and accidentally capturing another dog's nose.
        const visited = new Uint8Array(image.width * image.height), queue = new Int32Array(visited.length), components = [];
        for (let start = 0; start < visited.length; start++) if (!visited[start] && rgba[start*4+3] > 16) {
          let read=0, count=1, left=image.width, right=0, top=image.height, bottom=0;
          queue[0]=start; visited[start]=1;
          while (read<count) {
            const p=queue[read++], x=p%image.width, y=Math.floor(p/image.width);
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
              if (!(dx||dy) || x+dx<0 || x+dx>=image.width || y+dy<0 || y+dy>=image.height) continue;
              const next=p+dy*image.width+dx;
              if (!visited[next] && rgba[next*4+3]>16) { visited[next]=1;queue[count++]=next; }
            }
          }
          if (count>1000) components.push({rect:[left,top,right-left+1,bottom-top+1],count});
        }
        if (components.length!==9) throw new Error(`Expected 9 coherent silhouettes, found ${components.length}`);
        components.sort((a,b)=>a.rect[1]-b.rect[1]);
        const sourceRects=[0,1,2].flatMap(row=>components.slice(row*3,row*3+3).sort((a,b)=>a.rect[0]-b.rect[0]).map(c=>c.rect));
        const pad=40, cellW=Math.max(...sourceRects.map(r=>r[2]))+pad*2, cellH=Math.max(...sourceRects.map(r=>r[3]))+pad*2;
        const packed=document.createElement('canvas');packed.width=cellW*3;packed.height=cellH*3;
        const out=packed.getContext('2d');out.imageSmoothingEnabled=false;
        const rects=sourceRects.map(([x,y,w,h],i)=>{
          const left=i%3*cellW+Math.round((cellW-w)/2),top=Math.floor(i/3)*cellH+cellH-pad-h;
          out.drawImage(image,x,y,w,h,left,top,w,h);
          // One transparent texel protects the outline from crop-edge sampling.
          return [left-1,top-1,w+2,h+2];
        });
        const [x, y, w, h] = rects[2];
        const side = document.createElement('canvas'); side.width = w; side.height = h;
        side.getContext('2d').drawImage(packed, x, y, w, h, 0, 0, w, h);
        const [tx,ty,tw,th]=rects[8], top=document.createElement('canvas');top.width=tw;top.height=th;
        top.getContext('2d').drawImage(packed,tx,ty,tw,th,0,0,tw,th);
        return { width: packed.width, height: packed.height, rects, sourceRects, atlas:packed.toDataURL('image/png').split(',')[1], top:top.toDataURL('image/png').split(',')[1], side: side.toDataURL('image/png').split(',')[1] };
      }, 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'));
      if (tier === 'low') fs.writeFileSync('public/assets/deprecated/pixel/characters/hero-sitting.png', Buffer.from(result.side, 'base64'));
      if (tier === 'high') fs.writeFileSync('public/assets/deprecated/pixel/characters/hero-sitting-topdown.png', Buffer.from(result.top, 'base64'));
      fs.writeFileSync(`public/assets/deprecated/pixel/characters/battle/hero-sitting-${tier}-v1.png`, Buffer.from(result.atlas, 'base64'));
      delete result.side; delete result.atlas; delete result.top; measurements[tier] = result;
    }
    const standingTop = await page.evaluate(async data => {
      const image=new Image();image.src=data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=174;canvas.height=398;
      canvas.getContext('2d').drawImage(image,71,1022,174,398,0,0,174,398);
      return canvas.toDataURL('image/png').split(',')[1];
    },'data:image/png;base64,'+fs.readFileSync('public/assets/deprecated/pixel/characters/battle/hero-directions-high-v1.png').toString('base64'));
    fs.writeFileSync('public/assets/deprecated/pixel/characters/hero-standing-topdown.png',Buffer.from(standingTop,'base64'));
    const metadata = JSON.stringify(measurements, null, 2) + '\n';
    fs.writeFileSync('public/assets/deprecated/pixel/characters/battle/hero-sitting-layout.json', metadata);
    // Runtime imports live in source; public holds the portable art sidecar.
    fs.writeFileSync('src/proto/art/heroSittingLayout.json', metadata);
    console.log(JSON.stringify(measurements, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
