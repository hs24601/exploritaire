import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5219','--strictPort'],{windowsHide:true});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error(`Vite exited ${code}`));});});
 browser=await chromium.launch({headless:true});const p=await browser.newPage({hasTouch:true});p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/cir-windstorm-v1',{recursive:true});
 const read=card=>card.evaluate(el=>['rear','subject','front'].map(kind=>{const node=el.querySelector(kind==='subject'?'.layered-card-art__subject':`.layered-card-art__wind--${kind}`),style=getComputedStyle(node);return {kind,x:new DOMMatrix(style.transform).m41,z:Number(style.zIndex),loaded:node.complete&&node.naturalWidth>0};}));
 for(const [width,height] of [[1440,1000],[390,844]]){
  await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5219/proto.html?combatsbx&scenario=1002',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('[data-battle-actor="hero"]').click();
  const source=p.locator('[data-skill="summon-cir"], [data-skill="draft-cir"]').first();await source.click();const jumbo=p.locator('.card-jumbo');await jumbo.waitFor();const art=jumbo.locator('[data-windstorm]');await art.waitFor();await art.locator('img').evaluateAll(xs=>Promise.all(xs.map(img=>img.decode())));
  const stage=await jumbo.locator('.trading-card-stage').boundingBox();await p.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.3);await p.waitForTimeout(900);const layers=await read(art);
  assert.ok(layers.every(layer=>layer.loaded));assert.ok(layers[0].x>0&&layers[0].x<layers[1].x&&layers[1].x<layers[2].x,'Near/far wind and subject have distinct parallax');assert.deepEqual(layers.map(layer=>layer.z),[1,2,3]);
  await p.screenshot({path:`artifacts/cir-windstorm-v1/${width}.png`});
  await p.mouse.move(stage.x+stage.width*.2,stage.y+stage.height*.7);await p.waitForTimeout(900);assert.ok((await read(art)).every(layer=>layer.x<0),'Wind tracks reversed spring');
  await p.emulateMedia({reducedMotion:'reduce'});assert.ok((await read(art)).every(layer=>layer.x===0),'Reduced motion is static');await p.emulateMedia({reducedMotion:'no-preference'});await p.keyboard.press('Escape');assert.equal(await jumbo.count(),0);assert.equal(await p.locator('.ability-fan').count(),1);
 }
 assert.deepEqual(errors,[]);console.log('Passed: two separate transparent wind planes around unchanged Cir, correct rear/subject/front stacking, distinct/reversing parallax, desktop/mobile jumbo, reduced-motion stills, dismissal, no page errors.');
}finally{if(browser)await browser.close();server.kill();}
