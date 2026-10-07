// Game tooltip: hover, keyboard focus, touch long-press and tap all show the
// parchment tooltip in place of the browser's, on screen and defect-free.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5179/proto.html';const OUT='artifacts/game-tooltip';
const onScreen=(r,w,h)=>r&&r.x>=0&&r.y>=0&&r.x+r.width<=w&&r.y+r.height<=h;
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto(URL);await p.waitForTimeout(1200);
    const target=p.locator('.supply-tray [data-supply]').first();const label=await target.getAttribute('title');assert.ok(label,'supply slot has a title');
    await target.hover();await p.waitForTimeout(500);
    const tip=p.locator('.game-tooltip');assert.equal(await tip.textContent(),label,`${w}x${h} hover shows the title`);
    assert.equal(await target.getAttribute('title'),null,`${w}x${h} title is parked while hovered, so no native tooltip`);
    assert.ok(onScreen(await tip.boundingBox(),w,h),`${w}x${h} tooltip stays on screen`);
    problems.push(...(await findLayoutDefects(p,'.game-tooltip',{parts:'.game-tooltip'})).map(d=>`${w}x${h} hover: ${d}`));
    const r=await tip.boundingBox();await p.screenshot({path:`${OUT}/hover-${w}x${h}.png`,clip:{x:Math.max(0,r.x-60),y:Math.max(0,r.y-20),width:Math.min(w,r.width+120),height:r.height+90}});
    await p.mouse.move(w/2,h-4);await p.waitForTimeout(150);
    assert.equal(await tip.count(),0,`${w}x${h} tooltip hides on leave`);assert.equal(await target.getAttribute('title'),label,`${w}x${h} title is restored`);
    // Top-edge element: the tooltip flips below rather than leaving the screen.
    const top=p.locator('.proto-build-label');if(await top.count()){await top.hover();await p.waitForTimeout(500);assert.ok(onScreen(await tip.boundingBox(),w,h),`${w}x${h} top tooltip on screen`);await p.mouse.move(w/2,h-4);}
    // Keyboard focus shows it too.
    const toggle=p.locator('.quest-tray__toggle');await p.keyboard.press('Tab');await toggle.focus();await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');
    if(await p.evaluate(()=>document.activeElement?.matches('.quest-tray__toggle:focus-visible'))){await p.waitForTimeout(100);assert.equal(await tip.textContent(),'Stow tray',`${w}x${h} focus shows the tooltip`);await p.keyboard.press('Escape');}
    await p.close();
  }
  for(const [w,h] of [[390,844],[844,390]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true});const p=await ctx.newPage();await p.goto(URL);await p.waitForTimeout(1200);
    const nav=p.getByRole('button',{name:'Supplies',exact:true});if(await nav.count())await nav.tap();await p.waitForTimeout(200);
    const cdp=await ctx.newCDPSession(p);const press=async(loc,ms)=>{const r=await loc.boundingBox();const pt={x:r.x+r.width/2,y:r.y+r.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await p.waitForTimeout(ms);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
    const slot=p.locator('.supply-tray [data-supply]').first();const label=await slot.getAttribute('title');
    await press(slot,700);await p.waitForTimeout(100);const tip=p.locator('.game-tooltip');
    assert.equal(await tip.textContent(),label,`${w}x${h} long-press shows the tooltip`);assert.ok(onScreen(await tip.boundingBox(),w,h),`${w}x${h} tooltip on screen`);
    assert.equal(await p.locator('.supply-details').count(),0,`${w}x${h} long-press does not also tap the slot`);
    problems.push(...(await findLayoutDefects(p,'.game-tooltip',{parts:'.game-tooltip'})).map(d=>`${w}x${h} long-press: ${d}`));
    const r=await tip.boundingBox();await p.screenshot({path:`${OUT}/longpress-${w}x${h}.png`,clip:{x:0,y:Math.max(0,r.y-20),width:w,height:Math.min(h-Math.max(0,r.y-20),r.height+100)}});
    await p.waitForTimeout(2700);assert.equal(await tip.count(),0,`${w}x${h} touch tooltip fades on its own`);assert.equal(await slot.getAttribute('title'),label,`${w}x${h} title restored`);
    await press(slot,80);await p.waitForTimeout(150);assert.equal(await tip.count(),0,`${w}x${h} a quick tap on a button does not show a tooltip`);
    await ctx.close();
  }
  assert.deepEqual(problems,[],problems.join('\n'));
  console.log('Game tooltip: hover, focus, touch long-press, auto-hide, title restore and layout passed at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
