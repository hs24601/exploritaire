const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
const directory='artifacts/painted-woods-v1';fs.mkdirSync(directory,{recursive:true});
async function center(el){const r=await el.boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};}
async function drag(page,from,to,touch){
 const cdp=touch?await page.context().newCDPSession(page):null;
 const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[p]});
 if(touch)await send('touchStart',from);else {await page.mouse.move(from.x,from.y);await page.mouse.down();}
 for(let i=1;i<=12;i++){const p={x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12};if(touch)await send('touchMove',p);else await page.mouse.move(p.x,p.y);}
 if(touch)await send('touchEnd',to);else await page.mouse.up();await cdp?.detach();
}
async function stats(page){return page.locator('[data-volume-surface="paint"]').evaluateAll(canvases=>canvases.map(canvas=>{
 const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
 let count=0,hash=0,left=Infinity,right=-Infinity,clipped=false;
 for(let i=0;i<data.length/4;i++)if(data[i*4+3]){const x=i%canvas.width,y=Math.floor(i/canvas.width);left=Math.min(left,x);right=Math.max(right,x);count++;hash=(hash*31+data[i*4]+data[i*4+1]+data[i*4+2])|0;if(!x||!y||x===canvas.width-1||y===canvas.height-1)clipped=true;}
 const owner=canvas.closest('[data-environment-prop]');
 return {source:canvas.dataset.volumeSource,yaw:canvas.dataset.volumeYaw,elevation:canvas.dataset.volumeElevation,count,hash,width:right-left,clipped,engine:canvas.dataset.volumeEngine,sampling:getComputedStyle(canvas).imageRendering,
  x:owner.style.left,y:owner.style.top,w:owner.dataset.sceneryWidth,h:owner.dataset.sceneryHeight,opacity:getComputedStyle(owner).opacity,peek:canvas.dataset.actorPeek==='true'};
}));}
async function gallery(page,suffix='gpu'){
 const metrics=await page.evaluate(async()=>{
  const {buildPropVolume,propVolumeRecipe,propVolumeRaster,renderPropVolume}=await import('/src/proto/propVolume.ts');
  const {renderVolumeGPUViews}=await import('/src/proto/propVolumeRenderer.ts');
  const load=async(src,limit)=>{const image=new Image();image.src=src;await image.decode();const scale=limit/Math.max(image.width,image.height),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);return buildPropVolume(canvas.width,canvas.height,ctx.getImageData(0,0,canvas.width,canvas.height).data,propVolumeRecipe(src));};
  const volume=await load('/assets/biomes/watercolor-v1/pine-relief-v1.png',192),pixel=await load('/assets/biomes/small_woods_pines.png',64);
  const light={direction:[.5,1,.8],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[255,255,255]};
  const host=document.createElement('div');host.id='painted-gallery';host.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px;z-index:99999;background:#18221e;display:grid;grid-template-columns:repeat(4,1fr);padding:20px;gap:8px;color:white;box-sizing:border-box;';document.body.append(host);
  const models=[...Array.from({length:8},(_,i)=>({volume,yaw:i*45,elevation:30})),{volume:pixel,yaw:0,elevation:30},{volume,yaw:360,elevation:30}];
  const entries=models.map(({volume,yaw,elevation},i)=>{const raster=propVolumeRaster(volume),canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;const wrapper=document.createElement('div');wrapper.innerHTML=`<div style="font:16px monospace">${yaw}° orbit · ${elevation}° elevation</div>`;canvas.style.cssText='width:248px;height:310px;image-rendering:auto';wrapper.append(canvas);if(i<8)host.append(wrapper);return {target:canvas.getContext('2d'),volume,yaw,elevation,light,monochrome:false};});
  const gpu=await renderVolumeGPUViews(entries);
  // Compare identical atlas slots: GPU edge precision can vary by viewport
  // position even with identical geometry and camera matrices.
  if(gpu){await renderVolumeGPUViews([entries[0]]);await renderVolumeGPUViews([entries[9]]);}
  if(!gpu)for(const e of entries)e.target.putImageData(new ImageData(renderPropVolume(e.volume,e.yaw,e.elevation,e.light),e.target.canvas.width,e.target.canvas.height),0,0);
  window.__paintedGallery={volume,entries};
  return {gpu,faces:volume.faces.length,width:volume.width,depth:volume.depth,height:volume.height,views:entries.map(e=>{const d=e.target.getImageData(0,0,e.target.canvas.width,e.target.canvas.height).data;let count=0,left=Infinity,right=-Infinity,clipped=false,hash=0;for(let i=0;i<d.length/4;i++)if(d[i*4+3]){count++;hash=(hash*31+d[i*4]+d[i*4+1]+d[i*4+2])|0;const x=i%e.target.canvas.width,y=Math.floor(i/e.target.canvas.width);left=Math.min(left,x);right=Math.max(right,x);if(x===0||y===0||x===e.target.canvas.width-1||y===e.target.canvas.height-1)clipped=true;}return {count,width:right-left,clipped,raster:e.target.canvas.width,hash};})};
 });
 assert.ok(metrics.views.every(v=>v.count>100&&!v.clipped),'Mixed pixel/paint atlas views complete and contained');
 assert.ok(metrics.width<=.921&&metrics.depth<=.921);assert.equal(metrics.views[8].raster,128);
 assert.equal(metrics.views[0].hash,metrics.views[9].hash,'Fixed lighting returns identical pigment after 360');
 await page.locator('#painted-gallery').screenshot({path:`${directory}/${suffix}-orbit-gallery-3x.png`});
 await page.locator('#painted-gallery canvas').nth(0).screenshot({path:`${directory}/${suffix}-relief-front-3x.png`});
 await page.locator('#painted-gallery canvas').nth(2).screenshot({path:`${directory}/${suffix}-relief-side-3x.png`});
 await page.locator('#painted-gallery').evaluate(el=>el.remove());return metrics;
}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,touch] of [[1280,false],[1912,true]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await page.waitForTimeout(1500);
  const galleryMetrics=width===1280?await gallery(page):null;
  await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
  await page.getByRole('slider',{name:'Travel speed',exact:true}).fill('500');
  // A legal empty square next to Dark Woods discovers it without starting combat.
  await page.evaluate(()=>{const marker=document.createElement('i');marker.id='woods-destination';marker.style.cssText='position:absolute;left:calc(50% - 96px);top:50%;width:1px;height:1px;pointer-events:none';document.querySelector('[data-physical-world]').append(marker);});
  await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('#woods-destination')),touch);
  await page.waitForTimeout(350);await page.locator('[data-route-line]').waitFor({state:'detached',timeout:30000});
  const woods=page.locator('[data-biome-id="woods-danger"]');assert.equal(await woods.getAttribute('data-tile-type'),'woods');
  assert.ok(await woods.locator('[data-scenery-art-style="paint"] img').count()>0);
  await page.screenshot({path:`${directory}/${width}-ott-3x.png`});
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
  await page.locator('[data-biome-popup="woods-danger"] [data-volume-surface="paint"][data-volume-engine]').waitFor();await page.waitForTimeout(600);
  const orbit=[];
  for(let i=0;i<=8;i++){
   if(i){const button=page.getByRole('button',{name:'Turn table right',exact:true});if(touch)await button.tap();else await button.click();await page.waitForTimeout(500);}
   const data=await stats(page);assert.ok(data.length>0&&data.every(s=>s.count>50&&!s.clipped&&s.sampling==='auto'&&s.opacity==='1'));
   orbit.push(data);if([0,2,4,6].includes(i))await page.screenshot({path:`${directory}/${width}-orbit-${i*45}-3x.png`});
  }
  const anchors=row=>row.map(({x,y,w,h})=>({x,y,w,h}));for(const data of orbit)assert.deepEqual(anchors(data),anchors(orbit[0]));
  assert.deepEqual(orbit[0].map(s=>s.yaw),orbit[8].map(s=>s.yaw),'A full orbit restores camera angles');
  orbit[0].forEach((s,i)=>assert.ok(Math.abs(s.count-orbit[8][i].count)/s.count<.02,'A full orbit restores opaque geometry; color retains live candle flicker'));
  assert.notDeepEqual(orbit[0].map(s=>s.hash),orbit[2].map(s=>s.hash));
  assert.ok(await page.locator('[data-volume-shadow]').count()>0);
  const cog=page.getByRole('button',{name:'Game settings',exact:true});await cog.click();await page.getByLabel('Art style',{exact:true}).selectOption('pixel');await page.keyboard.press('Escape');
  await page.locator('[data-biome-popup="woods-danger"] [data-volume-surface="pixel"][data-volume-engine]').waitFor();assert.equal(await page.locator('[data-volume-surface="paint"]').count(),0);
  await cog.click();await page.getByLabel('Art style',{exact:true}).selectOption('paint');await page.keyboard.press('Escape');await page.locator('[data-biome-popup="woods-danger"] [data-volume-surface="paint"][data-volume-engine]').waitFor();
  // Put the live actor on the legal empty square directly behind the woods.
  await page.locator('#woods-destination').evaluate(el=>{el.style.left='calc(50% - 144px)';});
  await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('#woods-destination')),touch);
  await page.waitForTimeout(300);await page.locator('[data-route-line]').waitFor({state:'detached',timeout:20000});
  let peekCount=0;
  for(let i=0;i<4;i++){peekCount+=(await stats(page)).filter(s=>s.peek).length;await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(400);}
  assert.ok(peekCount>0,'Painted relief uses the shared opening around the live actor');
  await page.screenshot({path:`${directory}/${width}-actor-peek-3x.png`});
  // Open settings before keyboard inspection: clicking the cog is an outside
  // press and intentionally dismisses an already-open nonmodal tile card.
  await cog.click();await woods.focus();await page.keyboard.press('Enter');const card=page.locator('[data-tile-card-art="woods-danger"] img');await card.waitFor();assert.match(await card.getAttribute('src'),/watercolor-v1/);
  await page.getByLabel('Art style',{exact:true}).selectOption('pixel');assert.match(await card.getAttribute('src'),/small_woods_pines/);
  await page.getByLabel('Art style',{exact:true}).selectOption('paint');assert.match(await card.getAttribute('src'),/watercolor-v1/);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Reset View',exact:true}).click();const box=await page.locator('.proto-map-viewport').boundingBox();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75);
  for(let i=0;i<40;i++){await page.mouse.wheel(0,-160);await page.waitForTimeout(25);}await page.waitForTimeout(800);
  const low=await stats(page);assert.ok(low.every(s=>Number(s.elevation)<30&&s.count>50&&!s.clipped));await page.screenshot({path:`${directory}/${width}-low-3x.png`});
  await page.getByRole('button',{name:'Reset View',exact:true}).click();await page.getByRole('button',{name:'Flat camera view',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-prop-volume]').length===0);
  assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-readouts,.proto-map-fps,.proto-map-zoom,.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
  assert.deepEqual(errors,[]);fs.writeFileSync(`${directory}/${width}-metrics.json`,JSON.stringify({gallery:galleryMetrics,orbit,low,peekCount},null,2));
  console.log(`PASS ${width}: ${touch?'touch':'mouse'} discovery, overhead paint, full orbit, fixed placements, smooth sampling, opaque props, shadows, Pixel/Paint switching, low elevation, actor peek-through, live card art and footer layout.`);await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:3});const page=await context.newPage();await page.goto(URL+'?propRenderer=canvas');const metrics=await gallery(page,'canvas');assert.equal(metrics.gpu,false);fs.writeFileSync(`${directory}/canvas-metrics.json`,JSON.stringify(metrics,null,2));await context.close();console.log('PASS CPU fallback and mixed raster dimensions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
