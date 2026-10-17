const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const fixture=`<!doctype html><html><head><link rel="stylesheet" href="/src/index.css"><style>#root{height:100vh;width:100vw;container-type:size;--classic-card-w:90px;--classic-radius:12px}#root>.proto-pond,#root>.proto-skirmish{height:100vh;width:100vw}</style></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
await import('/tools/card-jumbo-fixture.tsx');
</script></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const width of [1280,1912])for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/card-jumbo-fixture.html',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto('http://localhost:5178/card-jumbo-fixture.html');try{await page.waitForFunction(()=>window.fixtureReady,{},{timeout:10000});}catch(e){throw new Error(JSON.stringify(errors)+e.message);}await page.locator('#quest .quest-card').waitFor();
  const press=async el=>touch?el.tap():el.click(),modal=page.locator('.card-jumbo');
  await press(page.locator('#quest .quest-card'));await modal.waitFor();assert.match(await modal.innerText(),/then carry them home for supper/);
  assert.deepEqual(await findLayoutDefects(page,'.card-jumbo .quest-card',{parts:'.quest-card__title,.quest-artwork,.quest-card__text,.quest-card__status,.quest-card__reward'}),[]);
  await modal.screenshot({path:`artifacts/cards-jumbo-${width}-${touch?'touch':'mouse'}-quest-3x.png`});await page.keyboard.press('Escape');
  assert.equal(await page.locator('#quest .quest-card').evaluate(el=>el===document.activeElement),true);
  await press(page.locator('#back button'));await modal.waitFor();assert.equal(await modal.locator('.quest-card__text').count(),0);assert.equal(await modal.locator('.card-jumbo__action').count(),0);await page.keyboard.press('Escape');
  await press(page.locator('#blocked button'));await modal.waitFor();assert.equal(await modal.locator('.card-jumbo__action').count(),0);await page.keyboard.press('Escape');
  await press(page.locator('#reward .quest-card'));await modal.waitFor();assert.equal(await page.evaluate(()=>window.redeems),0,'Inspection cannot redeem');
  const box=await modal.locator('.quest-card').boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
  const cdp=touch?await context.newCDPSession(page):null;
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});else{await page.mouse.move(point.x,point.y);await page.mouse.down();}
  await page.waitForTimeout(1200);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();await cdp?.detach();
  assert.equal(await page.evaluate(()=>window.redeems),1);assert.equal(await modal.count(),0);
  await page.evaluate(()=>{document.getElementById('root').style.cssText='height:100vh;width:100vw;display:flex;flex-direction:column;--fish-card-w:100px';window.renderScenario('pond');});
  const fish=page.locator('[data-pond-fish]').first();await fish.waitFor();await press(fish);await modal.waitFor();
  assert.equal(await modal.locator('.proto-pond__rank').count(),0,'Hidden fish rank remains hidden');
  assert.deepEqual(await findLayoutDefects(page,'.card-jumbo .proto-pond__fish',{parts:'.proto-pond__ripple,.proto-pond__band'}),[]);
  await modal.screenshot({path:`artifacts/cards-jumbo-${width}-${touch?'touch':'mouse'}-fish-back-3x.png`});await page.keyboard.press('Escape');
  await press(page.locator('.proto-pond__hand .playing-card').first());await modal.waitFor();assert.equal(await page.evaluate(()=>window.casts),0);
  await press(modal.getByRole('button',{name:'Cast bait',exact:true}));assert.equal(await page.evaluate(()=>window.casts),1);
  await page.evaluate(()=>window.renderScenario('combat'));await page.locator('.proto-skirmish__card').first().waitFor();
  const eligible=page.locator('.proto-skirmish__card[data-top="true"] .playing-card:not([data-gameplay-disabled="true"])');
  for(let n=0;n<10&&!await eligible.count();n++)await press(page.locator('.proto-skirmish__stock'));
  const count=await page.locator('.proto-skirmish__card').count();await press(eligible.first());
  assert.equal(await modal.count(),0,'Combat tableau tap bypasses jumbo');
  assert.equal(await page.locator('.proto-skirmish__card').count(),count-1);
  await page.evaluate(()=>window.renderScenario('reel'));await page.locator('.proto-fight__reel').first().waitFor();
  await press(page.locator('.proto-fight__reel .playing-card').first());await modal.waitFor();
  assert.ok(await modal.getByRole('button',{name:'Play card',exact:true}).count());await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);console.log('PASS quest full copy, focus, hidden back, disabled card, hold exactly once',width,touch);await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
