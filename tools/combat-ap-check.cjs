const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');
fs.mkdirSync('artifacts/combat-ap',{recursive:true});
const level=page=>page.getByRole('group',{name:'Hero abilities',exact:true}).locator('> strong').innerText().then(t=>Number(t.split(' ')[0]));
async function charge(page,target){await page.evaluate(async target=>{
 const frame=()=>new Promise(r=>requestAnimationFrame(r));
 const bank=()=>Number(document.querySelector('[aria-label="Hero abilities"] > strong').textContent.split(' ')[0]);
 for(let guard=0;bank()<target && guard<250;guard++){
  let played=false;
  for(const col of document.querySelectorAll('.battle-field__column')){
   const btn=[...col.querySelectorAll('button')].pop();if(!btn||btn.disabled)continue;
   btn.click();await frame();
   const choices=document.querySelectorAll('.battle-field__foundation[data-targetable="true"]');
   const hero=[...choices].find(b=>b.dataset.battleActor==='hero');
   if(hero){hero.click();await frame();played=true;break;}
   if(choices.length){btn.click();await frame();continue;}
   played=true;break;
  }
  if(!played){[...document.querySelectorAll('.battle-field__status button')].find(b=>b.textContent==='Deal a row')?.click();await frame();}
 }
},target);assert.ok(await level(page)>=target);}
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const viewport of [{width:1912,height:914},{width:1600,height:900},{width:1280,height:720},{width:390,height:844}]){
  const p=await b.newPage({viewport});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');await p.locator('.battle-move').first().waitFor();
  assert.equal(await p.locator('.battle-move').count(),7);
  const trays=await p.locator('.battle-field__slot').evaluateAll(slots=>slots.map(slot=>{
    const tray=slot.querySelector('.ability-tray'), foundation=slot.querySelector('.battle-field__foundation');
    const a=tray.getBoundingClientRect(), b=foundation.getBoundingClientRect();
    return {actor:slot.dataset.battleSlot,slots:tray.children.length,empty:tray.querySelectorAll('.ability-tray__empty').length,height:a.height,foundationHeight:b.height,offset:a.top-b.top,lastEmpty:tray.lastElementChild.classList.contains('ability-tray__empty')};
  }));
  assert.deepEqual(trays.map(t=>[t.actor,t.slots,t.empty,t.height,t.foundationHeight,Math.round(t.offset)]),[['hero',4,0,140,140,0],['mochi',4,1,140,140,0]]);
  assert.equal(trays[1].lastEmpty,true);
  assert.ok(await p.locator('.battle-move').evaluateAll(rows=>rows.every(r=>r.getBoundingClientRect().height===32 && r.childElementCount===0))); 
  if(viewport.width>=1280){
   await charge(p,12);const before=await level(p);const nip=p.locator('[data-ability-actor="hero:Nip"]');const foe=p.locator('[data-battle-target="dark-slime"]');
   await nip.click();await p.screenshot({path:`artifacts/combat-ap/primed-${viewport.width}.png`});const a=await p.locator('.ability-card-popover .ability-card').boundingBox(),z=await foe.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(5,5,{steps:5});await p.mouse.up();assert.equal(await level(p),before);assert.equal(await p.locator('.ability-card-popover').count(),1);await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(z.x+z.width/2,z.y+z.height/2,{steps:8});await p.mouse.up();assert.equal(await level(p),before-1);
   await p.locator('[data-ability-actor="hero:Bite"]').click();await p.locator('.ability-card-popover').waitFor();await foe.click();assert.equal(await level(p),before-4);await foe.locator('[data-effect="exposed"]').waitFor();
   await p.locator('[data-ability-actor="hero:Takedown"]').focus();await p.keyboard.press('Enter');await p.keyboard.press('Escape');assert.equal(await p.locator('.ability-card-popover').count(),0);await p.keyboard.press('Enter');await foe.focus();await p.keyboard.press('Enter');assert.equal(await level(p),before-7);await foe.locator('[data-effect="stun"]').waitFor();
   await p.locator('[data-ability-actor="hero:Vice Grip:3"]').click();await p.locator('[data-battle-target="rear-slime"]').click();assert.equal(await level(p),before-10);await p.locator('[data-effect="grip"]').waitFor();
   await p.getByRole('button',{name:'Pause',exact:true}).click();
  }
  await p.screenshot({path:`artifacts/combat-ap/${viewport.width}.png`});
  const overflow=await p.locator('.battle-move').evaluateAll(rows=>rows.filter(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1).length);assert.equal(overflow,0);assert.deepEqual(errors,[]);console.log(viewport.width,'passed');await p.close();
 }
 const p=await b.newPage({viewport:{width:1280,height:720},hasTouch:true});await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');await p.locator('.battle-move').first().waitFor();await charge(p,4);
 const before=await level(p);await p.locator('[data-ability-actor="hero:Nip"]').tap();const a=await p.locator('.ability-card-popover .ability-card').boundingBox();const z=await p.locator('[data-battle-target="dark-slime"]').boundingBox();const c=await p.context().newCDPSession(p);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
 for(let i=1;i<=8;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(z.x+z.width/2-a.x-a.width/2)*i/8,y:a.y+a.height/2+(z.y+z.height/2-a.y-a.height/2)*i/8}]});
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await level(p),before-1);console.log('touch drag passed');await p.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
