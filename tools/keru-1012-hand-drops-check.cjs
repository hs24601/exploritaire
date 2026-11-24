const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const touch of [false,true]){
  const page=await browser.newPage({viewport:{width:touch?390:1280,height:844},hasTouch:touch});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=touch?await page.context().newCDPSession(page):null;
  const down=async(x,y)=>touch?cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}):(await page.mouse.move(x,y),page.mouse.down());
  const move=async(x,y)=>touch?cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]}):page.mouse.move(x,y,{steps:5});
  const up=async()=>touch?cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):page.mouse.up();
  const card=k=>page.locator(`.ability-fan [data-skill="familiar-${k}"]`);
  const open=async()=>{await page.locator('[data-battle-actor="hero"]').click();await page.locator('.ability-fan [data-draft-card]').first().waitFor();await page.waitForTimeout(250);};
  const drag=async(k,target)=>{
    if(touch && await card(k).getAttribute('data-hand-row')==='1' && await card(k).getAttribute('data-raised')!=='true'){const box=await card(k).boundingBox();await down(box.x+box.width/2,box.y+15);await up();await page.waitForTimeout(100);}
    const source=await card(k).boundingBox(),dest=await target.boundingBox(),other=k==='banks'?'mochi':'banks';
    const before=await card(other).boundingBox(),scroll=await page.locator('.ability-fan__scroll').evaluate(e=>[e.scrollTop,e.scrollLeft]);
    const x=source.x+source.width/2,y=source.y+source.height/2;
    await down(x,y);await move(x,y-18);
    await page.locator(`[data-drag-draft="familiar-${k}"]`).waitFor();
    const after=await card(other).boundingBox();assert.ok(Math.abs(before.y-after.y)<1&&Math.abs(before.x-after.x)<1,`only selected card moves: ${JSON.stringify({k,before,after,scroll,now:await page.locator('.ability-fan__scroll').evaluate(e=>[e.scrollTop,e.scrollLeft])})}`);
    assert.deepEqual(await page.locator('.ability-fan__scroll').evaluate(e=>[e.scrollTop,e.scrollLeft]),scroll);
    await move(dest.x+dest.width/2,dest.y+dest.height/2);await up();await page.waitForTimeout(450);
  };
  await page.goto('http://localhost:5178/proto.html?combatsbx&scenario=1012');await page.locator('[data-battle-actor="hero"]').waitFor();await open();
  assert.equal(await page.locator('.ability-fan .trading-card__body').count(),0);
  if(touch){await card('riv').tap();if(await card('riv').getAttribute('data-hand-row')==='1'){assert.equal(await card('riv').getAttribute('data-raised'),'true');assert.equal(await page.locator('.card-jumbo').count(),0);await card('riv').tap();}}else await card('riv').click();
  await page.locator('.card-jumbo').waitFor();assert.equal(await page.locator('.card-jumbo .trading-card__body').count(),0);assert.ok(await page.locator('.card-jumbo img[src*="riv-watercolor-v2"]').count());
  await page.screenshot({path:`artifacts/keru-1012-${touch?'touch':'mouse'}-clear-art.png`});await page.keyboard.press('Escape');
  await drag('cir',page.locator('[data-battle-target="dusk-dragon"]'));
  await card('cir').waitFor({state:'detached'});assert.equal(await page.locator('.battle-field [aria-label="Dusk Dragon HP"]').getAttribute('aria-valuenow'),'94');
  await drag('banks',page.locator('[data-battle-actor="hero"]'));assert.equal(await card('banks').count(),1,'illegal ally target retains Banks');
  await drag('riv',page.locator('[data-battle-actor="hero"]'));await card('riv').waitFor({state:'detached'});assert.equal(await page.locator('[data-battle-actor="hero"] .battle-foundation__ap').getAttribute('aria-valuenow'),'2');
  await drag('dem',page.locator('[data-battle-target^="familiar-square:hero:"]').first());
  await page.locator('.keru-square[data-keru-square="dem"]').waitFor();await page.locator('.ability-fan-overlay').waitFor({state:'detached'});await open();assert.equal(await card('dem').count(),0);
  assert.equal(await page.locator('[data-battle-actor="hero"] .battle-foundation__ap').getAttribute('aria-valuenow'),'1');
  await page.keyboard.press('Escape');await page.locator('.ability-fan-overlay').waitFor({state:'detached'});await page.waitForTimeout(300);
  const badge=page.locator('.keru-square[data-keru-square="dem"]');await badge.scrollIntoViewIfNeeded();const bb=await badge.boundingBox();
  assert.ok(bb.x>=0 && bb.x+bb.width<=page.viewportSize().width,'familiar square stays in viewport');
  await down(bb.x+bb.width/2,bb.y+bb.height/2);await page.locator('.card-jumbo').waitFor();await up();assert.equal(await badge.count(),1);assert.equal(await page.locator('.card-jumbo').count(),1);
  assert.deepEqual(errors,[]);console.log(`PASS ${touch?'touch':'mouse'}: art clear; only dragged card moves; actor casts discard; invalid target retains; empty square familiarizes; buff hold inspects.`);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
