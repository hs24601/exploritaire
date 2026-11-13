const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const start=Date.now(),browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5178/tools/hero-world-exploration.html',{waitUntil:'domcontentloaded',timeout:20000});
 await p.waitForFunction(()=>window.__heroWorldPreview?.mesh.visible,null,{timeout:20000});
 await p.locator('#play').uncheck();const ids=await p.locator('#action option').evaluateAll(a=>a.map(o=>o.value));const clips=[];
 for(const id of ids){await p.selectOption('#action',id);await p.waitForFunction(id=>window.__heroWorldPreview?.data.action===id&&window.__heroWorldPreview.mesh.visible,id,{timeout:10000});
  const row=await p.evaluate(()=>{const s=__heroWorldPreview,c=document.createElement('canvas');c.width=1536;c.height=1152;const ctx=c.getContext('2d');ctx.drawImage(s.mesh.material.map.image,0,0);const rgba=ctx.getImageData(0,0,1536,1152).data;let missing=0;for(let i=0;i<44;i++){let n=0;for(let y=12;y<190;y+=4)for(let x=8;x<184;x+=4){if(rgba[((Math.floor(i/8)*192+y)*1536+(i%8*192+x))*4+3]>64)n++;}if(n<25)missing++;}return {id:s.data.action,missing,corners:[rgba[3],rgba[(1535)*4+3]],resident:s.textures.diagnostics.resident.length};});
  assert.equal(row.missing,0);assert(row.corners.every(a=>a<=2));assert(row.resident<=4);clips.push(row);
 }
 for(const [degrees,tier] of [[10,'low'],[55,'high'],[85,'top']]){await p.locator('#elevation').fill(String(degrees));for(const yaw of [-180,-90,0,90,180]){await p.locator('#yaw').fill(String(yaw));await p.waitForTimeout(40);assert.equal(await p.evaluate(()=>__heroWorldPreview.data.view.elevation),tier);}}
 await p.locator('#elevation').fill('20');await p.locator('#yaw').fill('90');await p.selectOption('#action','bound');await p.waitForTimeout(150);await p.screenshot({path:'artifacts/hero-world-exploration-preview.png'});
 await p.click('#turn');await p.waitForFunction(()=>__heroWorldPreview.data.quickTurn&&__heroWorldPreview.data.velocity[0]>0,null,{timeout:3000});const turn=await p.evaluate(()=>__heroWorldPreview.data);assert.equal(turn.action,'spin180');
 await p.click('#climb');await p.waitForFunction(()=>__heroWorldPreview.data.scaffold>.05,null,{timeout:3000});const climb=await p.evaluate(()=>__heroWorldPreview.data);assert.equal(climb.action,'climb90');
 assert.deepEqual(errors,[]);const result={clips,orbit:true,quickTurn:turn,climb,errors,elapsedMs:Date.now()-start};fs.writeFileSync('artifacts/hero-world-exploration-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify({clips:clips.length,poses:clips.length*44,orbit:true,quickTurn:true,climb:true,errors,elapsedMs:result.elapsedMs}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
