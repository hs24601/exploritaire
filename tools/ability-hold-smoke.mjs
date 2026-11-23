import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5217','--strictPort'],{windowsHide:true});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error(`Vite exited ${code}`));});});
 browser=await chromium.launch({headless:true});const p=await browser.newPage({hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/ability-hold',{recursive:true});
 for(const [width,height,touch] of [[1440,1000,false],[390,844,true]]){
  await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5217/proto.html?combatsbx&scenario=1002');await p.locator('[data-battle-actor="hero"]').click();
  const originalHero=await p.locator('[data-battle-actor="hero"]').innerText();const card=p.locator('[data-skill="draft-cir"]');await card.scrollIntoViewIfNeeded();const box=await card.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  const cdp=await p.context().newCDPSession(p);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});else{await p.mouse.move(x,y);await p.mouse.down();}
  await p.locator('[data-drag-draft="draft-cir"]').waitFor();
  assert.equal(await p.locator('.ability-fan').evaluate(el=>getComputedStyle(el).visibility),'hidden');assert.equal(await p.locator('.ability-fan__backdrop').count(),0);assert.equal(await p.locator('.card-jumbo').count(),0);
  const foeTarget=p.locator('[data-potential-target]:not([data-potential-target^="card:"]):not([data-potential-target="hero"])').first();const targetId=await foeTarget.getAttribute('data-potential-target');const foe=await foeTarget.boundingBox();const tx=foe.x+foe.width/2,ty=foe.y+foe.height/2;
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx,y:ty}]});else await p.mouse.move(tx,ty,{steps:5});
  await p.waitForFunction(id=>[...document.querySelectorAll('[data-potential-target]')].some(el=>el.getAttribute('data-potential-target')===id&&el.getAttribute('data-over')==='true'),targetId);
  await p.screenshot({path:`artifacts/ability-hold/cir-${width}.png`});
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();
  await p.locator('.ability-fan').waitFor({state:'visible'});assert.equal(await p.locator('.ability-fan__drag').count(),0);assert.equal(await p.locator('.card-jumbo').count(),0);assert.equal(await p.locator('[data-battle-actor="hero"]').innerText(),originalHero,'Draft drop preserves resources');
  await card.tap();await p.getByRole('dialog',{name:'Cir jumbo card',exact:true}).waitFor();await p.keyboard.press('Escape');
  // Even an unaffordable card lifts, but releasing cannot summon for free.
  const dem=await p.locator('[data-skill="hold"]').boundingBox();await p.mouse.move(dem.x+dem.width/2,dem.y+dem.height/2);await p.mouse.down();await p.locator('.ability-fan__drag').waitFor();await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await p.locator('[data-battle-slot="dem"]').count(),0);assert.equal(await p.locator('.card-jumbo').count(),0);
  await cdp.detach();
 }
 assert.deepEqual(errors,[]);console.log('Passed: mouse/touch hold lifts Cir, suppresses radial/backdrop, highlights potential board target, release restores hand without cast/jumbo, tap still jumbos, unavailable lift/Escape cannot summon, no page errors.');
}finally{if(browser)await browser.close();server.kill();}
