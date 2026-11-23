const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true});const timer=setTimeout(()=>b.close(),130000);let p;
 try{
  p=await b.newPage({viewport:{width:1432,height:734}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178/portals.html?stellarcombat',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.__stellarCombat?.hint.kind==='foundation',null,{timeout:45000});
  await p.getByRole('button',{name:/^Quality:/}).click();
  assert.equal(await p.locator('.stellar-foe,.stellar-hp,.stellar-hero-bar,.world-navi-panel').count(),0);
  assert.equal(await p.locator('.card[data-stellar-hint=foundation]').count(),1);
  const hint=await p.evaluate(()=>__stellarCombat.hint);assert(hint.length>=2);
  const recommendation=p.locator(`.card[data-id="${hint.id}"]`);
  assert.equal(await recommendation.locator('.front').evaluate(el=>getComputedStyle(el,'::after').animationName),'stellar-guide-shimmer');
  await p.screenshot({path:'output/stellar-best-foundation.png'});
  await recommendation.click();
  if(await p.locator('.stellar').getAttribute('data-phase')==='pick')await recommendation.click();
  await p.waitForFunction(()=>__stellarCombat.foundation&&__stellarCombat.hint.kind==='card');
  await p.waitForTimeout(750);
  assert.equal(await p.locator('.card[data-stellar-hint=next]').count(),1);
  assert.equal(await p.locator('.card[data-foundation=true]').count(),1);
  let current=await p.locator('.card[data-foundation=true] .front').evaluate(el=>({opacity:getComputedStyle(el).opacity,background:getComputedStyle(el).backgroundImage}));
  assert.equal(current.opacity,'1');assert(current.background.includes('rgb(30, 44, 92), rgb(8, 13, 34)'));
  await p.keyboard.press('ControlLeft');await p.waitForFunction(()=>__stellarCombat.state.chain===1&&__stellarCombat.auto==='idle');await p.waitForTimeout(700);assert.equal(await p.evaluate(()=>__stellarCombat.state.chain),1);
  await p.keyboard.down('ControlRight');await p.waitForTimeout(1100);await p.keyboard.up('ControlRight');const count=await p.evaluate(()=>__stellarCombat.state.chain);assert(count>1);await p.waitForTimeout(800);assert.equal(await p.evaluate(()=>__stellarCombat.state.chain),count);
  let sky=await p.evaluate(()=>__stellarCombat.sky);assert.equal(sky.combat,false);assert(!sky.effects.some(k=>['beam','number','tendril'].includes(k)));
  assert.equal(sky.stars,count+1);
  await p.screenshot({path:'output/stellar-sequence-shimmer.png'});
  const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1432,height:734,deviceScaleFactor:3,mobile:false});await p.screenshot({path:'output/stellar-sequence-3x.png',clip:{x:380,y:170,width:720,height:525}});await cdp.send('Emulation.clearDeviceMetricsOverride');
  for(let i=0;i<3;i++){
   const id=await p.locator('.card.down:not(.gone)').evaluateAll(nodes=>nodes.sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex))[0]?.dataset.id);assert(id);
   await p.locator(`.card[data-id="${id}"]`).focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);
  }
  await p.waitForTimeout(1000);
  const state=await p.evaluate(()=>__stellarCombat.state);assert.equal(state.draws,3);assert.equal(state.result,null);assert(!('heroHp'in state)&&!('foeHp'in state));sky=await p.evaluate(()=>__stellarCombat.sky);assert(sky.constellations>0);assert(!sky.effects.some(k=>['beam','number','tendril'].includes(k)));
  await p.emulateMedia({reducedMotion:'reduce'});
  const guided=p.locator('.card[data-stellar-hint] .front');if(await guided.count())assert.equal(await guided.evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await p.getByRole('button',{name:'New night',exact:true}).first().click();await p.waitForFunction(()=>__stellarCombat.hint.kind==='foundation');assert.equal(await p.evaluate(()=>__stellarCombat.auto),'idle');assert.equal(await p.evaluate(()=>__stellarCombat.state.chain),0);
  await p.setViewportSize({width:390,height:720});await p.waitForTimeout(250);
  assert(await p.locator('.stellar-controls').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  assert.deepEqual(errors,[]);console.log('PASS: strongest foundation/next-card shimmer, opaque foundation stack, no Eclipse/HP/damage FX, Ctrl single-step/hold/release, star chains/constellations, safe stock draws, restart, reduced motion and narrow controls.');
 }catch(e){if(p){console.error('STATE',await p.evaluate(()=>window.__stellarCombat&&({state:__stellarCombat.state,hint:__stellarCombat.hint,auto:__stellarCombat.auto,sky:__stellarCombat.sky})).catch(()=>null));await p.screenshot({path:'output/stellar-exploration-failure.png'}).catch(()=>{});}throw e;}
 finally{clearTimeout(timer);await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
