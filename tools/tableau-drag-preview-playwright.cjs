const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});const reports=[];
 try{for(const [width,height,touch,reduced]of [[1280,720,false,false],[1912,914,true,false],[390,844,true,true],[844,390,true,true]]){
  if(process.env.CHECK_WIDTH&&width!==Number(process.env.CHECK_WIDTH))continue;
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference',deviceScaleFactor:process.env.ZOOM_QA?3:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5178/proto.html');
  const opening=page.locator('[data-callout-id="day01.opening"]'),next=opening.locator('.proto-callout-next');await opening.waitFor();
  const press=async()=>touch?next.tap():next.click();if(await opening.getAttribute('data-revealing')==='true')await press();await press();
  await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='complete');
  if(await opening.getAttribute('data-revealing')==='true')await press();await press();await opening.waitFor({state:'hidden'});await page.waitForTimeout(reduced?150:2000);
  await page.locator('.day-objective .actor-drag-preview').waitFor({state:'visible'});
  const a=await page.locator('[data-map-actor-card="hero"]').boundingBox(),b=await page.locator('.day-objective__pin circle').boundingBox();assert(a&&b);
  const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
  if(touch){const client=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...from}]});for(let i=1;i<=10;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();}
  const preview=page.locator('.tableau-drag-preview');await preview.waitFor({state:'visible',timeout:15000});
  const sourceId=await preview.getAttribute('data-preview-source-card');assert(sourceId);
  const selected=page.locator(`.travel-tableau [data-travel-card="${sourceId}"]`);
  assert.equal(await selected.locator('.proto-card-center-rank').innerText(),'3');
  const expected=await page.evaluate(()=>{const dest=document.querySelector('[data-map-actor-card="hero"]').getBoundingClientRect(),x=dest.left+dest.width/2,y=dest.top+dest.height/2;return [...document.querySelectorAll('.travel-tableau [data-travel-card]:not(:disabled)')].filter(e=>e.querySelector('.proto-card-center-rank')?.textContent==='3').sort((a,b)=>{const distance=e=>{const r=e.getBoundingClientRect();return Math.hypot(r.left+r.width/2-x,r.top+r.height/2-y);};return distance(b)-distance(a);})[0].dataset.travelCard;});
  assert.equal(sourceId,expected);
  const summary=await page.locator('.travel-summary').innerText();assert.match(summary,/0\/12/);
  await page.waitForTimeout(reduced?750:1700);
  if(!reduced){await page.evaluate(async()=>(await import('/src/gameTime.ts')).gameTime.setPaused(true));const before=await preview.innerHTML();await page.waitForTimeout(250);assert.equal(await preview.innerHTML(),before);}
  else{assert.equal(await preview.locator('.actor-drag-preview__card').evaluate(e=>getComputedStyle(e).opacity),'0');}
  await page.screenshot({path:`artifacts/tableau-preview-${width}.png`});
  if(process.env.ZOOM_QA)await preview.locator('.actor-drag-preview__card').screenshot({path:`artifacts/tableau-preview-card-${width}-3x.png`});
  assert.equal(await page.locator('.travel-summary').innerText(),summary);assert.equal(await page.locator('.travel-tableau [data-travel-card]').count(),6);
  if(!reduced)await page.evaluate(async()=>(await import('/src/gameTime.ts')).gameTime.setPaused(false));
  if(width===1280){
    await page.setViewportSize({width:1400,height});await page.waitForTimeout(250);
    const follows=await page.evaluate(()=>{const card=document.querySelector('[data-map-actor-card="hero"]').getBoundingClientRect(),ring=document.querySelector('.tableau-drag-preview circle');return Math.abs(Number(ring.getAttribute('cx'))-card.left-card.width/2)<2&&Math.abs(Number(ring.getAttribute('cy'))-card.top-card.height/2)<2;});assert(follows,'destination follows live resized layout');
  }
  await page.getByRole('button',{name:'Pause journey',exact:true}).click();await page.waitForTimeout(100);const held=await preview.innerHTML();await page.waitForTimeout(250);assert.equal(await preview.innerHTML(),held);await page.getByRole('button',{name:'Resume journey',exact:true}).click();
  if(touch)await selected.tap();else await selected.click();
  await preview.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.travel-summary')?.textContent.includes('1/12'));
  assert.deepEqual(errors,[]);reports.push({width,height,touch,reduced,sourceId,errors});console.log(JSON.stringify(reports.at(-1)));await page.close();
 }}finally{await browser.close();fs.writeFileSync('artifacts/tableau-preview-check.json',JSON.stringify(reports,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
