import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5218','--strictPort'],{windowsHide:true});let browser;
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error(`Vite exited ${code}`));});});
 browser=await chromium.launch({headless:true});const p=await browser.newPage({hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/ability-holo',{recursive:true});
 const read=card=>card.evaluate(el=>{const style=getComputedStyle(el),bg=el.querySelector('.layered-card-art__background'),fg=el.querySelector('.layered-card-art__subject');return {x:Number(style.getPropertyValue('--art-shift-x')),tilt:style.transform,bg:new DOMMatrix(getComputedStyle(bg).transform).m41,fg:new DOMMatrix(getComputedStyle(fg).transform).m41,foil:Number(getComputedStyle(el.querySelector('.trading-card__foil')).opacity),glare:Number(getComputedStyle(el.querySelector('.trading-card__glare')).opacity),body:getComputedStyle(el.querySelector('.trading-card__body')).transform};});
 for(const [width,height] of [[1440,1000],[390,844]]){
  await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5218/proto.html?combatsbx&scenario=1002');await p.locator('[data-battle-actor="hero"]').click();
  const cir=p.locator('[data-skill="draft-cir"]');const box=await cir.boundingBox();await p.mouse.move(box.x+box.width*.75,box.y+box.height*.25);await p.waitForTimeout(800);
  const compact=await read(cir.locator('.trading-card'));assert.ok(Math.abs(compact.x)>.1,'Draft hand card inherits spring');assert.ok(compact.bg*compact.fg<0,'Hand planes move oppositely');assert.ok(compact.foil>.3&&compact.glare>.2,'Shared active holo finish');
  await cir.tap();const jumbo=p.getByRole('dialog',{name:'Cir jumbo card',exact:true}),face=jumbo.locator('.trading-card');await jumbo.waitFor();
  const stage=await jumbo.locator('.trading-card-stage').boundingBox();await p.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.25);await p.waitForTimeout(800);const right=await read(face);
  assert.ok(right.x>.1&&right.bg<0&&right.fg>0,'Jumbo uses shared opposing parallax');assert.ok(right.body!=='none','Jumbo copy has depth');assert.ok(right.foil>.3&&right.glare>.2,'Jumbo inherits foil/glare');
  await p.mouse.move(stage.x+stage.width*.2,stage.y+stage.height*.75);await p.waitForTimeout(800);const left=await read(face);assert.ok(left.bg>0&&left.fg<0&&left.x<-.1,'Spring reverses with pointer');assert.notEqual(left.tilt,right.tilt);
  const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stage.x+stage.width*.8,y:stage.y+stage.height*.3}]});await p.waitForTimeout(800);const touch=await read(face);assert.ok(touch.bg<0&&touch.fg>0,'Touch controls shared parallax');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
  await p.screenshot({path:`artifacts/ability-holo/cir-${width}.png`});await p.emulateMedia({reducedMotion:'reduce'});await p.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.3);const still=await read(face);assert.equal(still.tilt,'none');assert.equal(still.bg,0);assert.equal(still.fg,0);assert.equal(still.body,'none');
  await p.emulateMedia({reducedMotion:'no-preference'});await p.keyboard.press('Escape');const actor=p.locator('[data-skill="ux-guard"]');assert.equal(await actor.locator('.layered-card-art__background').count(),1);assert.equal(await actor.locator('.layered-card-art__subject').count(),1,'Actor ability reuses layered portrait');
 }
 assert.deepEqual(errors,[]);console.log('Passed: compact/jumbo spring tilt, opposing shared art planes, shared foil/glare, copy depth, pointer reversal, touch input/cancel, reduced-motion stills, actor layered portraits, desktop/mobile, no page errors.');
}finally{if(browser)await browser.close();server.kill();}
