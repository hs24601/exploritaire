const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const [width,height,touch] of [[1280,720,false],[1912,914,true],[390,844,true],[844,390,true]]){
  if(process.env.CHECK_WIDTH&&width!==+process.env.CHECK_WIDTH)continue;
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,deviceScaleFactor:process.env.ZOOM_QA?3:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/tools/fixtures/dense-berry.html');
  const stage=page.locator('[data-layout="dense-bushes"]');await stage.waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('[data-arrival-face="up"]').length===12);
  assert.equal(await stage.locator('.travel-dense-bush').count(),3);
  assert(await stage.locator('.travel-dense-bush > img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),'bush artwork loads');
  const crown=await stage.locator('.travel-dense-bush').first().boundingBox(),rear=await stage.locator('[data-travel-card="dense-1-6"]').boundingBox();
  assert(crown.y+crown.height*.2<rear.y-5,'bush crowns remain visible above the cards');
  assert.equal(await stage.locator('[data-sequence-rule="match"]').count(),3);
  assert.equal(await stage.locator('[data-sequence-rule="skip"]').count(),4);
  assert(await stage.locator('.travel-sequence-mark').evaluateAll(marks=>marks.every(mark=>mark.getBoundingClientRect().width<=mark.closest('.travel-arrival-card').getBoundingClientRect().width)),'rule badges fit their cards');
  assert(await stage.locator('.playing-card:not([data-buried])').evaluateAll(cards=>cards.every(card=>{
    const rank=card.querySelector('.proto-card-center-rank'),mark=card.closest('.travel-arrival-card').querySelector('.travel-sequence-mark');
    if(!rank||!mark)return true;const range=document.createRange();range.selectNodeContents(rank);
    return mark.getBoundingClientRect().bottom<=range.getBoundingClientRect().top+1;
  })),'rule markers do not cover exposed ranks');
  const guide=page.locator('.travel-sequence-guide');assert.match(await guide.innerText(),/step.*match.*skip/);
  const defects=await findLayoutDefects(page,'.travel-tableau',{parts:'.tableau-template__header,.tableau-template__foundations',minFontSize:16});assert.deepEqual(defects,[]);
  assert(await stage.locator('.travel-arrival-card').evaluateAll(cards=>cards.every(card=>{const c=card.getBoundingClientRect(),p=card.parentElement.getBoundingClientRect();return c.left>=p.left-1&&c.right<=p.right+1&&c.top>=p.top-1&&c.bottom<=p.bottom+1;})),'all card faces fit inside the composition');
  const bounds=await stage.boundingBox();const bushes=await stage.locator('.travel-dense-bush').evaluateAll(nodes=>nodes.map(n=>({left:n.offsetLeft,top:n.offsetTop})));
  assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<width*.45+1,'composition fits the tableau panel');
  await page.screenshot({path:`artifacts/dense-berry-${width}.png`});
  if(process.env.ZOOM_QA)await stage.screenshot({path:`artifacts/dense-berry-${width}-3x.png`});
  const press=async locator=>touch?locator.tap():locator.click();
  // The first legal step exposes a same-rank match. Use actual card buttons.
  await press(stage.locator('[data-travel-card="dense-1-0"]'));
  assert.equal(await page.locator('[data-fixture-completed]').getAttribute('data-fixture-completed'),'7');
  assert.equal(await stage.locator('[data-travel-card="dense-1-1"]').isEnabled(),true);
  await press(stage.locator('[data-travel-card="dense-1-1"]'));
  assert.equal(await page.locator('[data-fixture-completed]').getAttribute('data-fixture-completed'),'8');
  assert.equal(await stage.locator('[data-travel-card="dense-1-2"]').isEnabled(),true);
  await press(stage.locator('[data-travel-card="dense-1-2"]'));
  assert.deepEqual(await stage.locator('.travel-dense-bush').evaluateAll(nodes=>nodes.map(n=>({left:n.offsetLeft,top:n.offsetTop}))),bushes,'bush positions stay stable as cards leave');
  const pause=page.getByRole('button',{name:'Pause journey',exact:true});await press(pause);assert(await page.getByRole('button',{name:'Best Move',exact:true}).isDisabled());await press(page.getByRole('button',{name:'Resume journey',exact:true}));
  await press(page.getByRole('button',{name:'Auto-S Tile',exact:true}));await page.waitForFunction(()=>document.querySelector('[data-fixture-completed]')?.getAttribute('data-fixture-completed')==='18');
  assert.equal(await page.locator('[data-fixture-mana]').getAttribute('data-fixture-mana'),'1','traversal does not consume forage berries');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({width,height,touch,defects,errors}));await page.close();
 }
 const live=await browser.newPage();const response=await live.goto('http://127.0.0.1:5178/proto.html');assert.equal(response.status(),200);await live.locator('.proto-map').waitFor();console.log('Proto ready: http://127.0.0.1:5178/proto.html');await live.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
