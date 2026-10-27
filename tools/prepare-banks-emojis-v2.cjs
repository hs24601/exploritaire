// Measure complete heads and detached symbols before deterministic atlas packing.
const fs=require('node:fs'),{chromium}=require('playwright');
const names=['happy','blush','heartEyes','sad','stars','upset','upsetWithSymbol','behind','fighting'];
const version=process.argv[3]||'v2';
if(!/^v\d+$/.test(version))throw Error('Expected version such as v3');
const directory=`public/assets/runtime/characters/banks/expressions/emojis/watercolor/${version}`;
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});try{
 const page=await browser.newPage();
 const result=await page.evaluate(async({data,names})=>{
  const image=new Image();image.src=data;await image.decode();
  const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
  const ctx=source.getContext('2d');ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,image.width,image.height).data,n=image.width*image.height;
  const seen=new Uint8Array(n),labels=new Int32Array(n),queue=new Int32Array(n),components=[];let id=0;
  for(let start=0;start<n;start++)if(!seen[start]&&rgba[start*4+3]>128){
   let read=0,count=1,l=image.width,r=0,t=image.height,b=0;queue[0]=start;seen[start]=1;id++;
   while(read<count){const p=queue[read++],x=p%image.width,y=Math.floor(p/image.width);labels[p]=id;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    for(const d of [-1,1,-image.width,image.width]){const next=p+d;if(next<0||next>=n||d===-1&&!x||d===1&&x===image.width-1)continue;if(!seen[next]&&rgba[next*4+3]>128){seen[next]=1;queue[count++]=next;}}}
   components.push({id,count,l,r,t,b});
  }
  const heads=components.filter(c=>c.count>5000).sort((a,b)=>b.count-a.count).slice(0,9);
  if(heads.length!==9)throw Error('Expected nine complete heads');
  heads.sort((a,b)=>(a.t+a.b)-(b.t+b.b));
  const ordered=[];for(let row=0;row<3;row++)ordered.push(...heads.slice(row*3,row*3+3).sort((a,b)=>a.l-b.l));
  const groups=ordered.map(head=>({head,ids:new Set([head.id]),l:head.l,r:head.r,t:head.t,b:head.b}));
  for(const c of components){
   if(c.count<120||heads.some(head=>head.id===c.id))continue;
   const x=(c.l+c.r)/2,y=(c.t+c.b)/2;
   const distances=groups.map(({head:h})=>Math.hypot(Math.max(h.l-x,0,x-h.r),Math.max(h.t-y,0,y-h.b)));
   const nearest=distances.indexOf(Math.min(...distances));if(distances[nearest]>80)continue;
   const g=groups[nearest];g.ids.add(c.id);g.l=Math.min(g.l,c.l);g.r=Math.max(g.r,c.r);g.t=Math.min(g.t,c.t);g.b=Math.max(g.b,c.b);
  }
  const sheet=document.createElement('canvas');sheet.width=sheet.height=1536;
  const dest=sheet.getContext('2d');dest.imageSmoothingQuality='high';const frames={},individual={},measurements={};
  groups.forEach((g,i)=>{
   const sx=Math.max(0,g.l-4),sy=Math.max(0,g.t-4),w=Math.min(image.width,g.r+5)-sx,h=Math.min(image.height,g.b+5)-sy;
   const isolated=document.createElement('canvas');isolated.width=w;isolated.height=h;const ic=isolated.getContext('2d'),pixels=ic.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(sy+y)*image.width+sx+x;let keep=g.ids.has(labels[p]);
    if(!keep&&rgba[p*4+3])for(let dy=-3;dy<=3&&!keep;dy++)for(let dx=-3;dx<=3;dx++){const xx=sx+x+dx,yy=sy+y+dy;if(xx>=0&&xx<image.width&&yy>=0&&yy<image.height&&g.ids.has(labels[yy*image.width+xx])){keep=true;break;}}
    if(keep)for(let k=0;k<4;k++)pixels.data[(y*w+x)*4+k]=rgba[p*4+k];}
   ic.putImageData(pixels,0,0);
   const scale=Math.min(448/w,448/h),dw=w*scale,dh=h*scale,tile=document.createElement('canvas');tile.width=tile.height=512;
   const tc=tile.getContext('2d');tc.imageSmoothingQuality='high';tc.drawImage(isolated,(512-dw)/2,(512-dh)/2,dw,dh);
   const alpha=tc.getImageData(0,0,512,512).data;let transparent=0,partial=0,opaque=0;
   for(let p=3;p<alpha.length;p+=4){if(!alpha[p])transparent++;else if(alpha[p]<250)partial++;else opaque++;}
   if(!transparent||!partial||!opaque)throw Error('Invalid expression alpha '+names[i]);
   const name=names[i],x=i%3*512,y=Math.floor(i/3)*512;dest.drawImage(tile,x,y);
   frames[name]={frame:{x,y,w:512,h:512},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:512,h:512},sourceSize:{w:512,h:512},pivot:{x:.5,y:.5}};
   individual[name]=tile.toDataURL('image/png').split(',')[1];measurements[name]={source:[sx,sy,w,h],scale,components:[...g.ids],transparent,partial,opaque};
  });
  return {png:sheet.toDataURL('image/png').split(',')[1],individual,frames,measurements,source:[image.width,image.height]};
 },{data:'data:image/png;base64,'+fs.readFileSync(process.argv[2]).toString('base64'),names});
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(`${directory}/banks-emojis-${version}.png`,Buffer.from(result.png,'base64'));
 for(const name of names)fs.writeFileSync(`${directory}/banks_emoji_${name}.png`,Buffer.from(result.individual[name],'base64'));
 fs.writeFileSync(`${directory}/banks-emojis-${version}.json`,JSON.stringify({frames:result.frames,meta:{image:`banks-emojis-${version}.png`,format:'RGBA8888',size:{w:1536,h:1536},scale:'1'}},null,2)+'\n');
 fs.writeFileSync(`docs/art/banks-emojis-watercolor-${version}-packing.json`,JSON.stringify({source:result.source,frames:result.measurements},null,2)+'\n');
 console.log('Packed nine complete mature Banks expressions with alpha, detached symbols and 32px margins.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
