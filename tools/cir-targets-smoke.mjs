import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5244','--strictPort'],{windowsHide:true});
let browser;
try {
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(t);resolve();}});server.on('exit',()=>reject(Error('Server exited')));});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5244/proto.html?combatsbx&scenario=1002',{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-battle-actor="aldan-seed"]').waitFor({timeout:45000});
 async function state(mode){return page.evaluate(async mode=>{
  const b=await import('/src/proto/rules/battle.ts');
  const el=document.querySelector('[data-battle-actor="aldan-seed"]');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;
  let hook=fiber.memoizedState;while(hook&&!(hook.memoizedState?.party&&hook.memoizedState?.columns))hook=hook.next;
  if(mode==='reset'){let s=b.createCombatSandboxScenario('1002');hook.queue.dispatch({...s,party:s.party.map(a=>({...a,charge:1})),foes:s.foes.map(f=>({...f,hp:100,profile:{...f.profile,maxHp:100}}))});return;}
  const s=hook.memoizedState;return {charge:s.party[0].charge,hp:s.foes[0].hp,kit:s.cirCompanion};
 },mode);}
 async function aim(){await page.locator('[data-battle-actor="aldan-seed"]').click();await page.locator('[data-skill="summon-cir"]').click();await page.getByRole('button',{name:'Choose target',exact:true}).click();await page.locator('[data-familiar-slot="aldan-seed"]').waitFor();}
 await state('reset');await aim();
 assert.equal(await page.locator('[data-foundation-summon-slot]').count(),0);
 assert.equal(await page.locator('[data-skill="cir-emerge"]').count(),0);
 await page.locator('[data-skill-target="aldan-seed"]').hover();assert.match(await page.locator('.ability-fan__armed-preview').innerText(),/Hearthflame/);
 await page.locator('[data-skill-target="aldan-seed"]').click();await page.locator('.ability-cast').waitFor({state:'detached'});
 let s=await state();assert.equal(s.charge,4);assert.equal(s.kit.cooldown,3);assert.equal(await page.locator('[data-familiar-slot]').count(),0);
 await state('reset');await aim();
 const enemyId=await page.evaluate(()=>[...document.querySelectorAll('[data-skill-target]')].map(e=>e.dataset.skillTarget).find(id=>id!=='hero'&&!id.startsWith('familiar:')));
 await page.locator(`[data-skill-target="${enemyId}"]`).hover();assert.match(await page.locator('.ability-fan__armed-preview').innerText(),/Burn/);
 await page.locator(`[data-skill-target="${enemyId}"]`).click();await page.locator('.ability-cast').waitFor({state:'detached'});
 s=await state();assert.equal(s.hp,97);assert.equal(s.kit.cooldown,3);
 await state('reset');await aim();
 await page.locator('[data-skill-target="familiar:aldan-seed"]').hover();assert.match(await page.locator('.ability-fan__armed-preview').innerText(),/Familiarize/);
 await page.locator('[data-skill-target="familiar:aldan-seed"]').click();await page.locator('[data-keru-attachment="cir"]').waitFor();await page.locator('.ability-cast').waitFor({state:'detached'});
 s=await state();assert.equal(s.charge,0);assert.equal(s.kit.form,'familiar');assert.equal(s.kit.pips,0);
 assert.deepEqual(errors,[]);console.log('PASS: ally Hearthflame, enemy Burn, separate familiar placement, target previews, no direct foundation slot, no page errors.');
}finally{await browser?.close();server.kill();}
