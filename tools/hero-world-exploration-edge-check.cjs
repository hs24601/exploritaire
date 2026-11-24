const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1200,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5178/tools/hero-world-exploration.html',{waitUntil:'domcontentloaded',timeout:20000});
 await p.waitForFunction(()=>window.__heroWorldPreview?.mesh.visible,null,{timeout:20000});await p.selectOption('#action','leap');await p.locator('#play').uncheck();await p.locator('#yaw').fill('90');
 await p.waitForFunction(()=>__heroWorldPreview.data.action==='leap'&&__heroWorldPreview.mesh.visible);
 const result=await p.evaluate(()=>{const image=__heroWorldPreview.mesh.material.map.image,c=document.createElement('canvas');c.width=1536;c.height=1152;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const a=ctx.getImageData(0,0,1536,1152).data;let edgeInk=0;for(let frame=0;frame<44;frame++){const ox=frame%8*192,oy=Math.floor(frame/8)*192;for(let y=0;y<192;y++)for(const x of [0,1,190,191])if(a[((oy+y)*1536+ox+x)*4+3]>32)edgeInk++;}return{edgeInk,frames:44,pose:__heroWorldPreview.data};});
 assert.equal(result.edgeInk,0);assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/hero-world-exploration-edge-check.json',JSON.stringify({...result,errors},null,2));console.log(JSON.stringify({leapFrames:44,edgeInk:result.edgeInk,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
