const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const label=rank=>({1:'A',11:'J',12:'Q',13:'K'}[rank]??String(rank));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  let unique;
  for(let attempt=0;attempt<20;attempt++){
   await page.goto('http://127.0.0.1:5202/proto.html?combatsbx&scenario=1000');
   await page.locator('[data-battle-slot="hero"]').waitFor();
   unique=await page.locator('[data-battle-depth="2"][data-split-card]').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.battleCard,ranks:Array.from(node.querySelectorAll('[data-split-rank]')).map(el=>Number(el.dataset.splitRank))})).find(card=>card.ranks.filter(rank=>[1,3].includes(rank)).length===1));
   if(unique)break;
  }
  assert.ok(unique);
  assert.equal(await page.locator('.battle-field__rack [data-split-card]').count(),18);
  assert.equal(await page.locator('.battle-spatial-lane').count(),0);
  const pairs=await page.locator('.battle-field__rack [data-split-card]').evaluateAll(nodes=>nodes.map(node=>Array.from(node.querySelectorAll('[data-split-rank]')).map(el=>Number(el.dataset.splitRank))));
  assert.ok(pairs.every(([a,b])=>![0,1,12].includes(Math.abs(a-b))));
  fs.mkdirSync('artifacts/split-cards',{recursive:true});await page.screenshot({path:'artifacts/split-cards/initial.png'});
  await page.locator(`[data-battle-card="${unique.id}"]`).click();await page.mouse.move(3,3);
  assert.equal(await page.locator('[data-battle-slot="hero"] .battle-foundation__value').textContent(),label(unique.ranks.find(rank=>[1,3].includes(rank))));
  assert.equal(await page.locator('.split-card-choice').count(),0);
  assert.equal(await page.locator('[data-battle-slot="hero"] .battle-foundation__ap-pips i[data-on]').count(),1);
  await page.locator('[data-battle-actor="hero"]').click();
  await page.locator('.ability-fan [data-skill="summon-riv"]').click();
  await page.locator('[data-skill-target="new-foundation"]').click();await page.mouse.move(3,3);
  await page.locator('[data-battle-slot="riv"]').waitFor();await page.locator('.ability-cast').waitFor({state:'detached'});
  const source=page.locator('[data-battle-depth="2"][data-split-card]').first();
  const id=await source.getAttribute('data-battle-card'),ranks=await source.locator('[data-split-rank]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.splitRank)));
  const from=await source.boundingBox(),to=await page.locator('[data-battle-actor="riv"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.waitForTimeout(100);await page.mouse.up();await page.mouse.move(3,3);
  const choice=page.getByRole('group',{name:'Choose card value',exact:true});await choice.waitFor();
  assert.equal(await page.locator(`[data-battle-card="${id}"]`).count(),1,'choice does not consume the card');
  await page.screenshot({path:'artifacts/split-cards/choice.png'});
  await choice.getByRole('button',{name:'Play '+label(ranks[1]),exact:true}).click();await page.mouse.move(3,3);
  assert.equal(await page.locator('[data-battle-slot="riv"] .battle-foundation__value').textContent(),label(ranks[1]));
  assert.equal(await page.locator('[data-battle-slot="riv"] .battle-foundation__ap-pips i[data-on]').count(),1);
  assert.equal(await page.locator('[data-battle-slot="riv"] [data-status="wild"]').count(),0);
  assert.equal(await page.locator('.battle-field__rack [data-split-card]').count(),18);
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/split-cards/1280.png'});
  await page.keyboard.press('Space');await page.locator('.battle-intent-slot').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: valid dual pairs, sole outcome auto-play, Riv wildcard value choice, one receipt, drag, small viewport and enemy cast');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
