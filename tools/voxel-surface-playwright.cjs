const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
const directory='artifacts/voxel-surface';fs.mkdirSync(directory,{recursive:true});
(async()=>{const browser=await chromium.launch();try{
  const page=await browser.newPage({viewport:{width:1912,height:914}});
  await page.goto(url);
  const result=await page.evaluate(async()=>{
    const {buildPropVolume,propVolumeRecipe,renderPropVolume,VOLUME_RASTER_WIDTH:width,VOLUME_RASTER_HEIGHT:height}=await import('/src/proto/propVolume.ts');
    const {renderVolumeGPUViews}=await import('/src/proto/propVolumeRenderer.ts');
    const light={direction:[1,1,1],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[255,220,160]};
    const models=[];
    for(const src of ['small_woods_pines.png','woods_side.svg','woods_front.svg','mountain_standee.svg','hero-den-standee-v2.png','berry-bush.svg']){
      const image=new Image();image.src='/assets/biomes/'+src;await image.decode();
      const scale=Math.min(1,64/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,canvas.width,canvas.height);
      models.push({src,volume:buildPropVolume(canvas.width,canvas.height,ctx.getImageData(0,0,canvas.width,canvas.height).data,propVolumeRecipe(src))});
    }
    // More than sixteen different views exercises atlas rows and chunk rollover.
    const requests=models.flatMap(({src,volume})=>[0,45,90,180,270].map(yaw=>{
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      return {src,canvas,target:canvas.getContext('2d',{willReadFrequently:true}),volume,yaw,elevation:30,light,monochrome:false};
    }));
    const gpu=renderVolumeGPUViews(requests);
    const comparisons=requests.map(request=>{
      const pixels=request.target.getImageData(0,0,width,height).data,cpu=renderPropVolume(request.volume,request.yaw,30,light);
      let maskDifference=0,colorError=0,common=0,ink=0;
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i+3])ink++;
        if(Boolean(pixels[i+3])!==Boolean(cpu[i+3]))maskDifference++;
        if(pixels[i+3]&&cpu[i+3]){common++;for(let c=0;c<3;c++)colorError+=Math.abs(pixels[i+c]-cpu[i+c]);}
      }
      return {src:request.src,yaw:request.yaw,ink,maskDifference:maskDifference/(width*height),colorError:colorError/(common*3)};
    });
    // Alternate lighting on the same solid, then return to the earlier light.
    const first=requests[0],original=first.target.getImageData(0,0,width,height).data.slice();
    renderVolumeGPUViews([{...first,light:{...light,brightness:.3}},first]);
    const restored=first.target.getImageData(0,0,width,height).data;
    const stable=restored.every((value,index)=>value===original[index]);
    const gallery=document.createElement('div');gallery.id='voxel-test-gallery';
    gallery.style.cssText='position:fixed;inset:0;z-index:999999;background:#172624;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px;font:16px monospace;color:white';
    for(const request of requests){const cell=document.createElement('div');cell.textContent=`${request.src} · ${request.yaw}°`;request.canvas.style.cssText='display:block;width:256px;height:320px;image-rendering:pixelated';cell.append(request.canvas);gallery.append(cell);}
    document.body.append(gallery);return {gpu,stable,comparisons};
  });
  assert.ok(result.gpu);assert.ok(result.stable,'Lighting cache restores an identical view');
  for(const sample of result.comparisons){assert.ok(sample.ink>100);assert.ok(sample.maskDifference<.015,JSON.stringify(sample));assert.ok(sample.colorError<4,JSON.stringify(sample));}
  for(let row=0;row<6;row++){
    await page.locator('#voxel-test-gallery').evaluate((el,row)=>{el.scrollTop=row*350;},row);
    await page.screenshot({path:`${directory}/gallery-${row}.png`});
  }
  fs.writeFileSync(`${directory}/gpu-canvas-comparison.json`,JSON.stringify(result,null,2));
  console.log('PASS six recipes × five headings: GPU/CPU agreement, 30-view atlas rollover, and lighting cache restoration.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
