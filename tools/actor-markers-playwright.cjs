const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {charge}=new Function('require',fs.readFileSync('tools/combat-ap-check.cjs','utf8').split('(async()=>')[0]+'return {charge};')(require);
const out='artifacts/actor-markers';fs.mkdirSync(out,{recursive:true});
const units=async p=>JSON.parse(await p.locator('.combat-demo__arena').getAttribute('data-actors'));
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const [width,height,reduced] of [[1912,914,false],[1280,720,false],[1280,720,true]]) {
  const p=await b.newPage({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');await p.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').filter(a=>a.marker?.visible).length===4);
  let current=await units(p);assert.equal(current.filter(a=>a.marker.visible).length,4);assert.ok(current.every(a=>a.marker.rows<2));
  await p.screenshot({path:out+'/'+width+'-'+reduced+'-opening.png'});
  if(!reduced) for(const view of ['side','overview','enemy','party']) {
   await p.locator('.combat-demo__tools > summary').click();await p.locator('[data-view="'+view+'"]').click();await p.locator('.combat-demo__tools > summary').click();await p.waitForTimeout(850);
   assert.ok((await units(p)).filter(a=>a.visible).every(a=>Number.isFinite(a.marker.width)&&a.marker.width>0&&a.marker.width<8));await p.screenshot({path:out+'/'+width+'-'+view+'.png'});
  }
  await charge(p,8);await p.getByRole('button',{name:'Bite',exact:true}).click();await p.locator('[data-battle-target="dark-slime"]').click();await p.getByRole('button',{name:'Pause',exact:true}).click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).find(a=>a.id==='dark-slime').marker.revision>1);
  const foe=(await units(p)).find(a=>a.id==='dark-slime');assert.ok(foe.marker.revision>1);const hp=Number(await p.locator('[data-battle-target="dark-slime"] [data-bar="hp"]').getAttribute('aria-valuenow'));assert.equal(foe.marker.content[0].meter.current,hp);
  await p.waitForTimeout(900);const revisions=(await units(p)).map(a=>a.marker.revision);await p.waitForTimeout(250);assert.deepEqual((await units(p)).map(a=>a.marker.revision),revisions);
  await p.screenshot({path:out+'/'+width+'-'+reduced+'-damaged.png'});
  // Enough banked Nips defeat a slime; its marker leaves with the sprite.
  await p.getByRole('button',{name:'Resume',exact:true}).click();await charge(p,20);
  for(let n=0;n<20;n++) {if(await p.locator('[data-battle-target="dark-slime"]').getAttribute('data-state')==='down')break;await p.getByRole('button',{name:'Nip',exact:true}).click();await p.locator('[data-battle-target="dark-slime"]').click();}
  await p.waitForFunction(()=>{const a=JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).find(a=>a.id==='dark-slime');return !a.visible&&!a.marker.visible;});
  await p.getByRole('button',{name:'Restart',exact:true}).click();await p.waitForFunction(()=>{const a=JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).find(a=>a.id==='dark-slime');return a.visible&&a.marker.visible&&a.marker.content[0].meter.current===14;});

  await p.getByRole('button',{name:'Remove Mochi',exact:true}).click();await p.waitForFunction(()=>!JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).find(a=>a.id==='mochi').marker.visible);
  assert.deepEqual(errors,[]);console.log(width,reduced?'reduced':'normal','passed');await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
