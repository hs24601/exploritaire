const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const out='artifacts/tactical-combat';fs.mkdirSync(out,{recursive:true});
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
async function state(p){return p.evaluate(()=>{const root=document.querySelector('.battle-field');let fiber=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.foes)hook=hook.next;return hook.memoizedState;});}
async function seed(p){await p.evaluate(()=>{const root=document.querySelector('.battle-field');let fiber=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.foes)hook=hook.next;hook.queue.dispatch(b=>({...b,started:true,ambush:undefined,foes:b.foes.map(f=>({...f,timer:.1,effects:[],stagger:0})),events:[]}));});}
async function hold(p,touch){const from=center(await p.locator('.ability-card-popover .ability-card').boundingBox());const cdp=touch?await p.context().newCDPSession(p):null;
 if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});else{await p.mouse.move(from.x,from.y);await p.mouse.down();}
 await p.locator('.battle-field[data-tactical-paused="true"]').waitFor();
 return {async move(to){if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});else await p.mouse.move(to.x,to.y,{steps:6});},async end(){if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();},async cancel(){if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.keyboard.press('Escape');if(!touch)await p.mouse.up();}};}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,touch,reduced] of [[1280,720,false,false],[1912,914,false,false],[1280,720,true,true],[390,844,true,true]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.inputLog=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','click','blur'])document.addEventListener(type,e=>window.inputLog.push([type,e.pointerType,e.target.className]),true);});
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');await p.getByRole('button',{name:'Bite',exact:true}).waitFor();
  assert.equal(await p.locator('.battle-move:disabled').count(),0,'all abilities inspectable at zero AP');
  const arm=async(name='Bite')=>{const b=p.getByRole('button',{name,exact:true});if(touch)await b.tap();else await b.click();await p.locator('.ability-card-popover .ability-card').waitFor();};
  await arm();assert.match(await p.locator('.ability-card-popover').textContent(),/Not enough AP/);
  assert.equal(await p.locator('.battle-foe[data-targetable="true"]').count(),0);
  const card=p.locator('.ability-card-popover .ability-card');if(touch)await card.tap();else await card.click();
  try{await p.locator('.details-card-viewer--jumbo').waitFor({timeout:5000});}catch(e){await p.screenshot({path:out+'/touch-inspection-debug.png'});console.log(await p.evaluate(()=>window.inputLog.slice(-20)));console.log(await p.locator('.battle-field').getAttribute('data-aiming'),await p.locator('.battle-field').getAttribute('data-tactical-paused'));throw e;}assert.match(await p.locator('.details-card-viewer--jumbo').textContent(),/Bite/);
  assert.equal(await p.locator('.battle-field').getAttribute('data-tactical-paused'),null,'click inspection releases hold');
  await p.screenshot({path:out+'/'+width+'-'+touch+'-jumbo.png'});await p.locator('.details-card-jumbo__close').click();
  // Start clocks with no AP: a held, unaffordable card still pauses, but cannot attack.
  await seed(p);await arm();await p.waitForTimeout(220);let d=await hold(p,touch);
  const initial=await state(p);await p.waitForTimeout(700);assert.deepEqual(await state(p),initial,'all rules state frozen through the hold');
  const faces=p.locator('.battle-field__rack [data-component="playing-card"]');
  assert.ok(await faces.count()>7,'buried cards included');assert.equal(await faces.locator('.proto-card-center-rank').count(),0);
  assert.ok((await faces.allTextContents()).every(s=>s.trim()===''),'no rank ink remains');
  assert.ok((await faces.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).every(s=>s==='Tableau card · value hidden during tactical pause'));
  assert.ok(await p.getByRole('button',{name:'Deal a row',exact:true}).isDisabled());assert.ok(await p.getByRole('button',{name:'Restart',exact:true}).isDisabled());
  if(width>900){const arena=p.locator('.combat-demo__arena');await p.waitForFunction(()=>document.querySelector('.combat-demo__arena').dataset.combatPaused==='true');const t=await arena.getAttribute('data-combatTime');await p.waitForTimeout(250);assert.equal(await arena.getAttribute('data-combatTime'),t,'scene action clock freezes too');}
  await p.screenshot({path:out+'/'+width+'-'+touch+'-held.png'});
  await d.cancel();await p.waitForFunction(()=>!document.querySelector('.battle-field').hasAttribute('data-tactical-paused'));
  assert.ok(await p.locator('.battle-field__rack .proto-card-center-rank').count()>0,'values restored');await p.waitForTimeout(220);
  const resumed=await state(p);assert.ok(resumed.foes[0].timer>initial.foes[0].timer,'timers resume');assert.ok(resumed.foes[0].timer-initial.foes[0].timer<.1,'no held-time catchup');
  // An unaffordable drag never spends AP or damages a target.
  await arm();d=await hold(p,touch);await d.move(center(await p.locator('[data-battle-target="dark-slime"]').boundingBox()));const before=await state(p);await d.end();
  assert.equal((await state(p)).foes[0].hp,before.foes[0].hp);await p.keyboard.press('Escape');
  // Sufficient AP still supports legal tableau drops while values stay concealed.
  await p.getByRole('checkbox',{name:'maxAP',exact:true}).check();await arm('Nip');d=await hold(p,touch);
  await d.move(center(await p.locator('[data-battle-target="dark-slime"]').boundingBox()));await p.waitForFunction(()=>document.querySelector('[data-battle-target="dark-slime"]').dataset.preview==='focus');
  const hp=(await state(p)).foes[0].hp;await d.end();assert.equal((await state(p)).foes[0].hp,hp-1);
  assert.equal(await p.locator('.battle-field').getAttribute('data-tactical-paused'),null);
  // A separate manual pause survives a tactical hold and release.
  await p.getByRole('button',{name:'Pause',exact:true}).click();await arm('Nip');d=await hold(p,touch);await d.cancel();
  assert.ok(await p.getByRole('button',{name:'Resume',exact:true}).isVisible());const manuallyPaused=await state(p);await p.waitForTimeout(250);assert.deepEqual(await state(p),manuallyPaused);
  await p.getByRole('button',{name:'Resume',exact:true}).click();
  // Keyboard activation inspects the same card.
  await p.getByRole('button',{name:'Bite',exact:true}).focus();await p.keyboard.press('Enter');await p.locator('.ability-card-popover .ability-card').focus();await p.keyboard.press('Enter');await p.locator('.details-card-viewer--jumbo').waitFor();await p.keyboard.press('Escape');
  assert.deepEqual(errors,[]);console.log(width,touch?'touch':'mouse','tactical pause and inspection passed');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
