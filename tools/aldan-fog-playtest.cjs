const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const key = 'exploritaire.roam-demi.v1', dir = 'output/aldan-fog';
const read = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
async function fixture(p, kind, won = false) {
  await p.evaluate(async ({key,kind,won}) => {
    const m = await import('/src/expedition/roamRescue.ts');
    let s=m.initialRoamRescue();
    if(kind==='frost') { s={...s,pendingFrost:'west-frost',cleared:['west-void']}; }
    else {
      s=m.roamRescueReducer(s,{type:'step',position:m.cellPoint(kind==='red'?-4:-2,kind==='red'?1:0)});
      if(kind==='buff') s.encounter.battle.party[0]={...s.encounter.battle.party[0],lightMotes:{'frost-mote':2},iceRewards:['heart-of-the-phoenix'],iceRewardTiers:{'heart-of-the-phoenix':1},phoenixRecharge:0};
      if(won) { s.encounter.battle.result='won'; s.encounter.battle.foes=s.encounter.battle.foes.map(f=>({...f,hp:0})); }
    }
    localStorage.setItem(key,JSON.stringify(s));
  },{key,kind,won});
  await p.reload(); await p.locator('.roam-rescue').waitFor();
}
(async()=>{
  fs.mkdirSync(dir,{recursive:true});
  const browser=await chromium.launch({headless:true});
  try {
    const p=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce',hasTouch:true});
    p.setDefaultTimeout(12000); const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://127.0.0.1:5178/aldan.html'); await p.locator('.fog-map').waitFor();
    assert.equal(await p.locator('canvas,.proto-map').count(),0,'Map does not mount a rendering engine');
    assert.equal(await p.locator('[data-fog=hidden]').count()>60,true);
    await p.locator('[data-cell="-1,1"]').click();
    await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).visited.includes('-1,1'),key);
    // Actual drag from Hero to a discovered tile.
    const a=await p.locator('[data-hero=true]').boundingBox(), b=await p.locator('[data-cell="-2,1"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2); await p.mouse.down(); await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5}); await p.mouse.up();
    await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).visited.includes('-2,1'),key);
    await p.locator('[data-cell="-2,0"]').tap(); await p.locator('.battle-field').waitFor();
    await p.getByRole('button',{name:'END TURN',exact:true}).click();
    await p.locator('.combat-banner[data-kind=party]').waitFor();
    await p.screenshot({path:dir+'/turn-banner.png'});
    console.log('PASS: map has no canvas, fog discovery, mouse drag, touch travel and turn banner');
    await fixture(p,'red',true); await p.locator('.rescue-reward').waitFor();
    assert(!(await read(p)).hero.iceRewards.includes('heart-of-the-phoenix'));
    await p.getByRole('button',{name:'Inspect Heart of the Phoenix',exact:true}).tap();
    await p.getByRole('dialog',{name:'Heart of the Phoenix jumbo card'}).waitFor();
    await p.screenshot({path:dir+'/phoenix-jumbo.png'});
    await p.getByRole('button',{name:'Apply reward',exact:true}).click();
    await p.locator('.fog-map').waitFor();
    assert((await read(p)).hero.iceRewardTiers['heart-of-the-phoenix']>=1);
    assert.equal((await read(p)).supplyHaul.wood,3);
    await fixture(p,'frost'); await p.locator('.rescue-reward__apply').tap();
    await p.locator('.rescue-reward').waitFor({state:'detached'});
    assert.equal((await read(p)).hero.lightMotes['frost-mote'],1);
    console.log('PASS: single reward card, jumbo application, Rare+ Phoenix, supplies and explicit Frost claim');
    await fixture(p,'buff');
    const buff=p.locator('[data-status=frost-mote]'); await buff.waitFor();
    const box=await buff.boundingBox(); await p.mouse.move(box.x+box.width/2,box.y+box.height/2); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up();
    await p.locator('.buff-card-preview').waitFor();
    await p.screenshot({path:dir+'/buff-nearby.png'});
    await p.locator('.buff-card-preview__card').tap(); await p.locator('.card-jumbo').waitFor();
    await p.getByRole('button',{name:'Close jumbo card'}).click();
    await p.getByRole('button',{name:'Close buff card'}).click();
    const phoenix=p.locator('[data-status=phoenix]');
    await phoenix.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:12,clientX:100,clientY:100,bubbles:true});
    await p.waitForTimeout(600); await phoenix.dispatchEvent('pointerup',{pointerType:'touch',pointerId:12,bubbles:true});
    await p.locator('.buff-card-preview').waitFor();
    await p.locator('.buff-card-preview__card').tap(); await p.locator('.card-jumbo').waitFor();
    console.log('PASS: mouse/touch buff hold opens nearby card, tap enlarges');
    await p.getByRole('button',{name:'Close jumbo card'}).click(); await p.getByRole('button',{name:'Close buff card'}).click();
    for(const [name,size] of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]) {
      await p.setViewportSize(size); await fixture(p,'frost');
      const defects=await findLayoutDefects(p,'.rescue-reward',{parts:'.rescue-reward__card,.rescue-reward>p,.rescue-reward__apply'});
      assert.deepEqual(defects,[],name+' reward layout');
      await p.screenshot({path:`${dir}/${name}-reward.png`});
      await p.locator('.rescue-reward__apply').tap();
      assert.deepEqual(await findLayoutDefects(p,'.fog-map__tiles',{parts:'button'}),[],name+' map layout');
      await p.screenshot({path:`${dir}/${name}-map.png`});
    }
    assert.deepEqual(errors,[]); console.log('PASS: shared layout checks at desktop, phone and landscape; no page errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
