// Quest reward holds finish in about 2s with a mouse that drifts a little and
// with a touch long-press (which fires contextmenu but must not open dev UI).
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const landQuestCard=async p=>{await p.goto('http://localhost:5179/proto.html');const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();const card=p.locator('[data-table-quest="0"]');await card.waitFor({timeout:20000});await p.waitForTimeout(1200);const r=await card.boundingBox();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};};
const redeemedWithin=async(p,limit)=>{const start=Date.now();while(Date.now()-start<limit){if(await p.locator('.quest-field').getAttribute('data-redeemed')==='1')return Date.now()-start;await p.waitForTimeout(40);}return null;};
(async()=>{const b=await chromium.launch({headless:true});try{
  let ctx=await b.newContext({viewport:{width:1912,height:914}});let p=await ctx.newPage();let c=await landQuestCard(p);
  await p.mouse.move(c.x,c.y);await p.mouse.down();for(const [dx,dy] of [[4,2],[8,-3],[10,4],[6,6]]){await p.waitForTimeout(150);await p.mouse.move(c.x+dx,c.y+dy);}
  const mouse=await redeemedWithin(p,3000);await p.mouse.up();assert.ok(mouse!==null,'a mouse hold with 10px of drift still redeems within ~2s');await ctx.close();
  ctx=await b.newContext({viewport:{width:1912,height:914},hasTouch:true});p=await ctx.newPage();c=await landQuestCard(p);const cdp=await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await p.waitForTimeout(600);
  await p.evaluate(({x,y})=>document.elementFromPoint(x,y).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y})),c);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+14,y:c.y+8}]});
  const touch=await redeemedWithin(p,2500);assert.equal(await p.locator('.dev-context-menu').count(),0,'a touch long-press never opens the dev menu');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(touch!==null,'a touch hold with drift redeems within ~2s');
  console.log(`Quest holds: mouse with drift ${mouse+0}ms after the wobble, touch long-press ${touch+600}ms, no dev menu on touch.`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
