import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5246','--strictPort'],{windowsHide:true});let browser;
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(t);resolve();}});server.on('exit',()=>reject(Error('Server exited')));});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(12000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5246/proto.html?combatsbx&scenario=222',{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-vertical-columns]').waitFor({timeout:45000});
 await page.evaluate(async()=>{
  const {createCombatSandboxScenario}=await import('/src/proto/rules/battle.ts');
  const el=document.querySelector('[data-battle-actor="hero"]');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;
  let hook=fiber.memoizedState;while(hook&&!(hook.memoizedState?.party&&hook.memoizedState?.columns))hook=hook.next;
  const s=createCombatSandboxScenario('222');hook.queue.dispatch({...s,party:s.party.map(a=>({...a,rank:2})),columns:s.columns.map((c,i)=>[{id:'row-blocked-'+i,rank:9},{id:'row-outer-'+i,rank:3},{id:'row-middle-'+i,rank:4},{id:'row-inner-'+i,rank:6}])});
 });
 await page.locator('[data-battle-card="row-outer-4"]').waitFor();
 const facts=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  return {cards:[...document.querySelectorAll('[data-battle-card]')].map(e=>({...rect(e),id:e.dataset.battleCard,rank:Number(e.dataset.battleRank),buried:e.dataset.buried,disabled:e.disabled,inaccessible:e.hasAttribute('data-row-inaccessible'),reach:e.dataset.rowReach,z:Number(getComputedStyle(e).zIndex)})),left:[...document.querySelectorAll('[data-vertical-side="left"]')].map(rect),right:[...document.querySelectorAll('[data-vertical-side="right"]')].map(rect),hero:rect(document.querySelector('[data-battle-actor="hero"]')),enemy:rect(document.querySelector('[data-battle-target="khad-root"]'))};
 });
 await mkdir('output',{recursive:true});await page.screenshot({path:'output/vertical-columns-222.png'});
 console.log(JSON.stringify({hero:facts.hero,enemy:facts.enemy,left:facts.left[0],right:facts.right[0]}));
 assert.equal(facts.cards.length,40);assert.equal(facts.left.length,5);assert.equal(facts.right.length,5);assert.equal(facts.cards.filter(c=>c.buried).length,30);assert.equal(facts.cards.filter(c=>c.inaccessible).length,26);assert.equal(facts.cards.filter(c=>c.buried && !c.disabled).length,2);assert.ok(facts.cards.every(c=>c.rank>=1&&c.rank<=13));
 for(let i=0;i<10;i++){const outer=facts.cards.find(c=>c.id==='row-outer-'+i),inner=facts.cards.find(c=>c.id==='row-inner-'+i),middle=facts.cards.find(c=>c.id==='row-middle-'+i);assert.ok(i<5?outer.x<middle.x && middle.x<inner.x:outer.x>middle.x && middle.x>inner.x,'Outer layer is on the correct side at pair '+i);}
 assert.ok(facts.enemy.y+facts.enemy.h<Math.min(...facts.cards.map(c=>c.y)),'Enemy foundation is above the tableau');
 assert.ok(facts.hero.y>Math.max(...facts.cards.map(c=>c.y+c.h)),'Hero foundation is below the tableau');
 assert.ok(Math.abs(facts.right[0].x-facts.left[0].x-facts.left[0].w-facts.hero.w)<2,'Central gap equals foundation width');
 assert.ok(Math.abs((facts.hero.x+facts.hero.w/2)-(facts.enemy.x+facts.enemy.w/2))<3);
 assert.equal(new Set(facts.left.map(r=>Math.round(r.y))).size,5);assert.deepEqual(errors,[]);
 if(process.env.VERTICAL_LAYOUT_ONLY!=='1'){
 await page.locator('[data-battle-card="row-outer-4"]').click();
 assert.equal((await page.locator('[data-battle-actor="hero"] .battle-foundation__value').innerText()).trim(),'3');
 assert.equal(await page.locator('[data-battle-card="row-inner-4"]').count(),1);
 await page.locator('[data-battle-card="row-middle-4"]').click();
 assert.equal((await page.locator('[data-battle-actor="hero"] .battle-foundation__value').innerText()).trim(),'4');
 assert.equal(await page.locator('[data-battle-card="row-inner-4"]').count(),1);
 await page.evaluate(()=>{
  const el=document.querySelector('[data-battle-actor="hero"]');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='BattleTableauField')fiber=fiber.return;
  let hook=fiber.memoizedState;while(hook&&!(hook.memoizedState?.party&&hook.memoizedState?.columns))hook=hook.next;
  hook.queue.dispatch({...hook.memoizedState,turn:'enemy',foes:hook.memoizedState.foes.map(f=>({...f,rest:999}))});
 });
 await page.locator('[data-team-turn="enemy"]').waitFor();
 assert.equal(await page.locator('[data-battle-card="row-outer-0"][data-row-inaccessible]').count(),0);
 assert.equal(await page.locator('[data-battle-card="row-outer-9"][data-row-inaccessible]').count(),1);
 }
 assert.deepEqual(errors,[]);console.log('PASS: eight five-card columns, clickable player-end outer cards, enemy-end reach/dimming, foundations above/below the tableau, no page errors.');
}finally{await browser?.close();server.kill();}
