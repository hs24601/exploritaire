// Offline atlas registration only; preserve the generated RGBA artwork and Pixel originals.
const fs = require('node:fs');
const { chromium } = require('playwright');
const layout = require('../src/proto/art/mochiLayout.json');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const checks = {};
    for (const [index,tier] of ['low','high'].entries()) {
      const source = process.argv[index+2];
      const result = await page.evaluate(async ({data,spec,tier}) => {
        const image = new Image(); image.src=data; await image.decode();
        const input=document.createElement('canvas'); input.width=image.width; input.height=image.height;
        const ctx=input.getContext('2d'); ctx.drawImage(image,0,0);
        const pixels=ctx.getImageData(0,0,input.width,input.height).data;
        const seen=new Uint8Array(input.width*input.height),queue=new Int32Array(seen.length),components=[],labels=new Int32Array(seen.length);let componentId=0;
        for(let start=0;start<seen.length;start++) if(!seen[start]&&pixels[start*4+3]>32) {
          let read=0,count=1,left=input.width,right=0,top=input.height,bottom=0;queue[0]=start;seen[start]=1;
          while(read<count) {
            const p=queue[read++],x=p%input.width,y=Math.floor(p/input.width);
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            for(const n of [x?p-1:-1,x+1<input.width?p+1:-1,y?p-input.width:-1,y+1<input.height?p+input.width:-1])
              if(n>=0&&!seen[n]&&pixels[n*4+3]>32){seen[n]=1;queue[count++]=n;}
          }
          componentId++; for(let k=0;k<count;k++)labels[queue[k]]=componentId;
          if(count>1000) components.push({left,right,top,bottom,count,id:componentId});
        }
        const columns=tier==='low'?4:3,expected=tier==='low'?8:9;
        if(components.length!==expected)throw Error(`${tier}: expected ${expected} bodies, got ${components.length}`);
        components.sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
        const sorted=[];for(let row=0;row<expected/columns;row++)sorted.push(...components.slice(row*columns,(row+1)*columns).sort((a,b)=>a.left-b.left));
        const output=document.createElement('canvas');output.width=spec.width;output.height=spec.height;
        const dest=output.getContext('2d');dest.imageSmoothingQuality='high';
        const frames=sorted.map((b,i)=>{
          const sx=Math.max(0,b.left-3),sy=Math.max(0,b.top-3),sw=Math.min(input.width,b.right+4)-sx,sh=Math.min(input.height,b.bottom+4)-sy;
          const [x,y,w,h]=spec.rects[i],scale=Math.min((w-6)/sw,(h-6)/sh),dw=Math.round(sw*scale),dh=Math.round(sh*scale);
          const isolated=document.createElement('canvas');isolated.width=sw;isolated.height=sh;const ic=isolated.getContext('2d'),ip=ic.createImageData(sw,sh);
          for(let yy=0;yy<sh;yy++)for(let xx=0;xx<sw;xx++){const source=(sy+yy)*input.width+sx+xx;if(labels[source]===b.id){for(let channel=0;channel<4;channel++)ip.data[(yy*sw+xx)*4+channel]=pixels[source*4+channel];}}
          ic.putImageData(ip,0,0);
          dest.drawImage(isolated,0,0,sw,sh,x+Math.floor((w-dw)/2),y+h-3-dh,dw,dh);
          return {index:i,source:[sx,sy,sw,sh],target:spec.rects[i],size:[dw,dh]};
        });
        const rgba=dest.getImageData(0,0,output.width,output.height).data;
        let transparent=0,partial=0;for(let i=3;i<rgba.length;i+=4){if(rgba[i]===0)transparent++;else if(rgba[i]<255)partial++;}
        if(!transparent||!partial)throw Error('Missing transparent background or watercolor alpha');
        return {png:output.toDataURL('image/png').split(',')[1],frames,transparent,partial};
      },{data:'data:image/png;base64,'+fs.readFileSync(source).toString('base64'),spec:layout[tier],tier});
      const out=`public/assets/runtime/characters/mochi/rig/watercolor/v1/mochi-directions-${tier}-watercolor-v1.png`;
      fs.mkdirSync('public/assets/runtime/characters/mochi/rig/watercolor/v1',{recursive:true});
      fs.writeFileSync(out,Buffer.from(result.png,'base64'));
      delete result.png;checks[tier]={output:out,...result};
    }
    fs.mkdirSync('docs/art',{recursive:true});fs.writeFileSync('docs/art/mochi-watercolor-v1-packing.json',JSON.stringify(checks,null,2)+'\n');
    console.log('Packed 17 complete watercolor views into existing Mochi rig rectangles.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
