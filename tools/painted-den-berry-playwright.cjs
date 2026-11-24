const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
const directory='artifacts/painted-den-berry-v1';fs.mkdirSync(directory,{recursive:true});
const sources={'hero-den':'hero-den-sprite-v1.png','day-one-berries':'berry-patch-sprite-v2.png'};
async function center(el){const r=await el.boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};}
async function drag(page,from,to,touch){
 const cdp=touch?await page.context().newCDPSession(page):null;
 const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[p]});
 if(touch)await send('touchStart',from);else{await page.mouse.move(from.x,from.y);await page.mouse.down();}
 for(let i=1;i<=12;i++){const p={x:from.x+(to.x-from.x)*i/12,y:from.y+(to.y-from.y)*i/12};if(touch)await send('touchMove',p);else await page.mouse.move(p.x,p.y);}
 if(touch)await send('touchEnd',to);else await page.mouse.up();await cdp?.detach();
}
async function sprites(page){return page.locator('[data-biome-popup="hero-den"],[data-biome-popup="day-one-berries"]').evaluateAll(props=>props.map(el=>{
 const art=el.querySelector('.proto-sprite-standee__art'),d=el.dataset,s=getComputedStyle(art),r=art.getBoundingClientRect();
 const coordinate=value=>{const m=value.match(/50%\s*([+-])\s*([-\d.]+)px/);return m?Number(m[2])*(m[1]==='-'?-1:1):0;};
 const x=coordinate(el.style.left),y=coordinate(el.style.top),width=Number(d.sceneryWidth)*Number(el.style.getPropertyValue('--scenery-fit-scale')||1);
 return {id:d.biomePopup,source:s.backgroundImage,sampling:s.imageRendering,x,y,width,height:Number(d.sceneryHeight),screenWidth:r.width,screenHeight:r.height,
  contained:Math.abs(x-Number(d.ownerX))+width/2<=Number(d.ownerWidth)/2-.99&&Math.abs(y-Number(d.ownerY))+width/2<=Number(d.ownerHeight)/2-.99,
  volume:!!el.querySelector('[data-prop-volume]'),billboard:d.sceneryBillboard,peek:!!el.querySelector('[data-actor-peek="true"]')};
}));}
async function switchArt(page,style){await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByLabel('Art style',{exact:true}).selectOption(style);await page.keyboard.press('Escape');}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,touch] of [[1280,false],[1912,true]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(URL);await page.waitForTimeout(1400);
  await page.getByRole('button',{name:'Reset View',exact:true}).click();
  const flat=page.getByRole('button',{name:'Flat camera view',exact:true});if(await flat.count())await flat.click();
  await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();await page.getByRole('slider',{name:'Travel speed',exact:true}).fill('500');
  for(const [attribute,file] of [['den-overhead','hero-den-overhead-v1.png'],['berry-overhead','berry-patch-overhead-v2.png'],['den-ground','woodland-ground-v1.png'],['berry-ground','woodland-ground-v1.png']]){
   const el=page.locator(`[data-${attribute}]`);await el.waitFor();assert.ok((await el.getAttribute('src')).endsWith(file));assert.equal(await el.evaluate(el=>getComputedStyle(el).imageRendering),'auto');
  }
  assert.ok((await page.locator('[data-den-roof] image').getAttribute('href')).endsWith('hero-den-overhead-v1.png'));
  await page.screenshot({path:`${directory}/${width}-ott-3x.png`});
  await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.locator('[data-biome-popup="hero-den"] .proto-sprite-standee__art').waitFor();await page.waitForTimeout(500);
  const orbit=[];
  for(let i=0;i<=8;i++){
   if(i){const button=page.getByRole('button',{name:'Turn table right',exact:true});if(touch)await button.tap();else await button.click();await page.waitForTimeout(350);}
   const data=await sprites(page);assert.equal(data.length,2);
   assert.ok(data.every(s=>s.source.includes(sources[s.id])&&s.sampling==='auto'&&s.contained&&!s.volume&&s.billboard==='paint'&&s.screenWidth>2&&s.screenHeight>2),JSON.stringify(data));
   orbit.push(data);if([0,2,4,6].includes(i))await page.screenshot({path:`${directory}/${width}-orbit-${i*45}-3x.png`});
  }
  const anchors=row=>row.map(({id,x,y,width,height,source})=>({id,x,y,width,height,source}));for(const data of orbit)assert.deepEqual(anchors(data),anchors(orbit[0]));
  assert.ok(await page.locator('[data-shadow-owner="biome"]').count()>0);
  assert.ok(await page.locator('[data-volume-surface="pixel"]').count()>0,'Unrelated mountain solids remain');
  await switchArt(page,'pixel');for(const id of Object.keys(sources))await page.locator(`[data-biome-popup="${id}"] [data-volume-surface="pixel"][data-volume-engine]`).waitFor();
  assert.ok((await page.locator('[data-den-ground]').getAttribute('src')).endsWith('hero-den-ground-v3.png'));
  await switchArt(page,'paint');await page.locator('[data-biome-popup="hero-den"] .proto-sprite-standee__art').waitFor();
  for(const [id,src] of Object.entries(sources)){
   await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.locator(`[data-biome-id="${id}"]`).focus();await page.keyboard.press('Enter');
   const card=page.locator(`[data-tile-card-art="${id}"] img`);await card.waitFor();assert.ok((await card.getAttribute('src')).endsWith(src));
   await page.getByLabel('Art style',{exact:true}).selectOption('pixel');assert.ok(!(await card.getAttribute('src')).includes('watercolor-v1'));
   await page.getByLabel('Art style',{exact:true}).selectOption('paint');assert.ok((await card.getAttribute('src')).endsWith(src));
   await page.screenshot({path:`${directory}/${width}-${id}-card-3x.png`});await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  }
  // Capture a closer view through normal camera zoom. Pan remains normal after
  // Reset View exits the automatically opened actor close-up.
  const box=await page.locator('.proto-map-viewport').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
  for(let i=0;i<15;i++){await page.mouse.wheel(0,-160);await page.waitForTimeout(20);}await page.waitForTimeout(450);
  await page.locator('.proto-map-viewport').screenshot({path:`${directory}/${width}-painted-area-3x.png`});
  await page.getByRole('button',{name:'Reset View',exact:true}).click();if(await flat.count())await flat.click();
  await drag(page,await center(page.locator('[data-cell-grip="actor-hero"]')),await center(page.locator('[data-biome-id="day-one-berries"]')),touch);
  await page.locator('.proto-occupied-foundation-face').waitFor({timeout:30000});assert.equal(await page.locator('.proto-main-tableau .playing-card').count(),10);
  // Exercise the unchanged foraging deal: ten cards, exactly two mana rewards.
  let berries=0;
  for(let i=0;i<10;i++){
   const card=page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
   if(await card.getAttribute('data-food-source')==='berries')berries++;
   if(touch)await card.tap();else await card.click();
   await page.waitForFunction(n=>document.querySelectorAll('.proto-main-tableau .playing-card').length===n&&!document.querySelector('[data-proto-card-flight]'),9-i,{timeout:6000});
  }
  assert.equal(berries,2);assert.match(await page.locator('.proto-ordinary-day').innerText(),/Mana 2/);
  await page.screenshot({path:`${directory}/${width}-berry-foraging-3x.png`});
  const tilt=page.getByRole('button',{name:'Tilt camera view',exact:true});if(await tilt.count())await tilt.click();
  let peekCount=0;
  for(let i=0;i<8;i++){peekCount+=(await sprites(page)).filter(s=>s.peek).length;await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(150);}
  assert.ok(peekCount>0,'Painted den/bushes share actor peek-through');
  await page.screenshot({path:`${directory}/${width}-occupied-berries-3x.png`});
  assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-readouts,.proto-map-fps,.proto-map-zoom,.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
  assert.deepEqual(errors,[]);fs.writeFileSync(`${directory}/${width}-metrics.json`,JSON.stringify({orbit,peekCount,berries,errors},null,2));await context.close();
  console.log(`PASS ${width} ${touch?'touch':'mouse'}: painted den/bush/ground/roof/overhead/card art, full orbit, fixed contained anchors, smooth sampling, Pixel solids, actor peek, ten-card foraging and two mana.`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
