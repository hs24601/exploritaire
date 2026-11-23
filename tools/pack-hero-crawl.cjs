// Mechanical packing of original ImageGen alpha; no repainting or color keys.
const fs=require('node:fs'),crypto=require('node:crypto'),{chromium}=require('playwright');
const source='public/assets/sources/characters/hero/world-traversal/v1',runtime='public/assets/runtime/characters/hero/world-traversal/v1';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),bytes=fs.readFileSync(source+'/crawl-source.png');
  const packed=await page.evaluate(async base64=>{
   const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
   const input=document.createElement('canvas');input.width=image.width;input.height=image.height;
   const ctx=input.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,input.width,input.height).data;
   if(pixels[3]!==0)throw Error('Generated master must have original transparent alpha');
   const atlas=document.createElement('canvas');atlas.width=1536;atlas.height=1152;
   const out=atlas.getContext('2d'),registration=[];
   for(let group=0;group<11;group++){
    const frames=[];let left=Infinity,top=Infinity,right=0,bottom=0;
    for(let frame=0;frame<4;frame++){
     const index=group*4+frame,x=Math.round(index%8*image.width/8),y=Math.round(Math.floor(index/8)*image.height/6);
     const width=Math.round((index%8+1)*image.width/8)-x,height=Math.round((Math.floor(index/8)+1)*image.height/6)-y;
     let l=width,t=height,r=0,b=0,count=0;
     for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++)if(pixels[((y+yy)*input.width+x+xx)*4+3]>32){l=Math.min(l,xx);t=Math.min(t,yy);r=Math.max(r,xx);b=Math.max(b,yy);count++;}
     if(count<500)throw Error('Missing crawl pose '+index);
     frames.push({x,y,width,height,bounds:[l,t,r-l+1,b-t+1]});left=Math.min(left,l);top=Math.min(top,t);right=Math.max(right,r);bottom=Math.max(bottom,b);
    }
    const scale=Math.min(176/(right-left+1),176/(bottom-top+1)),tx=96-(left+right+1)*scale/2,ty=188-(bottom+1)*scale;
    frames.forEach((f,frame)=>{const i=group*4+frame,dx=i%8*192,dy=Math.floor(i/8)*192;out.save();out.beginPath();out.rect(dx,dy,192,192);out.clip();out.drawImage(image,f.x,f.y,f.width,f.height,dx+tx,dy+ty,f.width*scale,f.height*scale);out.restore();});
    registration.push({view:group===10?'top-0':`${group<5?'low':'high'}-${group%5}`,scale,translate:[tx,ty],sourceBounds:frames,widthFraction:(right-left+1)*scale/192,heightFraction:(bottom-top+1)*scale/192});
   }
   return {png:atlas.toDataURL('image/png').split(',')[1],registration,dimensions:[image.width,image.height]};
  },bytes.toString('base64'));
  fs.mkdirSync(runtime,{recursive:true});fs.writeFileSync(runtime+'/crawl.png',Buffer.from(packed.png,'base64'));
  const metadata=fs.existsSync(source+'/manifest.json')?source+'/manifest.json':'artifacts/hero-crawl-generation.json';
  const manifest=JSON.parse(fs.readFileSync(metadata,'utf8').replace(/^\uFEFF/,''));
  manifest.sourceSha256=crypto.createHash('sha256').update(bytes).digest('hex');manifest.sourceDimensions=packed.dimensions;
  manifest.runtimeSha256=crypto.createHash('sha256').update(fs.readFileSync(runtime+'/crawl.png')).digest('hex');
  manifest.references.forEach(r=>r.sha256=crypto.createHash('sha256').update(fs.readFileSync(r.path)).digest('hex'));
  manifest.packing='Original alpha, fixed 8x6 source grid; one uniform transform per view across four frames, ground baseline 188/192. No vertical squash. Physical width matches existing authored crouch in the same view.';
  manifest.registration=packed.registration;fs.writeFileSync(source+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  const base=JSON.parse(fs.readFileSync('public/assets/sources/characters/hero/castle/platform-v1/manifest.json','utf8'));
  const scales={};for(const r of packed.registration){const size=base.views[r.view].packing[0].size;const axis=r.view==='top-0'?1:0;scales[r.view]=Number((size[axis]/256*base.planeSizeMeters/(axis?r.heightFraction:r.widthFraction)).toFixed(6));}
  fs.writeFileSync('src/book/heroCrawlScale.json',JSON.stringify(scales,null,2)+'\n');console.log('Packed 44 low-crawl poses, original alpha, uniform per-view scale.',scales);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
