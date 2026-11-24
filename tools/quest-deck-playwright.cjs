const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH}),reports=[];
 try{for(const [width,height,touch,reduced]of [[1280,720,false,false],[1912,914,true,false],[390,844,true,true],[844,390,true,true]]){
  if(process.env.CHECK_WIDTH&&width!==Number(process.env.CHECK_WIDTH))continue;
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference',deviceScaleFactor:process.env.ZOOM_QA?3:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5178/proto.html');
  const opening=page.locator('[data-callout-id="day01.opening"]'),next=opening.locator('.proto-callout-next'),deck=page.locator('.day-objective__tracker .quest-subtask-deck');await opening.waitFor();
  assert.equal(await deck.locator('[data-subtask-card]').count(),1);assert.equal(await deck.isVisible(),false);
  const press=async()=>touch?next.tap():next.click();if(await opening.getAttribute('data-revealing')==='true')await press();await press();
  if(!reduced){await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='dealing');assert.equal(await page.locator('.opening-card-deal__flight [data-dealt-subtask]').count(),1);}
  await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='complete');
  assert.equal(await deck.getAttribute('data-step-id'),'leave-den');assert.equal(await deck.locator('.quest-step__words').innerText(),'Leave the den.');
  await page.screenshot({path:`artifacts/quest-deck-initial-${width}.png`});
  if(await opening.getAttribute('data-revealing')==='true')await press();await press();await opening.waitFor({state:'hidden'});await page.waitForTimeout(reduced?150:2000);
  if(!reduced)await page.evaluate(async()=>{const {gameTime}=await import('/src/gameTime.ts');const watcher=new MutationObserver(()=>{if(document.querySelector('.day-objective__tracker .quest-subtask-deck')?.getAttribute('data-phase')==='burn'){gameTime.setTimeout(()=>gameTime.setPaused(true),400);watcher.disconnect();}});watcher.observe(document.querySelector('.day-objective__tracker'),{subtree:true,attributes:true,attributeFilter:['data-phase']});});
  const a=await page.locator('[data-map-actor-card="hero"]').boundingBox(),b=await page.locator('.day-objective__pin circle').boundingBox();assert(a&&b);const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
  const checkDragGhost=async()=>{
    const ghost=page.locator('[data-actor-drag-ghost]');await ghost.waitFor({state:'visible'});
    assert.equal(await ghost.locator('.actor-map-card .trading-card').count(),1,'drag shows the real holocard face');
    assert.equal(await ghost.locator('[data-map-actor-card]').count(),0,'ghost cannot become a second drag source');
    assert.equal(await page.locator('[data-map-actor-card="hero"]').count(),1);
    assert.equal(await ghost.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    assert.equal(await ghost.evaluate(e=>getComputedStyle(e).opacity),'0.75');
    await page.screenshot({path:`artifacts/actor-card-drag-${width}.png`});
    if(process.env.ZOOM_QA)await ghost.screenshot({path:`artifacts/actor-card-drag-${width}-3x.png`});
  };
  if(touch){const client=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...from}]});for(let i=1;i<=10;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});await checkDragGhost();await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await checkDragGhost();await page.mouse.up();}
  await page.locator('[data-layout="den-mouth"]').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-actor-drag-ghost]').count(),0,'drop removes the ghost');
  if(!reduced){
    await page.waitForFunction(async()=>(await import('/src/gameTime.ts')).gameTime.isPaused());
    assert.equal(await deck.getAttribute('data-step-id'),'leave-den');assert.equal(await deck.locator('.quest-step__words').innerText(),'Leave the den.');
    const held=await deck.getAttribute('style');await page.waitForTimeout(250);assert.equal(await deck.getAttribute('style'),held);
    await page.screenshot({path:`artifacts/quest-deck-burning-${width}.png`});if(process.env.ZOOM_QA)await deck.screenshot({path:`artifacts/quest-deck-burning-${width}-3x.png`});
    await page.evaluate(async()=>(await import('/src/gameTime.ts')).gameTime.setPaused(false));
    await page.waitForFunction(()=>document.querySelector('.day-objective__tracker .quest-subtask-deck')?.getAttribute('data-phase')==='flip');
  }
  const waitStep=async id=>page.waitForFunction(id=>{const deck=document.querySelector('.day-objective__tracker .quest-subtask-deck');return deck?.getAttribute('data-step-id')===id&&deck.getAttribute('data-phase')==='idle';},id);
  await page.locator('.travel-tableau .den-quest-discovery').click();
  await page.waitForFunction(()=>document.querySelectorAll('.travel-den-exit [data-arrival-face="up"]').length===6);
  await waitStep('navigate-den');assert.equal(await deck.locator('[data-subtask-card]').count(),1);assert.equal(await deck.locator('[data-subtask-card="leave-den"]').count(),0);
  assert.match(await deck.locator('.quest-step__words').innerText(),/one rank higher or lower/);assert.equal(await page.locator('.travel-tableau [data-travel-card]').count(),6);
  await page.locator('.tableau-drag-preview').waitFor({state:'visible'});
  const layout=await findLayoutDefects(page,'.proto-map',{parts:'.actor-map-card,.day-objective__tracker',minFontSize:16});assert.deepEqual(layout.filter(issue=>!/^H2 text "Hero" is /.test(issue)),[]);
  assert(await page.locator('.day-objective__tracker').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
  await page.screenshot({path:`artifacts/quest-deck-next-${width}.png`});if(process.env.ZOOM_QA)await deck.screenshot({path:`artifacts/quest-deck-next-${width}-3x.png`});
  const card=deck.locator('.quest-card');if(touch)await card.tap();else await card.click();await page.getByRole('dialog').waitFor();assert.match(await page.locator('.card-jumbo__face .quest-card').getAttribute('aria-label'),/Find a way out/);await page.getByRole('button',{name:'Close jumbo card',exact:true}).click();
  // Real solver actions fulfill the next requirement; no test-only state writes.
  await page.evaluate(async()=>{
    const {gameTime}=await import('/src/gameTime.ts');window.arrivalFrames=[];
    const watcher=new MutationObserver(()=>{
      const cards=[...document.querySelectorAll('.travel-free-layout [data-arrival-face]')];
      if(!cards.length)return;
      window.arrivalFrames.push(cards.map(c=>c.dataset.arrivalFace));
      if(!window.heldArrival && cards.every(c=>c.dataset.arrivalFace==='down')){window.heldArrival=true;gameTime.setPaused(true);}
    });watcher.observe(document.querySelector('.proto-variant')??document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-arrival-face']});
  });
  await page.getByRole('button',{name:'Auto-S Tile',exact:true}).click();
  await page.waitForFunction(()=>window.heldArrival===true);
  assert.equal(await page.locator('.travel-free-layout [data-arrival-face="down"]').count(),6);
  assert.equal(await page.locator('.travel-free-layout [data-travel-card]:visible').count(),0);
  assert(await page.getByRole('button',{name:'Auto-S Tile',exact:true}).isDisabled());
  const frozen=await page.locator('.travel-free-layout').innerHTML();await page.waitForTimeout(200);assert.equal(await page.locator('.travel-free-layout').innerHTML(),frozen);
  await page.screenshot({path:`artifacts/tableau-arrival-down-${width}.png`});
  await page.evaluate(async()=>(await import('/src/gameTime.ts')).gameTime.setPaused(false));
  await page.locator('.proto-tableau-field [data-found-quest="first-berry"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.travel-free-layout [data-arrival-face="up"]').length===6);
  assert(await page.evaluate(()=>window.arrivalFrames.some(frame=>new Set(frame).size>1)),'arrival flips are staggered');
  await page.screenshot({path:`artifacts/tableau-arrival-up-${width}.png`});
  await waitStep('first-berry');
  assert.equal(await deck.locator('[data-subtask-card]').count(),1);assert.match(await page.locator('.travel-summary').innerText(),/6\/12/);
  if(width===1280){await page.locator('.proto-day-panel__toggle').click();await page.getByRole('button',{name:'Restart scenario',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.proto-map')?.getAttribute('data-opening-cards')==='pending');assert.equal(await deck.locator('[data-subtask-card]').count(),1);assert.equal(await deck.getAttribute('data-step-id'),'leave-den');}
  assert.deepEqual(errors,[]);reports.push({width,height,touch,reduced,layout,errors});console.log(JSON.stringify(reports.at(-1)));await page.close();
 }
  const fixture=await browser.newPage({reducedMotion:'reduce'});await fixture.goto('http://127.0.0.1:5178/artifacts/quest-deck-fixture.html');await fixture.locator('.quest-subtask-deck').waitFor();
  await fixture.evaluate(()=>{window.questQueue=['a'];const deck=document.querySelector('.quest-subtask-deck');new MutationObserver(()=>{const id=deck.dataset.stepId;if(window.questQueue.at(-1)!==id)window.questQueue.push(id);}).observe(deck,{attributes:true,attributeFilter:['data-step-id']});});
  await fixture.getByRole('button',{name:'Complete all',exact:true}).click();await fixture.waitForFunction(()=>document.querySelector('.quest-subtask-deck')?.getAttribute('data-step-id')==='complete');
  assert.deepEqual(await fixture.evaluate(()=>window.questQueue),['a','b','c','complete']);assert.equal(await fixture.locator('[data-subtask-card]').count(),0);
  await fixture.getByRole('button',{name:'Reset',exact:true}).click();await fixture.waitForFunction(()=>document.querySelector('.quest-subtask-deck')?.getAttribute('data-step-id')==='a');await fixture.close();console.log('PASS queued rapid completion, final destruction, and reset');
 }finally{await browser.close();fs.writeFileSync('artifacts/quest-deck-check.json',JSON.stringify(reports,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
