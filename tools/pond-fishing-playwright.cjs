// Pond fishing: the Hero walks to the pond and casts bait cards by dragging them
// into the water (mouse, touch, or Enter on the keyboard). A miss loses the bait
// and a stamina; a bite starts the fight, a card-driven fishing meter, played here
// by a quick bot with the mouse and with touch. The fish only ever moves where a
// card in hand answers. A landed fish flies into the catch tray at once as its
// species (the ace a Minnow, the king a Kingfish), sometimes with a lucky
// glowfish; every fishing event takes under ten seconds, a lost fight leaves the
// fish in the water, the catch reaches the supplies, a glowfish on the table
// glows, and eating the glowfish and the Kingfish pays out.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// This seed deals a pond whose day-one bites include a king, and whose luck
// rolls bring up a glowfish a few fish later.
const SEED=20261008;
const seeded=s0=>{let s=s0;Math.random=()=>{s=(s*16807)%2147483647;return s/2147483647;};};
const centre=async l=>{const r=await l.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
const castsLeft=page=>page.locator('[data-pond-casts]').getAttribute('data-pond-casts').then(Number);
const stamina=async page=>{const m=(await page.locator('body').innerText()).match(/STAMINA (\d+)\/(\d+)/);return {now:+m[1],max:+m[2]};};
// The test knows the deal (the face-down ranks) by running the same rules on a
// mirror of the pond, so it can pick a bite, a miss, a king or a queen on purpose.
const installOracle=page=>page.evaluate(async seed=>{
  // The game's seed is one of the first few hundred seeded draws: find the one
  // whose deal matches the bait hand and fish backs on the table.
  const F=await import('/src/proto/rules/fishing.ts');
  const shown=[...document.querySelectorAll('.proto-pond__bait')].map(el=>el.dataset.baitRank).join()+'|'+[...document.querySelectorAll('.proto-pond__fish')].map(el=>el.dataset.ripple).join();
  let s=seed;window.__pond=null;
  for(let k=0;k<1000&&!window.__pond;k++){s=(s*16807)%2147483647;const deal=F.createPondDeal(Math.floor(s/2147483647*0xffffffff)+104729,1);
    if(deal.hand.map(c=>c.rank).join()+'|'+deal.water.map(f=>F.rippleSize(f.rank)).join()===shown)window.__pond=deal;}
  if(!window.__pond)throw new Error('could not find the pond deal');
  window.__pick=want=>{const p=window.__pond,water=p.water.map(f=>f.rank),bite=c=>water.includes(c.rank);
    if(want==='miss')return p.hand.findIndex(c=>!bite(c));
    if(typeof want==='number'){const i=p.hand.findIndex(c=>c.rank===want&&bite(c));if(i>=0)return i;}
    return p.hand.findIndex(bite);};
  window.__cast=i=>{window.__pond=F.castBait(window.__pond,window.__pond.hand[i].id).pond;return window.__pond.hooked?window.__pond.water.find(f=>f.id===window.__pond.hooked).rank:null;};
  window.__end=landed=>{if(!landed){window.__pond=F.loseHooked(window.__pond);return null;}const l=F.landHooked(window.__pond);window.__pond=l.pond;return l;};
  window.__handRanks=()=>window.__pond.hand.map(c=>c.rank);
},SEED);
const pick=(page,want)=>page.evaluate(w=>window.__pick(w),want);
// Drag a bait card into the pond with the mouse or (given a CDP session) a finger.
// whileOver runs before letting go.
const castBait=async(page,bait,{touch=null,whileOver=null}={})=>{
  const a=await centre(page.locator('.proto-pond__bait').nth(bait)),w=await page.locator('.proto-pond__water').boundingBox();
  const t={x:w.x+w.width*0.5,y:w.y+w.height*0.55};
  const steps=12,at=i=>({x:a.x+(t.x-a.x)*i/steps,y:a.y+(t.y-a.y)*i/steps});
  if(touch){await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});for(let i=1;i<=steps;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[at(i)]});}
  else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps});}
  const over=whileOver?await whileOver(t):null;
  const castAt=Date.now(),casts=await castsLeft(page);
  if(touch)await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  // Mirror the cast only if the game took it.
  const took=await page.waitForFunction(n=>Number(document.querySelector('[data-pond-casts]').dataset.pondCasts)<n,casts,{timeout:1000}).then(()=>true,()=>false);
  const hooked=took?await page.evaluate(i=>window.__cast(i),bait):null;
  return {over,hooked,castAt,took};
};
const fightState=page=>page.evaluate(()=>{const f=document.querySelector('.proto-fight');if(!f)return null;
  const card=d=>{const el=document.querySelector(`.proto-fight__reel[data-reel="${d}"]`);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  return {fish:+f.dataset.fishPos,target:+f.dataset.fishTarget,goal:+f.dataset.zoneGoal,size:+f.dataset.zoneSize,progress:+f.dataset.progress,up:card('up'),down:card('down'),none:card('none'),
    ups:document.querySelectorAll('.proto-fight__reel[data-reel="up"]').length,downs:document.querySelectorAll('.proto-fight__reel[data-reel="down"]').length};});
const tap=(page,p,touch)=>touch?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);
// An attentive player: whenever the fish turns, play the card that answers it.
// idle sits on its hands. Returns what the rules landed (species and luck), or null.
const fight=async(page,{touch=false,idle=false}={})=>{
  for(;;){const s=await fightState(page);if(!s)break;
    const want=idle?null:s.target>s.goal?s.up:s.target<s.goal?s.down:null;
    if(want)await tap(page,want,touch);
    await page.waitForTimeout(want?90:25);}
  const landed=!/slipped the hook/.test(await page.locator('.proto-pond__message').innerText());
  return page.evaluate(l=>window.__end(l),landed);
};
// Counts per kind in the catch tray, leaving out the empty placeholder pill.
const trayCounts=page=>page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.proto-pond__catch [data-pond-catch]')].filter(li=>li.dataset.pondCatch!=='none').map(li=>[li.dataset.pondCatch,Number(li.dataset.count)])));
const settled=page=>page.waitForFunction(()=>!document.querySelector('.proto-pond-catch-ghost'),null,{timeout:5000});
const walkToPond=async page=>{
  const a=await centre(page.locator('[data-board-piece="actor"]')),p=await centre(page.locator('[data-biome-id="pond"]'));
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:15});await page.mouse.up();
  await page.locator('.proto-pond[data-angler]').waitFor({timeout:15000});
};
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await (await b.newContext({viewport:{width:1912,height:914}})).newPage();
  await p.addInitScript(seeded,SEED);
  await p.goto('http://localhost:5178/proto.html');
  const before=await stamina(p);
  await walkToPond(p);await installOracle(p);
  assert.equal((await stamina(p)).now,before.now,'walking to the pond costs no stamina');
  assert.equal(await p.locator('.proto-pond__fish.playing-card').count(),6,'six fish lie face down in the water as cards');
  assert.deepEqual(await p.evaluate(()=>[...document.querySelectorAll('.proto-pond__bait')].map(el=>+el.dataset.baitRank)),await p.evaluate(()=>window.__handRanks()),'the test knows the deal');
  // A click on bait does not cast; it explains how to.
  await p.locator('.proto-pond__bait').first().locator('button').click();await p.mouse.move(2,2);
  assert.equal(await castsLeft(p),10,'clicking bait does not cast');
  assert.match(await p.locator('.proto-pond__message').innerText(),/drag a bait card into the pond/i,'a click on bait explains dragging');
  // Bait dropped anywhere but the pond casts nothing.
  {const a=await centre(p.locator('.proto-pond__bait').first()),m=await centre(p.locator('.proto-pond__message'));
    await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(m.x,m.y,{steps:10});
    assert.equal(await p.locator('.proto-pond__water[data-drop-target]').count(),0,'the pond does not light up away from the water');await p.mouse.up();
    assert.equal(await castsLeft(p),10,'bait dropped off the water does not cast');
    assert.equal(await p.locator('.proto-pond__drag').count(),0,'the carried card is gone after letting go');}
  // A miss: the bait is lost, a stamina is spent, and nibbles show neighbours.
  const miss=await castBait(p,await pick(p,'miss'),{whileOver:()=>p.evaluate(()=>({lit:!!document.querySelector('.proto-pond__water[data-drop-target]'),clone:!!document.querySelector('.proto-pond__drag'),dimmed:document.querySelectorAll('.proto-pond__bait[data-dragging]').length}))});
  assert.ok(miss.over.lit,'while dragging, the pond lights up as the drop target');
  assert.ok(miss.over.clone,'the bait card is carried under the pointer');
  assert.equal(miss.over.dimmed,1,'the bait card left behind dims while carried');
  assert.equal(miss.hooked,null,'that bait was a miss');
  assert.equal(await castsLeft(p),9,'dropping bait in the pond casts it');
  assert.equal((await stamina(p)).now,before.now-1,'a miss costs a stamina');
  assert.match(await p.locator('.proto-pond__message').innerText(),/go fish/i,'a miss says go fish');
  assert.equal(await p.locator('.proto-fight').count(),0,'a miss starts no fight');
  // A bite on the king: the fight begins with the king tethered as the line card.
  const king=await castBait(p,await pick(p,13));
  assert.equal(king.hooked,13,'the king bit');
  await p.locator('.proto-fight').waitFor();
  assert.equal(await p.locator('.proto-pond__bait').count(),0,'the bait hand gives way to reel cards');
  assert.equal(await p.locator('.proto-fight__reel').count(),4,'four reel cards');
  assert.equal((await p.locator('.proto-fight__line-card').innerText()).trim(),'K','the cast king is the line card');
  assert.ok(await p.getByRole('button',{name:'Leave Pond'}).isDisabled(),'no leaving mid-fight');
  const tether=await p.locator('.proto-fight__tether line').evaluate(l=>Math.hypot(l.x2.baseVal.value-l.x1.baseVal.value,l.y2.baseVal.value-l.y1.baseVal.value));
  assert.ok(tether>20,'a fishing line ties the line card to the fish');
  const opening=await fightState(p);
  assert.ok(opening.ups+opening.downs>=1,'the reel hand holds a playable card');
  assert.equal(opening.fish,opening.goal,'the fight opens with the fish in the zone');
  if(opening.none){await p.mouse.click(opening.none.x,opening.none.y);assert.equal((await fightState(p)).goal,opening.goal,'a card that is neither +1 nor -1 does nothing');}
  // The fish's first turn is one the hand answers.
  await p.waitForFunction(g=>{const f=document.querySelector('.proto-fight');return f&&+f.dataset.fishTarget!==g;},opening.goal);
  const turned=await fightState(p);
  assert.ok(turned&&Math.abs(turned.target-turned.goal)<=2&&(turned.target>turned.goal?turned.up:turned.down),'the fish turns where a card in hand can follow');
  // Watch the landing: the fish flies from the meter into the tray, which counts it on arrival.
  await p.evaluate(()=>{const log=window.__reel={frames:[]};const tick=()=>{const g=document.querySelector('.proto-pond-catch-ghost');
    const c=Number(document.querySelector('.proto-pond__catch [data-pond-catch="kingfish"]')?.dataset.count??0);
    if(g){const r=g.getBoundingClientRect();log.frames.push({x:r.x+r.width/2,y:r.y+r.height/2,count:c});}else if(log.frames.length)return;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  const kingCatch=await fight(p);
  assert.equal(kingCatch?.caught,'kingfish','the bot lands the king as a Kingfish');
  assert.match(await p.locator('.proto-pond__message').innerText(),/Kingfish/,'the catch is named a Kingfish');
  await settled(p);
  const kingEvent=Date.now()-king.castAt;
  assert.ok(kingEvent<10000,`casting, fighting and landing the Kingfish took ${kingEvent}ms`);
  const reel=await p.evaluate(()=>window.__reel.frames),pill=await centre(p.locator('.proto-pond__catch [data-pond-catch="kingfish"]')),last=reel[reel.length-1];
  assert.ok(reel.length>5&&Math.hypot(last.x-pill.x,last.y-pill.y)<40,'the Kingfish flies from the meter into its tray pill');
  assert.ok(reel.every(f=>f.count===0),'the tray counts it only when it lands');
  assert.equal((await trayCounts(p)).kingfish,1,'a landed king is a Kingfish in the tray at once');
  assert.equal((await p.locator('.proto-pond__catch [data-pond-catch="kingfish"] .proto-pond__catch-rank').innerText()).trim(),'K','its pill names the rank');
  // Fish on until the luck roll brings up a glowfish; every event stays under ten seconds,
  // and every species lands under its own name.
  const events=[kingEvent],species=['kingfish'];
  for(let n=0;n<8&&!(await trayCounts(p)).glowfish;n++){
    const bait=await pick(p,'any');if(bait<0)break;
    const cast=await castBait(p,bait);assert.ok(cast.hooked,'the planned bite bit');
    await p.locator('.proto-fight').waitFor();const got=await fight(p);assert.ok(got,`the bot lands the ${cast.hooked}`);
    await settled(p);events.push(Date.now()-cast.castAt);species.push(got.caught);
    assert.ok((await trayCounts(p))[got.caught]>=1,`a landed ${cast.hooked} is a ${got.caught} in the tray`);
    if(got.bonus)assert.match(await p.locator('.proto-pond__message').innerText(),/glowfish/i,'the lucky glowfish is announced');
  }
  const caught=await trayCounts(p);
  assert.equal(caught.glowfish,1,'a lucky roll brought up a glowfish');
  const smallFry=species.find(id=>id!=='kingfish');
  assert.ok(events.every(ms=>ms<10000),`every fishing event is under ten seconds (${events.join(', ')}ms)`);
  // Doing nothing loses the fish, within the time limit; it stays in the water face up.
  {const bait=await pick(p,'any');
    if(bait>=0){const cast=await castBait(p,bait);await p.locator('.proto-fight').waitFor();
      assert.equal(await fight(p,{idle:true}),null,'an idle angler loses the fish');
      assert.ok(Date.now()-cast.castAt<10000,'a lost fight also ends within ten seconds');
      const label=({1:'A',11:'J',12:'Q',13:'K'})[cast.hooked]??String(cast.hooked);
      assert.ok(await p.locator('.proto-pond__fish[data-revealed] .proto-pond__rank').filter({hasText:new RegExp(`^${label}$`)}).count()>=1,'the lost fish stays in the water, face up');
      assert.deepEqual(await trayCounts(p),caught,'a lost fish is not caught');}}
  await p.getByRole('button',{name:'Leave Pond'}).click();await p.waitForTimeout(600);
  assert.equal(await p.locator('.proto-pond[data-angler]').count(),0,'the Hero has left the pond');
  for(const [id,count] of Object.entries(caught))assert.equal(Number(await p.locator(`[data-supply="${id}"]`).getAttribute('data-count')),count,`caught ${id} reach the supplies`);
  // At midnight a glowfish on the table lights its spot; a plain fish does not.
  await p.evaluate(()=>{const i=document.querySelector('[aria-label="Table time of day"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'0');i.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.waitForTimeout(400);
  for(const id of ['glowfish',smallFry,'kingfish']){await p.locator(`[data-supply="${id}"]`).click();await p.getByRole('button',{name:'Place 1 on table'}).click();await p.keyboard.press('Escape');await p.waitForTimeout(300);}
  const glowLight=Number(await p.locator('[data-board-piece="resource"][data-resource="glowfish"]').getAttribute('data-light-percent'));
  const fishLight=Number(await p.locator(`[data-board-piece="resource"][data-resource="${smallFry}"]`).getAttribute('data-light-percent'));
  assert.ok(glowLight>=30,`the glowfish lights its spot to at least dim (${glowLight}%)`);
  assert.ok(glowLight>fishLight,`the glowfish is brighter than a plain fish (${glowLight}% vs ${fishLight}%)`);
  const heroLightBefore=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  const fed=await stamina(p);
  const eat=async id=>{const s=await centre(p.locator(`[data-board-piece="resource"][data-resource="${id}"]`)),h=await centre(p.locator('[data-board-piece="actor"]'));
    await p.mouse.move(s.x,s.y);await p.mouse.down();await p.mouse.move(h.x,h.y,{steps:15});await p.mouse.up();await p.waitForTimeout(500);
    assert.equal(await p.locator(`[data-board-piece="resource"][data-resource="${id}"]`).count(),0,`the ${id} is eaten`);};
  await eat('glowfish');
  const glowing=await stamina(p);
  assert.equal(glowing.max,fed.max+2,'eating the glowfish raises max stamina by 2');
  assert.equal(glowing.now,Math.min(glowing.max,fed.now+3),'and restores 3 stamina');
  const heroLight=Number(await p.locator('[data-board-piece="actor"]').getAttribute('data-light-percent'));
  assert.ok(heroLight>heroLightBefore+15,`the Hero glows brighter (${heroLightBefore}% → ${heroLight}%)`);
  await eat('kingfish');
  const feast=await stamina(p);
  assert.equal(feast.now,feast.max,'eating the Kingfish restores all stamina');
  console.log(`Pond: drag-to-cast (a click only hints, the pond lights up under the bait); a miss cost 1 stamina; the fish turned where the hand could follow; fights landed ${species.join(', ')} plus a lucky glowfish (events ${events.map(ms=>(ms/1000).toFixed(1)+'s').join(', ')}); an idle fight lost its fish; glowfish light ${glowLight}% vs ${smallFry} ${fishLight}%; glowfish stamina ${fed.now}/${fed.max} → ${glowing.now}/${glowing.max}, light ${heroLightBefore}% → ${heroLight}%; Kingfish feast → ${feast.now}/${feast.max}.`);
  // Touch on phones, the mouse on desktop and the keyboard at 1280x720, with the
  // pond panel and the fight checked for layout at every size.
  const PARTS='.proto-pond__catch-rank, .proto-pond__catch, .proto-pond__catch > li, .proto-pond__header, .proto-pond__header > span, .proto-pond__water, .proto-pond__fish, .proto-pond__band, .proto-pond__rank, .proto-pond__message, .proto-pond__hand, .proto-pond__bait, .proto-pond__bait button, .proto-pond__footer, .proto-pond__legend, .proto-pond__leave';
  const FIGHT_PARTS='.proto-pond__catch-rank, .proto-pond__header, .proto-pond__header > span, .proto-fight, .proto-fight__line, .proto-fight__line-card, .proto-fight__time, .proto-fight__meter, .proto-fight__bar, .proto-pond__message, .proto-fight__hand, .proto-fight__reel, .proto-fight__reel button, .proto-pond__catch, .proto-pond__catch > li, .proto-pond__footer, .proto-pond__legend, .proto-pond__leave';
  const defects=[];
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    // Phone landscape shows only a sliver of the table, so that size walks to the
    // pond in portrait and then turns the phone.
    const landscape=w>h&&h<500,[sw,sh]=landscape?[h,w]:[w,h];
    const phone=sw<900,ctx=await b.newContext({viewport:{width:sw,height:sh},hasTouch:phone,isMobile:phone});
    const q=await ctx.newPage();await q.addInitScript(seeded,SEED);await q.goto('http://localhost:5178/proto.html');
    if(phone)await q.getByRole('button',{name:'Table',exact:true}).click();
    const pond=await q.locator('[data-biome-id="pond"]').boundingBox(),view=await q.locator('.proto-map-viewport').boundingBox();
    if(!pond||pond.x<view.x||pond.x+pond.width>view.x+view.width||pond.y<view.y||pond.y+pond.height>view.y+view.height)defects.push(`${sw}x${sh}: the pond is not in the starting view`);
    await walkToPond(q);await installOracle(q);await q.mouse.move(2,2);await q.waitForTimeout(300);
    if(landscape){await q.setViewportSize({width:w,height:h});await q.waitForTimeout(300);}
    const touch=phone?await ctx.newCDPSession(q):null;
    for(const d of await findLayoutDefects(q,'.proto-pond',{parts:PARTS}))defects.push(`${w}x${h}: ${d}`);
    const water=await q.locator('.proto-pond__water').boundingBox();
    for(const f of await q.locator('.proto-pond__fish').all()){const r=await f.boundingBox();
      const size=await f.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
      if(Math.abs(size.w/size.h-56/74)>0.02)defects.push(`${w}x${h}: a fish card is not card-shaped (${size.w}x${size.h})`);
      // Inside the pond's oval bank, not just its bounding box.
      const nx=(Math.max(Math.abs(r.x-water.x-water.width/2),Math.abs(r.x+r.width-water.x-water.width/2)))/(water.width/2),ny=(Math.max(Math.abs(r.y-water.y-water.height/2),Math.abs(r.y+r.height-water.y-water.height/2)))/(water.height/2);
      if(nx>1||ny>1)defects.push(`${w}x${h}: a fish card leaves the water`);}
    // Cast a bite: by touch on phones (a tap only hints), by keyboard at 1280x720, by mouse otherwise.
    const bait=await pick(q,'any');
    if(touch){
      const a=await centre(q.locator('.proto-pond__bait').first());
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await q.waitForTimeout(200);
      if(await castsLeft(q)!==10)defects.push(`${w}x${h}: a tap on bait cast it`);
      const cast=await castBait(q,bait,{touch,whileOver:()=>q.evaluate(()=>({lit:!!document.querySelector('.proto-pond__water[data-drop-target]'),clone:!!document.querySelector('.proto-pond__drag')}))});
      if(!cast.over.lit||!cast.over.clone)defects.push(`${w}x${h}: a touch drag does not carry the bait or light the pond`);
    }else if(w===1280){
      await q.locator('.proto-pond__bait button').nth(bait).focus();await q.keyboard.press('Enter');
      if(!(await q.locator('.proto-pond__bait[data-selected]').count()))defects.push(`${w}x${h}: Enter does not pick a bait card`);
      await q.locator('.proto-pond__water').focus();await q.keyboard.press('Enter');await q.evaluate(i=>window.__cast(i),bait);
    }else await castBait(q,bait);
    if(!(await q.locator('.proto-fight').count()))defects.push(`${w}x${h}: casting a bite did not start the fight`);
    else{
      for(const d of await findLayoutDefects(q,'.proto-pond',{parts:FIGHT_PARTS}))defects.push(`${w}x${h} fight: ${d}`);
      for(const c of await q.locator('.proto-fight__reel button, .proto-fight__line-card button').all()){const size=await c.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight}));
        if(Math.abs(size.w/size.h-56/74)>0.02)defects.push(`${w}x${h}: a reel card is not card-shaped (${size.w}x${size.h})`);}
      const fishBox=await q.locator('.proto-fight__fish').boundingBox(),meter=await q.locator('.proto-fight__meter').boundingBox();
      if(fishBox.x<meter.x||fishBox.x+fishBox.width>meter.x+meter.width)defects.push(`${w}x${h}: the fish is wider than the meter`);
      if(w===1280){const s=await fightState(q);const key=s.up?'ArrowUp':'ArrowDown';await q.keyboard.press(key);if(((await fightState(q))?.goal??s.goal)===s.goal)defects.push(`${w}x${h}: ${key} does not move the zone`);}
      if(!(await fight(q,{touch:phone})))defects.push(`${w}x${h}: the bot lost a fight by ${phone?'touch':'mouse'}`);
    }
    // Fish the day out with bites (and a miss when the hand has none), go home, and
    // check the supplies tray with the catch in it.
    for(let n=0;n<12;n++){
      await q.waitForTimeout(150);
      if(!(await q.locator('.proto-pond__bait button:not([disabled])').count()))break;
      let next=await pick(q,'any');if(next<0)next=0;
      const cast=await castBait(q,next,{touch});
      if(!cast.took){defects.push(`${w}x${h}: a cast with enabled bait was not taken (${await q.locator('.proto-pond__message').innerText()})`);break;}
      if(cast.hooked){
        if(!(await q.locator('.proto-fight').waitFor({timeout:3000}).then(()=>true,()=>false))){defects.push(`${w}x${h}: a bite did not start a fight (${await q.locator('.proto-pond__message').innerText()})`);break;}
        await fight(q,{touch:phone});}
      await q.waitForTimeout(80);
    }
    await settled(q);await q.mouse.move(2,2);await q.waitForTimeout(300);
    // The catch tray holding a day's species still fits.
    if((await q.locator('.proto-pond__catch [data-pond-catch]:not([data-pond-catch="none"])').count())<2)defects.push(`${w}x${h}: fewer than two species caught in a day`);
    for(const d of await findLayoutDefects(q,'.proto-pond',{parts:PARTS}))defects.push(`${w}x${h} after a day: ${d}`);
    await q.getByRole('button',{name:'Leave Pond'}).click();await q.waitForTimeout(800);
    if(w<900)await q.getByRole('button',{name:'Supplies',exact:true}).click();
    if(!(await q.locator('[data-supply="kingfish"], [data-supply="minnow"], [data-supply="walleye"], [data-supply="crappie"]').count()))defects.push(`${w}x${h}: no fish in the supplies after a day's fishing`);
    for(const d of await findLayoutDefects(q,'.supply-tray',{parts:'.supply-tray__toggle, .supply-tray__well, .supply-row, .supply-row__token, .supply-row__count',cornerInset:12}))defects.push(`${w}x${h} supplies: ${d}`);
    await ctx.close();
  }
  assert.deepEqual(defects,[],'pond layout defects:\n'+defects.join('\n'));
  console.log('Casting by touch drag (phones), mouse drag and keyboard, and fighting by touch, mouse and arrow keys, all work; a tap only hints. The pond, the fight and the supplies tray holding the catch: no collisions, overflow or small text at 1912x914, 1280x720, 390x844 and 844x390; fish and reel cards keep the card shape.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
