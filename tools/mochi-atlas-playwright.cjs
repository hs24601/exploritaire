const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto('http://localhost:5178/proto.html');
  const checks=await page.evaluate(async()=>{
   const {MOCHI_DIRECTIONAL_SPRITE:definition}=await import('/src/proto/mochiSprite.ts');
   const {BATTLE_SPRITE_ASSETS}=await import('/src/proto/battleSpriteAssets.ts');
   const results=[];
   for(const tier of ['low','high']){
    const image=new Image();image.src=`/assets/${BATTLE_SPRITE_ASSETS[tier==='low'?'mochiLow':'mochiHigh']}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,image.width,image.height).data,w=image.width,h=image.height;
    const labels=new Int32Array(w*h),sizes=[0],queue=new Int32Array(w*h);let label=0;
    for(let start=0;start<labels.length;start++)if(!labels[start]&&pixels[start*4+3]>=115){
     label++;let read=0,write=1;queue[0]=start;labels[start]=label;
     while(read<write){
      const index=queue[read++],x=index%w,y=Math.floor(index/w);
      for(const next of [x?index-1:-1,x+1<w?index+1:-1,y?index-w:-1,y+1<h?index+w:-1])if(next>=0&&!labels[next]&&pixels[next*4+3]>=115){labels[next]=label;queue[write++]=next;}
     }sizes[label]=write;
    }
    const frames=[...definition[tier],...(definition[tier==='low'?'lowOpposite':'highOpposite']??[]),...(tier==='high'?[definition.top]:[])];
    for(const frame of new Set(frames)){
     const [left,top,width,height]=frame.parts[0].rect,counts=new Map();
     for(let y=top;y<top+height;y++)for(let x=left;x<left+width;x++){
      const id=labels[y*w+x];if(sizes[id]>400)counts.set(id,(counts.get(id)??0)+1);
     }
     const owner=[...counts].sort((a,b)=>b[1]-a[1])[0][0];let lost=0,foreign=0;
     const inside=(x,y)=>!frame.outline||frame.outline.every((a,i)=>{const b=frame.outline[(i+1)%frame.outline.length];return (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-8;});
     for(let y=top;y<top+height;y++)for(let x=left;x<left+width;x++){
      const id=labels[y*w+x],kept=inside((x-left+.5)/width,(y-top+.5)/height);
      if(id===owner&&!kept)lost++;
      if(id!==owner&&sizes[id]>400&&kept)foreign++;
     }
     results.push({frame:frame.id,lost,foreign});
    }
   }
   return results;
  });
  fs.writeFileSync('artifacts/directional-sprites/mochi-atlas-check.json',JSON.stringify(checks,null,2));
  for(const check of checks){assert.equal(check.lost,0,`${check.frame}: guard clips Mochi's artwork`);assert.equal(check.foreign,0,`${check.frame}: another sprite leaks into this frame`);}
  console.log('All 17 Mochi crops preserve their silhouette and exclude neighboring sprites');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
