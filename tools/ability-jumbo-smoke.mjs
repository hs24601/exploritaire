import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5216','--strictPort'],{windowsHide:true});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error(`Vite exited ${code}`));});});
 browser=await chromium.launch({headless:true});const p=await browser.newPage({hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/ability-jumbo',{recursive:true});
 for(const [width,height] of [[1440,1000],[390,844]]){
  await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5216/proto.html?combatsbx&scenario=1002');await p.locator('[data-battle-actor="hero"]').click();
  const cir=p.locator('[data-skill="draft-cir"]');await cir.tap();const jumbo=p.getByRole('dialog',{name:'Cir jumbo card',exact:true});await jumbo.waitFor();
  assert.equal(await jumbo.locator('.trading-card--jumbo').count(),1);assert.equal(await jumbo.locator('.trading-card__full-description p').textContent(),'TBD');
  assert.equal(await jumbo.getByRole('button',{name:'Choose target'}).count(),0);assert.equal(await p.locator('.ability-fan-overlay').evaluate(el=>el.inert),true);
  const face=await jumbo.locator('.trading-card').boundingBox(),body=await jumbo.locator('.trading-card__body').boundingBox();assert.ok(body.y>face.y+face.height*.45,'Rules panel leaves artwork visible');
  await jumbo.locator('img.ability-keru-art__subject').evaluate(i=>i.decode());await p.screenshot({path:`artifacts/ability-jumbo/cir-${width}.png`});
  await p.keyboard.press('Escape');assert.equal(await jumbo.count(),0);assert.equal(await p.locator('.ability-fan-overlay').count(),1);assert.equal(await cir.evaluate(el=>el===document.activeElement),true);
  await cir.press('Enter');await jumbo.waitFor();await p.getByRole('button',{name:'Close jumbo card',exact:true}).click();
  await cir.press('Space');await jumbo.waitFor();await p.keyboard.press('Escape');
  await p.locator('[data-skill="hold"]').click();await p.getByRole('dialog',{name:'Summon: Dem jumbo card',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Choose target',exact:true}).count(),0,'Unavailable ability is readable, not castable');
  await p.keyboard.press('Escape');await p.locator('[data-skill="ux-guard"]').click();await p.getByRole('dialog',{name:'Steady Paws jumbo card',exact:true}).waitFor();await p.keyboard.press('Escape');await p.keyboard.press('Escape');assert.equal(await p.locator('.ability-fan-overlay').count(),0);
 }
 await p.setViewportSize({width:1440,height:1000});
 const ready=async()=>{await p.goto('http://127.0.0.1:5216/proto.html?combatsbx&scenario=1001');for(const id of ['tutorial-1001-0-2','tutorial-1001-4-2','tutorial-1001-4-1']){await p.locator(`[data-battle-card="${id}"]`).click();await p.mouse.move(3,3);await p.waitForTimeout(200);}await p.locator('[data-battle-actor="hero"]').click();};
 await ready();await p.locator('[data-skill="hold"]').press('Enter');await p.getByRole('button',{name:'Choose target',exact:true}).click();assert.equal(await p.locator('.card-jumbo').count(),0);await p.locator('[data-skill-target="new-foundation"]').click();await p.locator('[data-battle-slot="dem"]').waitFor();
 await ready();const card=p.locator('[data-skill="hold"]');const box=await card.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(340);const slot=p.locator('[data-skill-target="new-foundation"]');await slot.waitFor();const dest=await slot.boundingBox();await p.mouse.move(dest.x+dest.width/2,dest.y+dest.height/2,{steps:8});await p.mouse.up();await p.locator('[data-battle-slot="dem"]').waitFor();assert.equal(await p.locator('.card-jumbo').count(),0,'Drag casts without opening jumbo');
 assert.deepEqual(errors,[]);console.log('Passed: touch/keyboard jumbo, real/unavailable/draft/mock cards, no automatic cast, inert fan, Escape/close/focus, desktop/mobile, explicit target summon, hold-drag summon.');
}finally{if(browser)await browser.close();server.kill();}
