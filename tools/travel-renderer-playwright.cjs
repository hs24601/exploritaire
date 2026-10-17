const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],workers=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('worker',worker=>workers.push(worker.url()));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(URL);await page.getByRole('slider',{name:'Travel speed'}).waitFor();
  const rows=await page.evaluate(async()=>{
   const {buildPropVolume,renderPropVolume,VOLUME_RASTER_WIDTH:w,VOLUME_RASTER_HEIGHT:h}=await import('/src/proto/propVolume.ts');
   const {renderVolumeGPUViews,volumeShadowProjection}=await import('/src/proto/propVolumeRenderer.ts');
   const {paintVolumeShadow}=await import('/src/proto/components/PropVolume.tsx');
   const pixels=new Uint8ClampedArray(10*10*4);
   for(let y=0;y<10;y++)for(let x=0;x<10;x++)pixels.set([80+x*9,90+y*6,40+x*3,255],(y*10+x)*4);
   const volume=buildPropVolume(10,10,pixels,{bands:[0,1],depth:.9,trim:true}),rows=[];
   const canvas=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c.getContext('2d');};
   const compare=(actual,expected)=>{
    let common=0,union=0,difference=0,alpha=0;
    for(let i=0;i<actual.length;i+=4){const a=actual[i+3]>127,b=expected[i+3]>127;if(a||b)union++;if(a&&b){common++;for(let j=0;j<3;j++)difference+=Math.abs(actual[i+j]-expected[i+j]);}alpha+=Math.abs(actual[i+3]-expected[i+3]);}
    return{common,coverage:common/union,colorError:difference/(common*3),alphaError:alpha/(w*h)};
   };
   for(const monochrome of [false,true])for(const [yaw,elevation]of [[0,15],[45,30],[90,30],[180,60],[270,80]]){
    const target=canvas(),light={direction:[.8,.9,-.4],brightness:.7,localDirection:[-.5,.65,.8],localAmount:.8,tint:[255,150,70]};
    const gpu=await renderVolumeGPUViews([{target,volume,yaw,elevation,light,monochrome}]);
    rows.push({kind:'material',yaw,elevation,monochrome,gpu,...compare(target.getImageData(0,0,w,h).data,renderPropVolume(volume,yaw,elevation,light,monochrome))});
   }
   for(const [s,c]of [[0,-.3],[.7,-.7],[-1.8,1.1]]){
    const target=canvas(),expected=canvas(),shadow=volumeShadowProjection(volume,s,c);
    const light={direction:[0,1,0],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[0,0,0]};
    const gpu=await renderVolumeGPUViews([{target,volume,yaw:0,elevation:90,light,monochrome:false,shadow}]);
    paintVolumeShadow(expected,volume.faces.map(face=>face.vertices.map(([x,y,z])=>[x+y*s,z+y*c])),shadow);
    rows.push({kind:'shadow',s,c,gpu,...compare(target.getImageData(0,0,w,h).data,expected.getImageData(0,0,w,h).data)});
   }
   return rows;
  });
  fs.mkdirSync('artifacts/travel-performance',{recursive:true});fs.writeFileSync('artifacts/travel-performance/renderer-parity.json',JSON.stringify(rows,null,2));
  assert.ok(workers.some(url=>url.includes('propVolumeWorker')),'GPU rendering worker starts');
  for(const row of rows){assert.equal(row.gpu,true);assert.ok(row.coverage>.96,`silhouette differs: ${JSON.stringify(row)}`);assert.ok(row.colorError<4,`material differs: ${JSON.stringify(row)}`);assert.ok(row.alphaError<8,`shadow edges differ: ${JSON.stringify(row)}`);}
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1800);
  assert.equal(await page.locator('[data-ground-light="bounded"]').count(),1);
  const sizes=await page.locator('[data-ground-light="bounded"]').evaluate(el=>({width:el.width,height:el.height}));
  assert.ok(sizes.width<=512&&sizes.height<=320,'Ground projection remains bounded');
  await page.screenshot({path:'artifacts/travel-performance/renderer-home.png'});
  await page.evaluate(()=>document.querySelector('[data-ground-light="bounded"]').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  await page.waitForTimeout(300);assert.equal(await page.locator('[data-ground-light="bounded"]').count(),0);
  assert.equal(await page.locator('.proto-ground-light canvas').count(),1,'Context loss restores the existing 2D wash');
  assert.deepEqual(errors,[]);console.log('PASS rendering worker, CPU/GPU material and shadow parity, bounded ground projection and context-loss fallback',JSON.stringify(rows));
  await page.close();
  for(const mode of ['worker-disabled','cpu']){
   const fallback=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true}),failures=[];
   fallback.on('pageerror',error=>failures.push(error.message));
   if(mode==='worker-disabled')await fallback.addInitScript(()=>Object.defineProperty(window,'Worker',{value:undefined}));
   await fallback.goto(URL+(mode==='cpu'?'?propRenderer=canvas&groundRenderer=canvas':''));
   await fallback.getByRole('button',{name:'Tilt camera view',exact:true}).tap();
   const engine=mode==='cpu'?'canvas':'webgl';
   await fallback.waitForFunction(expected=>{
    const canvases=[...document.querySelectorAll('[data-prop-volume]')];
    return canvases.length>=5&&canvases.every(canvas=>canvas.dataset.volumeEngine===expected&&canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,i)=>i%4===3&&value));
   },engine);
   await fallback.getByRole('button',{name:'Turn table right',exact:true}).tap();await fallback.waitForTimeout(750);
   const painted=await fallback.locator('[data-prop-volume]').evaluateAll(canvases=>canvases.every(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return count>1000;
   }));
   assert.ok(painted,`${mode}: orbit preserves solid coverage`);assert.deepEqual(failures,[]);
   await fallback.screenshot({path:`artifacts/travel-performance/${mode}.png`});await fallback.close();console.log('PASS',mode,'fallback and touch orbit');
  }
  const walking=await browser.newPage({viewport:{width:1280,height:720}});
  await walking.goto(URL);await walking.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
  await walking.evaluate(()=>{
   const world=document.querySelector('[data-physical-world]'),anchor=document.createElement('i');
   anchor.style.cssText='position:absolute;left:50%;top:calc(50% - 96px);width:0;height:0';world.append(anchor);
   const r=anchor.getBoundingClientRect();anchor.remove();
   window.dispatchEvent(new CustomEvent('proto-actor-pointer-drop',{detail:{actorId:'hero',x:r.x,y:r.y}}));
  });
  await walking.waitForFunction(()=>document.querySelector('[data-board-piece="actor"] canvas')?.dataset.spritePose==='walking');
  await walking.evaluate(()=>{window.walkingCanvas=document.querySelector('[data-board-piece="actor"] canvas');});
  await walking.getByRole('button',{name:'Tilt camera view',exact:true}).click();await walking.waitForTimeout(650);
  assert.ok(await walking.evaluate(()=>window.walkingCanvas===document.querySelector('[data-board-piece="actor"] canvas')),'OTT/immersion retain the existing actor renderer');
  const phases=await walking.evaluate(()=>new Promise(resolve=>{
   const seen=new Set(),start=performance.now();function tick(){const actor=document.querySelector('[data-board-piece="actor"]');
    if(actor.dataset.actorPose==='walking')seen.add(actor.querySelector('canvas')?.dataset.animationFrame);
    if(actor.dataset.actorPose!=='walking'||performance.now()-start>10000)resolve([...seen]);else requestAnimationFrame(tick);
   }tick();
  }));
  assert.ok(phases.length>=3,`Walking phases advance from live ground distance: ${phases}`);
  assert.equal(await walking.locator('[data-board-piece="actor"]').getAttribute('data-actor-pose'),'sitting');
  await walking.close();console.log('PASS persistent actor renderer, live walking phases and arrival pose');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
