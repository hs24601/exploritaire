// Pond fishing (Go Fish for one): the Hero walks to the pond, casts bait cards by
// dragging them onto fish cards (mouse, touch, or Enter on the keyboard),
// the fourth fish caught is the glowfish, the catch reaches the supplies when the
// Hero leaves, a glowfish on the table glows, and eating it raises max stamina
// and the Hero's light until the day ends.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// Cast like a player: a fish a nibble showed, else bait whose ripple size has the most hidden fish.
const pickBait=page=>page.evaluate(()=>{
  const hand=[...document.querySelectorAll('.proto-pond__bait')].map(el=>({rank:+el.dataset.baitRank,missed:!!el.dataset.missed}));
  const water=[...document.querySelectorAll('.proto-pond__fish')].map(el=>({ripple:el.dataset.ripple,rank:el.dataset.revealed?el.querySelector('.proto-pond__rank').textContent:null}));
  const label=r=>({1:'A',11:'J',12:'Q',13:'K'}[r]??String(r)),size=r=>r<=4?'small':r<=9?'medium':'large';
  const score=c=>c.missed?-1:water.some(f=>f.rank===label(c.rank))?10:water.filter(f=>!f.rank&&f.ripple===size(c.rank)).length/(size(c.rank)==='medium'?5:4);
  return hand.map((c,i)=>({i,s:score(c)})).sort((x,y)=>y.s-x.s)[0].i;
});
const centre=async l=>{const r=await l.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
const castsLeft=page=>page.locator('[data-pond-casts]').getAttribute('data-pond-casts').then(Number);
// Cast like a player: press a bait card and drag it onto a fish card, with the
// mouse or (given a CDP session) a finger. whileOver runs before letting go.
const dragBait=async(page,bait,{fish=0,touch=null,whileOver=null}={})=>{
  const a=await centre(page.locator('.proto-pond__bait').nth(bait)),t=await centre(page.locator('.proto-pond__fish').nth(fish));
  const steps=12,at=i=>({x:a.x+(t.x-a.x)*i/steps,y:a.y+(t.y-a.y)*i/steps});
  if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=steps;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[at(i)]});}
  else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps});}
  const over=whileOver?await whileOver(t):null;
  if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  return over;
};
// While a bait card is carried: which fish card is lit as the drop target, and where the carried card is.
const dragState=(page,fish=0)=>page.evaluate(i=>{const r=document.querySelector('.proto-pond__drag')?.getBoundingClientRect();
  return {targets:[...document.querySelectorAll('.proto-pond__fish')].flatMap((el,n)=>el.dataset.dropTarget?[n]:[]),want:i,
    clone:r?{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width}:null,dimmed:document.querySelectorAll('.proto-pond__bait[data-dragging]').length};},fish);
const seeded=()=>{let s=20261006;Math.random=()=>{s=(s*16807)%2147483647;return s/2147483647;};};
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await (await b.newContext({viewport:{width:1912,height:914}})).newPage();
  await p.addInitScript(seeded);
  await p.goto('http://localhost:5179/proto.html');
  const stamina=async()=>{const m=(await p.locator('body').innerText()).match(/STAMINA (\d+)\/(\d+)/);return {now:+m[1],max:+m[2]};};
  const before=await stamina();
  const drag=async(from,to)=>{const a=await from.boundingBox(),t=await to.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();};
  await drag(p.locator('[data-board-piece="actor"]'),p.locator('[data-biome-id="pond"]'));
  await p.locator('.proto-pond[data-angler]').waitFor({timeout:15000});
  assert.equal((await stamina()).now,before.now,'walking to the pond costs no stamina');
  assert.equal(await p.locator('.proto-pond__fish.playing-card').count(),6,'six fish lie face down in the water as cards');
  assert.equal(await p.locator('.proto-pond__bait').count(),4,'the angler holds four bait cards');
  // The tray beneath the bait counts a fish once it has been reeled in and landed.
  const landed=async()=>{await p.waitForFunction(()=>!document.querySelector('.proto-pond-catch-ghost'),null,{timeout:5000});
    return p.evaluate(()=>{const n=k=>Number(document.querySelector(`.proto-pond__catch [data-pond-catch="${k}"]`)?.dataset.count??0);return {fish:n('fish'),glow:n('glowfish')};});};
  const tray=await p.locator('.proto-pond__catch').boundingBox(),hand=await p.locator('.proto-pond__hand').boundingBox();
  assert.ok(tray.y>=hand.y+hand.height-1,'the catch tray sits beneath the bait cards');
  // A click on bait does not cast; it explains how to.
  await p.locator('.proto-pond__bait').first().locator('button').click();await p.mouse.move(2,2);
  assert.equal(await castsLeft(p),10,'clicking bait does not cast');
  assert.match(await p.locator('.proto-pond__message').innerText(),/drag a bait card onto a fish card/i,'a click on bait explains dragging');
  // Dropping bait anywhere but on a fish card casts nothing.
  {const a=await centre(p.locator('.proto-pond__bait').first()),m=await p.locator('.proto-pond__message').boundingBox();
    await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(m.x+m.width/2,m.y+m.height/2,{steps:10});
    assert.equal((await dragState(p)).targets.length,0,'no fish card lights up away from the water');await p.mouse.up();
    assert.equal(await castsLeft(p),10,'bait dropped off the water does not cast');
    assert.equal(await p.locator('.proto-pond__drag').count(),0,'the carried card is gone after letting go');}
  let casts=0,sawGlowMessage=false,sawReel=false,sawDrag=null;
  while((await p.locator('.proto-pond__bait button:not([disabled])').count())>0){
    const pick=await pickBait(p);
    const was=await landed();
    // Watch every frame of the catch: the line, the fish's path and the tray count.
    await p.evaluate(()=>{const log=window.__reel={frames:[]};const tick=()=>{const g=document.querySelector('.proto-pond-catch-ghost'),l=document.querySelector('.proto-pond-catch-line');
      const c=Number(document.querySelector('.proto-pond__catch [data-pond-catch="fish"]')?.dataset.count??0)+Number(document.querySelector('.proto-pond__catch [data-pond-catch="glowfish"]')?.dataset.count??0);
      if(g||l){const r=g?.getBoundingClientRect();log.frames.push({line:!!l,visible:g?getComputedStyle(g).opacity!=='0':false,x:r?r.x+r.width/2:null,y:r?r.y+r.height/2:null,count:c});}
      else if(log.frames.length){log.done=true;return;}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    const fish=casts%3,state=await dragBait(p,pick,{fish,whileOver:t=>dragState(p,fish).then(d=>({...d,t}))});casts++;
    if(!sawDrag){sawDrag=state;
      assert.deepEqual(state.targets,[fish],'while dragging, the fish card under the bait lights up as the drop target');
      assert.ok(state.clone&&Math.hypot(state.clone.x-state.t.x,state.clone.y-state.t.y)<state.clone.w,'the bait card follows the pointer');
      assert.equal(state.dimmed,1,'the bait card left behind dims while carried');}
    assert.equal(await castsLeft(p),10-casts,'dropping bait on a fish card casts it');
    const now=await landed();const total=now.fish+now.glow;
    const reel=await p.evaluate(()=>window.__reel);
    if(total>was.fish+was.glow&&!sawReel){
      sawReel=true;const f=reel.frames,shown=f.filter(x=>x.visible);
      assert.ok(f.length>10&&f[0].line&&!f[0].visible,'the line flies out before the fish shows');
      assert.ok(shown.length>5,'the hooked fish surfaces on its card and is reeled in');
      const pill=await p.locator('.proto-pond__catch [data-pond-catch]').first().boundingBox(),last=shown[shown.length-1];
      assert.ok(Math.hypot(last.x-(pill.x+pill.width/2),last.y-(pill.y+pill.height/2))<40,`the fish flies into the catch tray (ended ${last.x.toFixed(0)},${last.y.toFixed(0)}; tray pill ${(pill.x+pill.width/2).toFixed(0)},${(pill.y+pill.height/2).toFixed(0)})`);
      assert.ok(f.every(x=>x.count===was.fish+was.glow),'the tray counts the fish only after it lands');
    }
    assert.equal(now.glow,total>=4?1:0,`after ${total} catches there is ${total>=4?'one glowfish':'no glowfish yet'}`);
    if(now.glow>was.glow){const msg=await p.locator('.proto-pond__message').innerText();assert.match(msg,/glowfish/i,'the catch says it is a glowfish');sawGlowMessage=true;}
    if(total>=4)break;
  }
  assert.ok(sawReel,'a catch was reeled in');
  assert.equal(await p.locator('.proto-pond__fish[data-drop-target], .proto-pond__drag').count(),0,'no drag cue lingers after casting');
  assert.ok(sawGlowMessage,`the glowfish was caught within ${casts} casts`);
  const caught=await landed();
  await p.getByRole('button',{name:'Leave Pond'}).click();await p.waitForTimeout(600);
  assert.equal(await p.locator('.proto-pond[data-angler]').count(),0,'the Hero has left the pond');
  assert.equal(Number(await p.locator('[data-supply="fish"]').getAttribute('data-count')),caught.fish,'caught fish reach the supplies');
  assert.equal(Number(await p.locator('[data-supply="glowfish"]').getAttribute('data-count')),1,'the glowfish reaches the supplies');
  // At midnight a glowfish on the table lights its spot; a plain fish does not.
  await p.evaluate(()=>{const i=document.querySelector('[aria-label="Table time of day"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'0');i.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(400);
  for(const id of ['glowfish','fish']){await p.locator(`[data-supply="${id}"]`).click();await p.getByRole('button',{name:'Place 1 on table'}).click();await p.keyboard.press('Escape');await p.waitForTimeout(300);}
  const glowLight=Number(await p.locator('[data-board-piece="resource"][data-resource="glowfish"]').getAttribute('data-light-percent'));
  const fishLight=Number(await p.locator('[data-board-piece="resource"][data-resource="fish"]').getAttribute('data-light-percent'));
  assert.ok(glowLight>=30,`the glowfish lights its spot to at least dim (${glowLight}%)`);
  assert.ok(glowLight>fishLight,`the glowfish is brighter than a plain fish (${glowLight}% vs ${fishLight}%)`);
  const heroLightBefore=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  const fed=await stamina();
  await drag(p.locator('[data-board-piece="resource"][data-resource="glowfish"]'),p.locator('[data-board-piece="actor"]'));
  await p.waitForTimeout(500);
  assert.equal(await p.locator('[data-board-piece="resource"][data-resource="glowfish"]').count(),0,'the glowfish is eaten');
  const glowing=await stamina();
  assert.equal(glowing.max,fed.max+2,'eating the glowfish raises max stamina by 2');
  assert.equal(glowing.now,Math.min(glowing.max,fed.now+3),'and restores 3 stamina');
  const heroLight=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  assert.ok(heroLight>heroLightBefore+15,`the Hero glows brighter (${heroLightBefore}% → ${heroLight}%)`);
  console.log(`Pond: casting is a drag (a click only hints; the fish card under the bait lights up); a line reels each catch from its card into the tray beneath the bait; glowfish on catch 4 after ${casts} casts (${caught.fish} fish); glowfish on the table ${glowLight}% light vs fish ${fishLight}%; eating it took stamina ${fed.now}/${fed.max} → ${glowing.now}/${glowing.max} and the Hero's light ${heroLightBefore}% → ${heroLight}%.`);
  // The pond panel fits at desktop and phone sizes, wide and tall.
  const PARTS='.proto-pond__catch, .proto-pond__catch > li, .proto-pond__header, .proto-pond__header > span, .proto-pond__water, .proto-pond__fish, .proto-pond__band, .proto-pond__rank, .proto-pond__message, .proto-pond__hand, .proto-pond__bait, .proto-pond__bait button, .proto-pond__footer, .proto-pond__legend, .proto-pond__leave';
  const defects=[];
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    // Phone landscape shows only a sliver of the table (the Hero is cut off too), so
    // that size walks to the pond in portrait and then turns the phone.
    const landscape=w>h&&h<500,[sw,sh]=landscape?[h,w]:[w,h];
    // Phones fish by touch, desktops with the mouse, and 1280x720 also by keyboard.
    const phone=sw<900,ctx=await b.newContext({viewport:{width:sw,height:sh},hasTouch:phone,isMobile:phone});
    const q=await ctx.newPage();await q.addInitScript(seeded);await q.goto('http://localhost:5179/proto.html');
    if(sw<900)await q.getByRole('button',{name:'Table',exact:true}).click();
    const pond=await q.locator('[data-biome-id="pond"]').boundingBox(),view=await q.locator('.proto-map-viewport').boundingBox();
    if(!pond||pond.x<view.x||pond.x+pond.width>view.x+view.width||pond.y<view.y||pond.y+pond.height>view.y+view.height)defects.push(`${sw}x${sh}: the pond is not in the starting view`);
    const a=await q.locator('[data-board-piece="actor"]').boundingBox();await q.mouse.move(a.x+a.width/2,a.y+a.height/2);await q.mouse.down();await q.mouse.move(pond.x+pond.width/2,pond.y+pond.height/2,{steps:15});await q.mouse.up();
    await q.locator('.proto-pond[data-angler]').waitFor({timeout:15000});
    if(landscape){await q.setViewportSize({width:w,height:h});await q.waitForTimeout(300);}
    const touch=phone?await ctx.newCDPSession(q):null;
    if(touch){
      // A tap on bait only hints; a touch drag onto a fish card casts.
      const a=await centre(q.locator('.proto-pond__bait').first());
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await q.waitForTimeout(200);
      if(await castsLeft(q)!==10)defects.push(`${w}x${h}: a tap on bait cast it`);
      const d=await dragBait(q,0,{fish:1,touch,whileOver:t=>dragState(q,1).then(s=>({...s,t}))});
      if(d.targets.join()!=='1')defects.push(`${w}x${h}: a touch drag lit fish cards [${d.targets}] instead of the one under the finger`);
      if(!d.clone||Math.hypot(d.clone.x-d.t.x,d.clone.y-d.t.y)>d.clone.w)defects.push(`${w}x${h}: the bait card does not follow the finger`);
      await q.waitForTimeout(200);if(await castsLeft(q)!==9)defects.push(`${w}x${h}: a touch drag onto a fish card did not cast`);
    }else if(w===1280){
      // Keyboard: Enter on a bait card picks it, Enter on a fish card casts it.
      await q.locator('.proto-pond__bait button').first().focus();await q.keyboard.press('Enter');
      if(!(await q.locator('.proto-pond__bait[data-selected]').count()))defects.push(`${w}x${h}: Enter does not pick a bait card`);
      await q.locator('.proto-pond__fish').first().focus();await q.keyboard.press('Enter');await q.waitForTimeout(200);
      if(await castsLeft(q)!==9)defects.push(`${w}x${h}: keyboard casting did not cast`);
    }else{await dragBait(q,0);await q.waitForTimeout(200);if(await castsLeft(q)!==9)defects.push(`${w}x${h}: a mouse drag did not cast`);}
    await q.mouse.move(2,2);await q.waitForTimeout(300);
    for(const d of await findLayoutDefects(q,'.proto-pond',{parts:PARTS}))defects.push(`${w}x${h}: ${d}`);
    const water=await q.locator('.proto-pond__water').boundingBox();
    for(const f of await q.locator('.proto-pond__fish').all()){const r=await f.boundingBox();
      const size=await f.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
      if(Math.abs(size.w/size.h-56/74)>0.02)defects.push(`${w}x${h}: a fish card is not card-shaped (${size.w}x${size.h})`);
      // Inside the pond's oval bank, not just its bounding box.
      const nx=(Math.max(Math.abs(r.x-water.x-water.width/2),Math.abs(r.x+r.width-water.x-water.width/2)))/(water.width/2),ny=(Math.max(Math.abs(r.y-water.y-water.height/2),Math.abs(r.y+r.height-water.y-water.height/2)))/(water.height/2);
      if(nx>1||ny>1)defects.push(`${w}x${h}: a fish card leaves the water`);}
    // Fish the day out, go home, and check the supplies tray with the catch in it.
    for(let n=0;(await q.locator('.proto-pond__bait button:not([disabled])').count())>0&&n<20;n++){await dragBait(q,await pickBait(q),{touch,fish:n%2});await q.waitForTimeout(80);}
    await q.getByRole('button',{name:'Leave Pond'}).click();await q.waitForTimeout(800);
    if(w<900)await q.getByRole('button',{name:'Supplies',exact:true}).click();
    if(!(await q.locator('[data-supply="glowfish"]').count()))defects.push(`${w}x${h}: no glowfish in the supplies after a day's fishing`);
    for(const d of await findLayoutDefects(q,'.supply-tray',{parts:'.supply-tray__toggle, .supply-tray__well, .supply-row, .supply-row__token, .supply-row__count',cornerInset:12}))defects.push(`${w}x${h} supplies: ${d}`);
    await ctx.close();
  }
  assert.deepEqual(defects,[],'pond layout defects:\n'+defects.join('\n'));
  console.log('Casting by touch drag (phones), mouse drag and keyboard works; a tap only hints. Pond panel and the supplies tray holding the catch: no collisions, overflow or small text at 1912x914, 1280x720, 390x844 and 844x390; fish cards keep the card shape and stay inside the water.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
