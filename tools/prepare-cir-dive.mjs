// Pack authored frames with transparent gutters; never repaint their pixels.
import fs from 'node:fs';
import { chromium } from 'playwright';
const source = 'public/assets/sources/keru/cir/dive/v1/cir-dive-master-v1.png';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width=2048; canvas.height=1024;
    const ctx=canvas.getContext('2d');
    // Generated rows are approximate. Segment complete silhouettes rather than
    // slicing equal cells, which can clip a beak or borrow the next bird's tail.
    const scan=document.createElement('canvas');scan.width=img.width;scan.height=img.height;
    const ink=scan.getContext('2d');ink.drawImage(img,0,0);
    const pixels=ink.getImageData(0,0,img.width,img.height).data,w=img.width,h=img.height;
    const labels=new Int32Array(w*h),queue=new Int32Array(w*h),parts=[];let id=0;
    for(let p=0;p<w*h;p++){
      if(labels[p]||pixels[p*4+3]<=24)continue;
      const part={id:++id,x0:w,y0:h,x1:0,y1:0,area:0};let first=0,last=1;queue[0]=p;labels[p]=id;
      while(first<last){const at=queue[first++],x=at%w,y=Math.floor(at/w);part.x0=Math.min(part.x0,x);part.x1=Math.max(part.x1,x);part.y0=Math.min(part.y0,y);part.y1=Math.max(part.y1,y);part.area++;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||labels[n]||pixels[n*4+3]<=24)continue;labels[n]=id;queue[last++]=n;}
      }
      if(part.area>12000)parts.push(part);
    }
    if(parts.length!==8)throw Error(`Expected 8 separate phoenix poses, got ${parts.length}: ${JSON.stringify(parts)}`);
    parts.sort((a,b)=>Math.floor((a.y0+a.y1)/h)-Math.floor((b.y0+b.y1)/h)||(a.x0+a.x1)-(b.x0+b.x1));
    const scale=Math.min(...parts.map(p=>Math.min(420/(p.x1-p.x0+5),420/(p.y1-p.y0+5))));
    const beaks=[[432,365],[884,378],[1324,377],[1760,377],[462,828],[901,824],[1336,816],[1754,815]];
    for(const [i,part] of parts.entries()){
      const x0=Math.max(0,part.x0-2),y0=Math.max(0,part.y0-2),cw=Math.min(w,part.x1+3)-x0,ch=Math.min(h,part.y1+3)-y0;
      const cut=document.createElement('canvas');cut.width=cw;cut.height=ch;const painter=cut.getContext('2d'),rgba=painter.createImageData(cw,ch);
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
        const at=(y+y0)*w+x+x0;let own=labels[at]===part.id;
        if(!own&&pixels[at*4+3]<=24)for(let dy=-2;dy<=2&&!own;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+x0+dx,ny=y+y0+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h&&labels[ny*w+nx]===part.id){own=true;break;}}
        if(own)rgba.data.set(pixels.subarray(at*4,at*4+4),(y*cw+x)*4);
      }
      painter.putImageData(rgba,0,0);
      // Register every leading beak to one stable point; wings and train move.
      ctx.drawImage(cut,(i%4)*512+444-(beaks[i][0]-x0)*scale,Math.floor(i/4)*512+410-(beaks[i][1]-y0)*scale,cw*scale,ch*scale);
    }
    const rgba=ctx.getImageData(0,0,2048,1024).data;
    let transparent=0,opaqueCream=0;
    for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]===0)transparent++;if(rgba[i]>235&&rgba[i+1]>220&&rgba[i+2]>165&&rgba[i+3]>240)opaqueCream++;}
    if(transparent<2048*1024*.25||opaqueCream<1000)throw Error(`Expected real alpha and opaque cream paint: transparent=${transparent}, cream=${opaqueCream}`);
    return {png:canvas.toDataURL('image/png').split(',')[1],source:[img.width,img.height],transparent,opaqueCream,parts,scale,beaks};
  },'data:image/png;base64,'+fs.readFileSync(source).toString('base64'));
  fs.writeFileSync('public/assets/runtime/keru/cir/dive/v1/cir-dive-atlas-v1.png',Buffer.from(result.png,'base64'));
  delete result.png;
  fs.writeFileSync('public/assets/sources/keru/cir/dive/v1/packing.json',JSON.stringify({...result,columns:4,rows:2,cell:512,gutter:40},null,2)+'\n');
  console.log(result);
} finally {await browser.close();}
