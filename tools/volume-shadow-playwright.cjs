const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const width of [1280,1912]){
   const page=await browser.newPage({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3});
   await page.goto('http://localhost:5178/proto.html');await page.keyboard.press('Space');await page.waitForTimeout(1600);
   const result=await page.evaluate(async()=>{
    const {buildPropVolume,propVolumeRecipe}=await import('/src/proto/propVolume.ts');
    const {paintVolumeShadow}=await import('/src/proto/components/PropVolume.tsx');
    const results=[];
    for(const sprite of ['mountain_standee.svg','woods_side.svg','small_woods_pines.png']){
     const image=new Image();image.src='/assets/biomes/'+sprite;await image.decode();
     const input=document.createElement('canvas'),ratio=Math.min(1,64/Math.max(image.naturalWidth,image.naturalHeight));
     input.width=Math.max(1,Math.round(image.naturalWidth*ratio));input.height=Math.max(1,Math.round(image.naturalHeight*ratio));
     const source=input.getContext('2d');source.drawImage(image,0,0,input.width,input.height);
     const volume=buildPropVolume(input.width,input.height,source.getImageData(0,0,input.width,input.height).data,propVolumeRecipe(sprite));
     for(const [angle,length] of [[0,.3],[45,1],[123,2.2]]){
      const s=Math.sin(angle*Math.PI/180)*length,c=-Math.cos(angle*Math.PI/180)*length;
      const polygons=volume.faces.map(face=>face.vertices.map(([x,y,z])=>[x+y*s,z+y*c]));
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(const polygon of polygons)for(const [x,y]of polygon){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      const render=explicit=>{
       const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),path=new Path2D();
       const start=performance.now();
       if(!explicit){paintVolumeShadow(ctx,polygons,{left,top,right,bottom});return{data:ctx.getImageData(0,0,256,256).data,time:performance.now()-start};}
       for(const polygon of polygons){
        const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1]},0);
        if(Math.abs(area)<1e-8)continue;
        const ordered=area<0?[...polygon].reverse():polygon;
        ordered.forEach(([x,y],i)=>{const px=(x-left)/(right-left)*256,py=(y-top)/(bottom-top)*256;if(i)path.lineTo(px,py);else path.moveTo(px,py)});
        if(explicit)path.closePath();
       }
       ctx.fill(path,'nonzero');return{data:ctx.getImageData(0,0,256,256).data,time:performance.now()-start};
      };
      const old=render(true),current=render(false);let differences=0,ink=0;
      for(let i=0;i<old.data.length;i++){if(old.data[i]!==current.data[i])differences++;if(i%4===3&&current.data[i])ink++;}
      results.push({sprite,angle,length,faces:volume.faces.length,differences,ink,beforeMs:old.time,afterMs:current.time});
     }
    }
    return results;
   });
   assert.ok(result.every(row=>row.differences===0&&row.ink>1000),'Implicit closure preserves exact solid shadow pixels');
   assert.ok(result.filter(row=>row.faces>5000).every(row=>row.afterMs<row.beforeMs/5),'Complex solid shadows avoid the polygon-closure stall');
   assert.deepEqual(await findLayoutDefects(page,'.proto-map-toolbar',{parts:'button'}),[]);
   await page.screenshot({path:`artifacts/volume-shadow-${width}-3x.png`});
   console.log(`PASS ${width}: exact shadow pixels for mountains and trees, three directions/lengths, layout`,JSON.stringify(result));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
