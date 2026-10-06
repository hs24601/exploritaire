// Quest reward holds finish in about 1s with a mouse that drifts a little and
// with a touch long-press (which fires contextmenu but must not open dev UI),
// including in the tilted camera on a slow (CPU-throttled) device.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const landQuestCard=async(p,loaded)=>{if(!loaded)await p.goto('http://localhost:5179/proto.html');const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();const card=p.locator('[data-table-quest="0"]');await card.waitFor({timeout:20000});await p.waitForTimeout(1200);const r=await card.boundingBox();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};};
const redeemedWithin=async(p,limit)=>{const start=Date.now();while(Date.now()-start<limit){if(await p.locator('.quest-field').getAttribute('data-redeemed')==='1')return Date.now()-start;await p.waitForTimeout(40);}return null;};
(async()=>{const b=await chromium.launch({headless:true});try{
  let ctx=await b.newContext({viewport:{width:1912,height:914}});let p=await ctx.newPage();let c=await landQuestCard(p);
  await p.mouse.move(c.x,c.y);await p.mouse.down();for(const [dx,dy] of [[4,2],[8,-3],[10,4],[6,6]]){await p.waitForTimeout(150);await p.mouse.move(c.x+dx,c.y+dy);}
  const mouse=await redeemedWithin(p,2000);await p.mouse.up();assert.ok(mouse!==null,'a mouse hold with 10px of drift still redeems within ~1s');await ctx.close();
  ctx=await b.newContext({viewport:{width:1912,height:914},hasTouch:true});p=await ctx.newPage();c=await landQuestCard(p);const cdp=await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await p.waitForTimeout(600);
  await p.evaluate(({x,y})=>document.elementFromPoint(x,y).dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y})),c);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+14,y:c.y+8}]});
  const touch=await redeemedWithin(p,1600);assert.equal(await p.locator('.dev-context-menu').count(),0,'a touch long-press never opens the dev menu');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(touch!==null,'a touch hold with drift redeems within ~1s');
  await ctx.close();ctx=await b.newContext({viewport:{width:1912,height:914},hasTouch:true});p=await ctx.newPage();
  await p.goto('http://localhost:5179/proto.html');await p.getByRole('button',{name:'Tilt camera view'}).click();c=await landQuestCard(p,true);
  const slow=await ctx.newCDPSession(p);await slow.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.evaluate(()=>{window.__holdStart=0;document.addEventListener('pointerdown',()=>{window.__holdStart||=performance.now();},true);new MutationObserver(()=>{if(!window.__holdDone&&document.querySelector('.quest-field')?.dataset.redeemed==='1')window.__holdDone=performance.now();}).observe(document.body,{subtree:true,attributes:true});});
  await slow.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[c]});await redeemedWithin(p,6000);
  await slow.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const tilted=await p.evaluate(()=>window.__holdDone&&window.__holdStart?Math.round(window.__holdDone-window.__holdStart):null);
  assert.ok(tilted!==null&&tilted<1800,`a tilted touch hold on a slow device redeems in about 1s (${tilted}ms)`);
  console.log(`Quest holds: mouse with drift ${mouse+0}ms after the wobble, touch long-press ${touch+600}ms, no dev menu on touch, tilted on a 4x slower CPU ${tilted}ms.`);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
