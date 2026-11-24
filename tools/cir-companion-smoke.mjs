import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const {findLayoutDefects}=createRequire(import.meta.url)('./lib/layout-check.cjs');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5229','--strictPort'],{windowsHide:true});let browser;
try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>reject(Error(`Vite exited ${code}`)));});
  browser=await chromium.launch({headless:true});const p=await browser.newPage({reducedMotion:'reduce'}),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  fs.mkdirSync('output/cir-first-pass',{recursive:true});
  // Install deterministic rule-produced states through React's existing state
  // queue, only in this test. Production has no fixture/global/debug endpoint.
  const fixture=async(mode)=>{
    await p.evaluate(async mode=>{
      const b=await import('/src/proto/rules/battle.ts'),c=await import('/src/proto/rules/cirCompanion.ts'),statuses=await import('/src/proto/rules/battleStatuses.ts');
      let s=b.createCombatSandboxScenario('1002');s={...s,party:s.party.map(a=>({...a,hp:30,charge:6})),foes:s.foes.map(f=>({...f,hp:500,profile:{...f.profile,maxHp:500}}))};
      if(mode!=='available')s=b.useMomentumSkill(s,'summon-cir','new-foundation');
      if(['rich','meteor','ready'].includes(mode))s={...s,party:s.party.map(a=>a.id==='cir'?{...statuses.withStatus(a,{id:'swift-wings',stacks:mode==='rich'?1:4}),charge:10}:a)};
      if(['meteor','ready'].includes(mode))s=b.useMomentumSkill(s,'meteor-launch','cir');
      if(mode==='ready')for(let i=0;i<3;i++)s=b.returnPlayerTurn(s);
      const el=document.querySelector('[data-battle-actor="hero"]');let fiber=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
      while(fiber && fiber.type?.name!=='BattleTableauField')fiber=fiber.return;
      if(!fiber)throw Error('Battle field React fiber missing');let hook=fiber.memoizedState;
      while(hook && !(hook.memoizedState?.party && hook.memoizedState?.columns))hook=hook.next;
      if(!hook?.queue?.dispatch)throw Error('Battle state queue missing');hook.queue.dispatch(s);
    },mode);
    await p.waitForTimeout(150);
  };
  const cast=async(id,target)=>{
    await p.locator(`[data-skill="${id}"]`).click();await p.getByRole('button',{name:'Choose target',exact:true}).click();
    if(id==='summon-cir'){
      const hero=await p.locator('[data-battle-actor="hero"]').boundingBox(),slot=await p.locator('[data-foundation-summon-slot]').boundingBox();
      assert.ok(Math.abs(hero.y-slot.y)<2 && Math.abs(hero.y+hero.height-slot.y-slot.height)<2,`Summon slot must align with Hero: ${JSON.stringify({hero,slot})}`);
      const gauge=await p.locator('.battle-momentum-overlay .momentum-engine__chamber').boundingBox();
      assert.ok(Math.min(slot.x+slot.width,gauge.x+gauge.width)<=Math.max(slot.x,gauge.x) || Math.min(slot.y+slot.height,gauge.y+gauge.height)<=Math.max(slot.y,gauge.y),'Momentum must not cover the summon target');
      if(target==='new-foundation')await p.screenshot({path:`output/cir-first-pass/summon-target-${p.viewportSize().width}.png`});
    }
    await p.locator(`[data-skill-target="${target}"]`).click();await p.mouse.move(3,3);await p.locator('.ability-cast').waitFor({state:'detached'});
  };
  const zoomShot=async(selector,name,width,height)=>{
    const cdp=await p.context().newCDPSession(p),box=await p.locator(selector).boundingBox();
    const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...box,scale:3}});
    fs.writeFileSync(`output/cir-first-pass/${name}-3x.png`,Buffer.from(shot.data,'base64'));await cdp.detach();
  };
  for(const [width,height] of (process.argv.includes('--tight')?[[390,844],[844,390]]:[[1440,1000],[1280,720],[390,844],[844,390]])){
    console.log(`Checking ${width}×${height}`);
    await p.setViewportSize({width,height});await p.goto('http://127.0.0.1:5229/proto.html?combatsbx&scenario=1002',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('[data-battle-actor="hero"]').waitFor({timeout:60000});await fixture('available');
    if(await p.locator('.scenario-notes__title[aria-expanded="true"]').count())await p.locator('.scenario-notes__title').click();
    assert.equal(await p.locator('[data-battle-actor="hero"] .element-glyph').count(),0);
    await p.locator('[data-battle-actor="hero"]').click();assert.equal(await p.locator('[data-skill="draft-cir"]').count(),0);
    assert.match(await p.locator('[data-skill="summon-cir"]').getAttribute('aria-label'),/1 Hero AP/);
    await cast('summon-cir','hero');await p.locator('[data-buff="cir-companion"]').waitFor();
    assert.equal(await p.locator('[data-battle-actor="hero"] .battle-bar__temp-hp').count(),1);
    assert.match(await p.locator('[data-battle-actor="hero"]').innerText(),/30\/40 \+5/);
    await p.screenshot({path:`output/cir-first-pass/familiar-${width}.png`});
    const bar=p.locator('[data-battle-actor="hero"] [data-bar="hp"]');await bar.screenshot({path:`output/cir-first-pass/hp-${width}.png`,scale:'css'});
    if(width===1440)await zoomShot('[data-battle-actor="hero"] [data-bar="hp"]','hp',width,height);
    await p.locator('[data-buff="cir-companion"]').click();await p.getByRole('button',{name:'Release Cir',exact:true}).click();await p.keyboard.press('Escape');
    assert.equal(await p.locator('[data-battle-actor="hero"] .battle-bar__temp-hp').count(),0);
    await p.locator('[data-battle-actor="hero"]').click();await cast('summon-cir','new-foundation');await p.locator('[data-battle-actor="cir"]').waitFor();
    {const hero=await p.locator('[data-battle-actor="hero"]').boundingBox(),cir=await p.locator('[data-battle-actor="cir"]').boundingBox();assert.ok(Math.abs(hero.y-cir.y)<2,'Existing Hero and Cir foundations must align');}
    assert.equal(await p.locator('[data-battle-actor="cir"] .element-glyph').count(),2);
    {const cir=await p.locator('[data-battle-actor="cir"]').boundingBox(),gauge=await p.locator('.battle-momentum-overlay .momentum-engine__chamber').boundingBox();assert.ok(Math.min(cir.x+cir.width,gauge.x+gauge.width)<=Math.max(cir.x,gauge.x) || Math.min(cir.y+cir.height,gauge.y+gauge.height)<=Math.max(cir.y,gauge.y),'Momentum must not cover Cir');}
    {const notes=await p.locator('.scenario-notes__title').boundingBox(),gauge=await p.locator('.battle-momentum-overlay .momentum-engine__chamber').boundingBox();assert.ok(Math.min(notes.x+notes.width,gauge.x+gauge.width)<=Math.max(notes.x,gauge.x) || Math.min(notes.y+notes.height,gauge.y+gauge.height)<=Math.max(notes.y,gauge.y),'Momentum must not cover the notes title');}
    assert.deepEqual(await findLayoutDefects(p,'[data-battle-slot="cir"]',{parts:'.cir-release',minFontSize:16}),[]);
    await fixture('rich');await p.locator('[data-battle-actor="cir"]').click();
    assert.match(await p.locator('[data-skill="swift-wings"]').getAttribute('aria-label'),/2 Cir AP/);
    await p.screenshot({path:`output/cir-first-pass/hand-${width}.png`});
    if(width===1440)await zoomShot('[data-skill="swift-wings"]','wings',width,height);
    await cast('swift-wings','cir');assert.match(await p.locator('[data-status="swift-wings"]').getAttribute('aria-label'),/2/);
    await fixture('meteor');await p.locator('.cir-meteor-foundation').waitFor();assert.match(await p.locator('.cir-meteor-foundation').getAttribute('aria-label'),/0\/3/);
    assert.equal(await p.locator('[data-battle-actor="cir"]').count(),0);
    assert.deepEqual(await findLayoutDefects(p,'[data-battle-slot="cir-meteor"]',{parts:'.cir-meteor-foundation',minFontSize:16}),[]);
    await p.screenshot({path:`output/cir-first-pass/meteor-${width}.png`});
    if(width===1440)await zoomShot('.cir-meteor-foundation','meteor',width,height);
    await fixture('ready');await p.locator('.cir-meteor-foundation').click();await cast('meteor-impact',(await p.locator('[data-team="enemy"] [data-battle-target]').first().getAttribute('data-battle-target')));
    await p.waitForFunction(()=>!document.querySelector('.cir-meteor-foundation'));
  }
  assert.deepEqual(errors,[]);console.log(`PASS: Cir familiar/summon targeting, shield, affinity, release, spell hand, variable Wings cost, Meteor charge and cast; ${process.argv.includes('--tight')?2:4} viewports; layout checks; no page errors.`);
} finally {if(browser)await browser.close();server.kill();}
