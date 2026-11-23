import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5237','--strictPort'],{windowsHide:true});
let browser;
try {
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(t);resolve();}});server.on('exit',()=>reject(Error('Server exited')));});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
 await page.goto('http://127.0.0.1:5237/proto.html?combatsbx&scenario=1002',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('[data-battle-actor="hero"]').waitFor({timeout:60000});
 await page.evaluate(async()=>{
 const b=await import('/src/proto/rules/battle.ts');let s=b.createCombatSandboxScenario('1002');s={...s,party:s.party.map(a=>({...a,charge:6}))};
 const el=document.querySelector('[data-battle-actor="hero"]');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;let hook=fiber.memoizedState;while(hook&&!(hook.memoizedState?.party&&hook.memoizedState?.columns))hook=hook.next;hook.queue.dispatch(s);
 });
 await page.locator('[data-battle-actor="hero"]').click();await page.locator('[data-skill="summon-cir"]').click();await page.getByRole('button',{name:'Choose target',exact:true}).click();
 assert.equal(await page.locator('[data-foundation-summon-slot]').count(),0);
 await page.locator('[data-skill-target="hero"]').click();await page.locator('.ability-cast').waitFor({state:'detached'});await page.mouse.move(3,3);
 const tile=page.locator('[data-keru-attachment="cir"]');await tile.waitFor();
 for(const width of [1280,390]){
 await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
 const t=await tile.boundingBox(),h=await page.locator('[data-battle-actor="hero"]').boundingBox();
 assert.ok(Math.abs(t.height-h.height/2)<1,JSON.stringify({t,h}));assert.ok(Math.abs(t.width-t.height)<1);assert.ok(t.x>=0&&t.x+t.width<h.x);assert.ok(Math.abs(t.y+t.height/2-h.y-h.height/2)<1);
 assert.equal(await page.locator('[data-buff="cir-companion"]').count(),0);
 const borders=await page.evaluate(()=>[document.querySelector('[data-keru-attachment]'),document.querySelector('[data-battle-actor="hero"]')].map(e=>{const s=getComputedStyle(e);return [s.borderColor,s.borderWidth,s.borderRadius];}));assert.deepEqual(borders[0],borders[1]);
 await page.screenshot({path:`output/keru-attachment-${width}.png`});
 }
 await tile.click();await page.getByRole('button',{name:'Release Cir',exact:true}).click();await tile.waitFor({state:'detached'});
 console.log('PASS: attachment targeting, no summon slot, matching borders, half-height square left of Hero at desktop and phone sizes, inspect/release.');
} finally {await browser?.close();server.kill();}
