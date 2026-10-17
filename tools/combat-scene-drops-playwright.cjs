const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out='artifacts/combat-scene-drops';fs.mkdirSync(out,{recursive:true});
const units=async p=>JSON.parse(await p.locator('.combat-demo__arena').getAttribute('data-actors'));
const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
const hp=(p,id)=>p.locator('[data-battle-target="'+id+'"] [data-bar="hp"]').getAttribute('aria-valuenow').then(Number);
const target=(p,id)=>p.locator('.combat-demo__drop-target[data-scene-target="'+id+'"]');
const waitFocus=(p,id)=>p.waitForFunction(id=>{
 const a=JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]');
 return a.length&&a.filter(u=>u.targeting==='focused').length===(id?1:0)&&(!id||a.find(u=>u.id===id)?.targeting==='focused');
},id);
async function drag(p,touch){
 const from=center(await p.locator('.ability-card-popover .ability-card').boundingBox());
 const cdp=touch?await p.context().newCDPSession(p):null;
 if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
 else{await p.mouse.move(from.x,from.y);await p.mouse.down();}
 return {
  async move(to){if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});else await p.mouse.move(to.x,to.y,{steps:6});},
  async end(){if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();},
 };
}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,art,touch,reduced] of [[1280,720,'pixel',false,false],[1912,914,'paint',false,false],[1280,720,'paint',true,true]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference'});const errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await p.addInitScript(art=>localStorage.setItem('exploritaire.artStyle',art),art);
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');
  await target(p,'dark-slime').waitFor({state:'visible'});
  await p.waitForFunction(()=>document.querySelector('.combat-demo__arena').dataset.cameraMoving==='false');
  await p.getByRole('checkbox',{name:'maxAP',exact:true}).check();
  const arm=async(name='Nip')=>{const b=p.getByRole('button',{name,exact:true});if(touch)await b.tap();else await b.click();try{await p.waitForFunction(()=>document.querySelector('[data-scene-target="dark-slime"]').dataset.targetable==='true',null,{timeout:5000});}catch(e){await p.screenshot({path:out+'/arm-debug.png'});console.log('arm failed',await p.locator('.battle-field').getAttribute('data-aiming'),await b.getAttribute('aria-pressed'),(await units(p)).map(a=>[a.id,a.targeting,a.marker.content]));throw e;}};
  await arm();let d=await drag(p,touch);
  await d.move(center(await target(p,'dark-slime').boundingBox()));await waitFocus(p,'dark-slime');
  assert.equal(await p.locator('[data-battle-target="dark-slime"]').getAttribute('data-preview'),'focus');
  assert.equal(await p.locator('[data-battle-target="rear-slime"] [data-bar="hp"] .battle-bar__preview').count(),0);
  const predicted=(await units(p)).find(a=>a.id==='dark-slime').marker.content[0].meter.preview;
  await p.screenshot({path:out+'/'+width+'-'+art+'-'+touch+'-held.png'});
  await d.move(center(await target(p,'rear-slime').boundingBox()));await waitFocus(p,'rear-slime');
  await p.keyboard.press('Escape');await d.end();await waitFocus(p,null);assert.equal(await hp(p,'dark-slime'),14);assert.equal(await hp(p,'rear-slime'),14);
  // Drop uses the same actor ID and predicted damage as the tableau.
  await arm();d=await drag(p,touch);
  const camera=await p.locator('.combat-demo__arena').getAttribute('data-cameraPosition');
  await d.move(center(await target(p,'dark-slime').boundingBox()));await waitFocus(p,'dark-slime');await d.end();await waitFocus(p,null);
  assert.equal(await hp(p,'dark-slime'),predicted);
  assert.equal(await p.locator('.combat-demo__arena').getAttribute('data-cameraPosition'),camera,'card drag does not orbit camera');
  // A UI overlay is never a drop through to the world.
  await arm();d=await drag(p,touch);await d.move(center(await p.locator('.proto-world-minimap').boundingBox()));await waitFocus(p,null);await d.end();
  assert.equal(await hp(p,'dark-slime'),predicted);await p.keyboard.press('Escape');
  // The region remains aligned after a camera view change and viewport resize.
  await p.locator('.combat-demo__tools > summary').click();await p.locator('[data-view="overview"]').click();await p.locator('.combat-demo__tools > summary').click();
  await p.waitForFunction(()=>document.querySelector('.combat-demo__arena').dataset.cameraMoving==='false');
  await p.setViewportSize({width:width-80,height});await target(p,'rear-slime').waitFor({state:'visible'});
  await arm();d=await drag(p,touch);await d.move(center(await target(p,'rear-slime').boundingBox()));await waitFocus(p,'rear-slime');await d.end();await waitFocus(p,null);
  assert.equal(await hp(p,'rear-slime'),13);
  // Defeated targets disappear immediately, while the tableau route still works.
  await p.evaluate(()=>{
   const root=document.querySelector('.battle-field');let fiber=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];
   while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;
   let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.foes)hook=hook.next;
   hook.queue.dispatch(b=>({...b,foes:b.foes.map(f=>f.id==='dark-slime'?{...f,hp:1}:f)}));
  });
  await arm();d=await drag(p,touch);await d.move(center(await target(p,'dark-slime').boundingBox()));await waitFocus(p,'dark-slime');await d.end();
  await target(p,'dark-slime').waitFor({state:'hidden'});assert.equal(await target(p,'dark-slime').getAttribute('data-targetable'),'false');
  await p.getByRole('button',{name:'Nip',exact:true}).click();await p.locator('[data-battle-target="rear-slime"]').click();assert.equal(await hp(p,'rear-slime'),12);
  assert.deepEqual(errors,[]);console.log(width,art,touch?'touch':'mouse','scene drops passed');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
