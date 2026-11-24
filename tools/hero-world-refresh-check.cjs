const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const started=Date.now(),browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/tools/hero-world-exploration.html',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>window.__heroWorldPreview?.mesh.visible,null,{timeout:20000});await page.locator('#play').uncheck();
  const clips=[];
  for(const id of ['combatReady','combatStalk','combatBow','combatLeap','yawn','roll']){
   await page.selectOption('#action',id);
   await page.waitForFunction(id=>__heroWorldPreview.data.action===id&&__heroWorldPreview.mesh.visible,id,{timeout:10000});
   const row=await page.evaluate(()=>{
    const s=__heroWorldPreview,image=s.mesh.material.map.image,{cell,width,height}=s.data.atlas,c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,width,height).data;let missing=0,edgeInk=0;
    for(let n=0;n<44;n++){
     const ox=n%8*cell,oy=Math.floor(n/8)*cell;let solid=0;
     for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){
      const a=rgba[((oy+y)*width+ox+x)*4+3];if(a>64){solid++;if(x<2||x>=cell-2||y<2||y>=cell-2)edgeInk++;}
     }
     if(solid<300)missing++;
    }
    return{id:s.data.action,url:image.src,width:image.width,height:image.height,cell,missing,edgeInk,resident:s.textures.diagnostics.resident.length};
   });
   assert.equal(row.missing,0);assert(row.resident<=4);
   if(id!=='roll'){assert.equal(row.width,2048);assert.equal(row.height,1536);assert.equal(row.edgeInk,0);assert(row.url.includes(id==='yawn'?'/world-exploration/v2/':'/world-combat/v3/'));}
   clips.push(row);
  }
  for(const [id,phase] of [['combatReady','0'],['yawn','1.05']]){
   await page.selectOption('#action',id);await page.locator('#yaw').fill('0');await page.locator('#elevation').fill('20');await page.locator('#phase').fill(phase);
   await page.waitForFunction(id=>__heroWorldPreview.mesh.visible&&__heroWorldPreview.data.action===id,id);await page.waitForTimeout(100);
   await page.screenshot({path:'artifacts/hero-refresh-'+id+'.png'});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/hero-world-refresh-browser.json',JSON.stringify({clips,errors,elapsedMs:Date.now()-started},null,2));
  console.log(JSON.stringify({clips:clips.length,refreshedPoses:220,errors,elapsedMs:Date.now()-started}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
