const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
const directory='artifacts/painted-woods-sprites-v1';fs.mkdirSync(directory,{recursive:true});
async function center(el){const r=await el.boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};}
async function drag(page,from,to,touch){
 const cdp=touch?await page.context().newCDPSession(page):null;
 const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[p]});
 if(touch)await send('touchStart',from);else {await page.mouse.move(from.x,from.y);await page.mouse.down();}
 for(let i=1;i<=12;i++){const p={x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12};if(touch)await send('touchMove',p);else await page.mouse.move(p.x,p.y);}
 if(touch)await send('touchEnd',to);else await page.mouse.up();await cdp?.detach();
}
async function stats(page){return page.locator('[data-scenery-billboard="paint"]').evaluateAll(props=>props.map(el=>{
 const art=el.querySelector('.proto-sprite-standee__art,.proto-biome-edge__art'),s=getComputedStyle(art),box=art.getBoundingClientRect(),d=el.dataset;
 const scale=Number(el.style.getPropertyValue('--scenery-fit-scale')||1),width=Number(d.sceneryWidth)*scale,owner={x:Number(d.ownerX),y:Number(d.ownerY),width:Number(d.ownerWidth),height:Number(d.ownerHeight)};
 const foot={x:parseFloat(el.style.left.replace(/\s/g,'').match(/([-\d.]+)px/)[1]),y:parseFloat(el.style.top.replace(/\s/g,'').match(/([-\d.]+)px/)[1])};
 return {source:s.backgroundImage,sampling:s.imageRendering,filter:s.filter,screenWidth:box.width,screenHeight:box.height,
  x:foot.x,y:foot.y,width,height:Number(d.sceneryHeight)*scale,owner,
  contained:Math.abs(foot.x-owner.x)+width/2<=owner.width/2-.99&&Math.abs(foot.y-owner.y)+width/2<=owner.height/2-.99,
  volume:Boolean(el.querySelector('[data-prop-volume]')),reconstruction:Boolean(el.querySelector('[data-silhouette-material="relief"]')),
  opacity:getComputedStyle(el).opacity,parentFilter:getComputedStyle(el).filter,peek:el.querySelector('[data-actor-peek="true"]')!==null,transform:el.style.transform};
}));}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,touch] of process.env.COMBAT_ONLY?[]:process.env.PREVIEW_ONLY||process.env.OVERHEAD_ONLY?[[1280,false]]:[[1280,false],[1912,true]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  const flat=page.getByRole('button',{name:'Flat camera view',exact:true});if(await flat.count())await flat.click();
  await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
  await page.getByRole('slider',{name:'Travel speed',exact:true}).fill('500');
  // Legal adjacent empty square: discover Dark Woods without starting combat.
  await page.evaluate(()=>{const marker=document.createElement('i');marker.id='woods-destination';marker.style.cssText='position:absolute;left:calc(50% - 96px);top:50%;width:1px;height:1px;pointer-events:none';document.querySelector('[data-physical-world]').append(marker);});
  await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('#woods-destination')),touch);
  await page.waitForTimeout(350);await page.locator('[data-route-line]').waitFor({state:'detached',timeout:30000});
  const woods=page.locator('[data-biome-id="woods-danger"]');assert.equal(await woods.getAttribute('data-tile-type'),'woods');
  await woods.locator('[data-scenery-art-style="paint"] img').waitFor();assert.equal(await woods.locator('[data-scenery-art-style="paint"] [data-reveal]').count(),0,'Discovered painted crowns retain their full color');await page.screenshot({path:`${directory}/${width}-ott-3x.png`});
  if(process.env.OVERHEAD_ONLY){assert.deepEqual(errors,[]);await context.close();console.log('PASS discovered painted overhead woods retain full color.');continue;}
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
  const cluster=page.locator('[data-biome-popup="woods-danger"] .proto-sprite-standee__art');await cluster.waitFor();await page.waitForTimeout(500);
  const orbit=[];
  for(let i=0;i<=8;i++){
   if(i){const button=page.getByRole('button',{name:'Turn table right',exact:true});if(touch)await button.tap();else await button.click();await page.waitForTimeout(400);}
   const data=await stats(page);assert.ok(data.length>0&&data.every(s=>s.screenWidth>1&&s.screenHeight>1&&s.contained&&!s.volume&&!s.reconstruction&&s.sampling==='auto'&&s.opacity==='1'&&s.parentFilter==='none'),JSON.stringify({step:i,data},null,2));
   assert.ok(data.some(s=>s.source.includes('woods-cluster-sprite-v1.png')));
   orbit.push(data);if([0,2,4,6].includes(i))await page.screenshot({path:`${directory}/${width}-orbit-${i*45}-3x.png`});
  }
  const anchors=row=>row.map(({x,y,width,height,source})=>({x,y,width,height,source}));for(const data of orbit)assert.deepEqual(anchors(data),anchors(orbit[0]),'A camera turn preserves source art and fixed, contained trunks');
  assert.ok(await page.locator('[data-shadow-owner="biome"]').count()>0,'Painted cutouts retain silhouette shadows');
  const cog=page.getByRole('button',{name:'Game settings',exact:true});await cog.click();await page.getByLabel('Art style',{exact:true}).selectOption('pixel');await page.keyboard.press('Escape');
  await page.locator('[data-biome-popup="woods-danger"] [data-volume-surface="pixel"][data-volume-engine]').waitFor();assert.equal(await page.locator('[data-scenery-billboard="paint"]').count(),0);
  await cog.click();await page.getByLabel('Art style',{exact:true}).selectOption('paint');await page.keyboard.press('Escape');await cluster.waitFor();
  await page.locator('#woods-destination').evaluate(el=>{el.style.left='calc(50% - 144px)';});
  await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('#woods-destination')),touch);
  await page.waitForTimeout(300);await page.locator('[data-route-line]').waitFor({state:'detached',timeout:20000});
  let peekCount=0;
  for(let i=0;i<4;i++){const count=(await stats(page)).filter(s=>s.peek).length;peekCount+=count;if(count)await page.screenshot({path:`${directory}/${width}-actor-peek-3x.png`});await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(400);}
  assert.ok(peekCount>0,'Painted cutouts share the opening around the live actor');
  await cog.click();await woods.focus();await page.keyboard.press('Enter');const card=page.locator('[data-tile-card-art="woods-danger"] img');await card.waitFor();assert.match(await card.getAttribute('src'),/woods-cluster-sprite-v1/);
  await page.screenshot({path:`${directory}/${width}-card-3x.png`});
  await page.getByLabel('Art style',{exact:true}).selectOption('pixel');assert.match(await card.getAttribute('src'),/small_woods_pines/);
  await page.getByLabel('Art style',{exact:true}).selectOption('paint');assert.match(await card.getAttribute('src'),/woods-cluster-sprite-v1/);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  if(await page.getByRole('button',{name:'Tilt camera view',exact:true}).count())await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
  const box=await page.locator('.proto-map-viewport').boundingBox();await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75);
  for(let i=0;i<16;i++){await page.mouse.wheel(0,-160);await page.waitForTimeout(25);}await page.waitForTimeout(600);
  const low=await stats(page);assert.ok(low.length>0&&low.every(s=>s.contained&&!s.volume&&s.sampling==='auto'));
  // Use the normal right-drag camera pan to frame the actual woods cutout.
  const target=await center(cluster),from={x:box.x+box.width*.5,y:box.y+box.height*.55};
  await page.mouse.move(from.x,from.y);await page.mouse.down({button:'right'});
  await page.mouse.move(from.x+(from.x-target.x),from.y+(from.y-target.y),{steps:12});await page.mouse.up({button:'right'});await page.waitForTimeout(500);
  await page.screenshot({path:`${directory}/${width}-close-3x.png`});
  if(process.env.PREVIEW_ONLY||width===1280){
   await page.getByRole('checkbox',{name:'Table lights',exact:true}).uncheck();
   await page.locator('#woods-destination').evaluate(el=>{el.style.left='calc(50% - 96px)';});
   await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('#woods-destination')),false);
   await page.waitForTimeout(300);await page.locator('[data-route-line]').waitFor({state:'detached',timeout:20000});await page.waitForTimeout(500);
   await page.screenshot({path:`${directory}/painted-woods-in-game-3x.png`});
  }
  await page.getByRole('button',{name:'Reset View',exact:true}).click();if(await flat.count())await flat.click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-scenery-billboard="paint"]').length===0);
  assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-readouts,.proto-map-fps,.proto-map-zoom,.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
  assert.deepEqual(errors,[]);fs.writeFileSync(`${directory}/${width}-metrics.json`,JSON.stringify({orbit,low,peekCount,errors},null,2));
  console.log(`PASS ${width}: ${touch?'touch':'mouse'} discovery, overhead paint, original cutouts throughout 360 orbit, fixed contained trunks, smooth sampling, shadows, Pixel/Paint switching, actor peek, card art and footer layout.`);await context.close();
 }
 if(!process.env.PREVIEW_ONLY&&!process.env.OVERHEAD_ONLY){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:3,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],loaded=new Set();
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/biomes/')){assert.equal(r.status(),200);loaded.add(r.url());}});
  await page.goto(URL+'?combatdemo');await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').some(a=>a.id==='hero'));
  assert.ok([...loaded].some(src=>src.endsWith('/watercolor-v1/woods-cluster-sprite-v1.png')));
  await page.screenshot({path:`${directory}/combat-paint-3x.png`});
  const cog=page.getByRole('button',{name:'Game settings',exact:true});await cog.click();await page.getByLabel('Art style',{exact:true}).selectOption('pixel');await cog.click();
  await page.waitForResponse(r=>r.url().endsWith('/assets/biomes/small_woods_pines.png')).catch(()=>assert.ok([...loaded].some(src=>src.endsWith('/small_woods_pines.png'))));
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').some(a=>a.id==='hero'));
  await page.screenshot({path:`${directory}/combat-pixel-3x.png`});assert.deepEqual(errors,[]);await context.close();
  console.log('PASS combat-demo woods load the approved cluster, switch back to Pixel and retain live actors without browser errors.');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
