const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='artifacts/combat-target-feedback'; fs.mkdirSync(out,{recursive:true});
const actors=async p=>JSON.parse(await p.locator('.combat-demo__arena').getAttribute('data-actors'));
const waitTarget=(p,id)=>p.waitForFunction(id=>{
 const units=JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]');
 return units.length && units.filter(a=>a.targeting==='focused').length===(id?1:0)
 && units.every(a=>a.marker.content.every(r=>r.kind!=='meter'||(r.meter.preview!==undefined)===(a.id===id)))
 && (!id||units.find(a=>a.id===id)?.targeting==='focused');
},id);
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,touch,reduced,art] of [[1280,720,false,false,'pixel'],[1912,914,false,false,'paint'],[1280,720,true,true,'paint']]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:reduced?'reduce':'no-preference'});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await p.addInitScript(art=>localStorage.setItem('exploritaire.artStyle',art),art);
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo&art='+art);
  await p.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').length===5);
  await p.getByRole('checkbox',{name:'maxAP',exact:true}).check();
  const nip=p.getByRole('button',{name:'Nip',exact:true}),first=p.locator('[data-battle-target="dark-slime"]'),second=p.locator('[data-battle-target="rear-slime"]');
  if(touch)await nip.tap();else await nip.click();
  await waitTarget(p,null);
  assert.equal(await p.locator('[data-bar="hp"] .battle-bar__preview').count(),0,'arming alone predicts nobody');
  assert.equal((await actors(p)).filter(a=>a.targeting==='valid').length,2);
  if(touch){await first.focus();}else await first.hover();
  await waitTarget(p,'dark-slime');
  assert.equal(await first.locator('[data-bar="hp"] .battle-bar__preview').count(),1);
  assert.equal(await second.locator('[data-bar="hp"] .battle-bar__preview').count(),0);
  const predicted=(await actors(p)).find(a=>a.id==='dark-slime').marker.content[0].meter.preview;
  assert.equal(await first.locator('[data-bar="hp"] .battle-bar__text').textContent(),'14→'+predicted);
  await p.screenshot({path:out+'/'+width+'-'+art+'-'+touch+'-focused.png'});
  await second.focus();if(!touch)await second.hover();await waitTarget(p,'rear-slime');
  assert.equal(await first.locator('[data-bar="hp"] .battle-bar__preview').count(),0);
  assert.equal(await second.locator('[data-bar="hp"] .battle-bar__preview').count(),1);
  await p.keyboard.press('Escape');await waitTarget(p,null);
  assert.ok((await actors(p)).every(a=>!a.targeting));
  if(touch){
   await nip.tap();
   const from=await p.locator('.ability-card-popover .ability-card').boundingBox(),to=await first.boundingBox();
   const cdp=await p.context().newCDPSession(p);
   const a={x:from.x+from.width/2,y:from.y+from.height/2},b={x:to.x+to.width/2,y:to.y+to.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
   for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]});
   await waitTarget(p,'dark-slime');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await nip.focus();await p.keyboard.press('Enter');await first.focus();await waitTarget(p,'dark-slime');await p.keyboard.press('Enter');
  }
  await waitTarget(p,null);
  assert.equal(await p.locator('[data-bar="hp"] .battle-bar__preview').count(),0);
  const actual=Number(await first.locator('[data-bar="hp"]').getAttribute('aria-valuenow'));
  assert.equal(actual,predicted,'predicted HP equals actual damage');
  await nip.click();await second.focus();await waitTarget(p,'rear-slime');
  await p.getByRole('button',{name:'Restart',exact:true}).focus();await p.keyboard.press('Enter');await waitTarget(p,null);
  assert.deepEqual(errors,[]);console.log(width,art,touch?'touch':'mouse/keyboard','passed');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
