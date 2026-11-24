const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ headless:true, executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe' });
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror', e => console.error('PAGE ERROR',e.stack));
  await page.goto((process.env.PROTO_URL ?? 'http://127.0.0.1:5202/proto.html')+'?combatsbx&scenario=1001');
  await page.locator('[data-battle-slot="hero"]').waitFor();
  let path;
  for(let attempt=0;attempt<20;attempt++) {
   const columns=await page.locator('[data-lane="frontier"] .battle-field__column, [data-lane="party-rear"] .battle-field__column').evaluateAll(nodes=>nodes.map(node=>Array.from(node.querySelectorAll('[data-battle-card]')).map(card=>({id:card.dataset.battleCard,rank:Number(card.dataset.battleRank)}))));
   function search(cols,rank,left) { if(!left)return [];for(let c=0;c<cols.length;c++){const card=cols[c][cols[c].length-1];if(!card || ![1,12].includes(Math.abs(card.rank-rank)))continue;const copy=cols.map(col=>col.slice());copy[c].pop();const tail=search(copy,card.rank,left-1);if(tail)return [card.id,...tail];}return null; }
   path=search(columns,2,3);if(path)break;
   await page.reload();await page.locator('[data-battle-slot="hero"]').waitFor();
  }
  assert.ok(path,'the fixed lab opening with a three-card Hero chain');
  for(const id of path) {await page.locator('[data-battle-card="'+id+'"]').click();await page.mouse.move(3,3);await page.waitForTimeout(160);}
  assert.equal(await page.locator('[data-battle-slot="hero"] .battle-foundation__ap-pips i[data-on]').count(),6);
  await page.locator('[data-battle-actor="hero"]').click();
  const summon=page.locator('.ability-fan [data-skill="hold"]');
  await summon.waitFor();
  assert.ok((await summon.textContent()).includes('Summon: Dem'));
  await summon.click();
  await page.locator('.ability-fan__target[data-skill-target="new-foundation"]').click();
  await page.mouse.move(3,3);
  await page.locator('[data-battle-slot="dem"]').waitFor();
  assert.equal(await page.locator('.battle-hold-slot').count(),0);
  assert.equal(await page.locator('[data-battle-slot="dem"] .battle-foundation__value').textContent(),'A');
  require('node:fs').mkdirSync('artifacts/summon-dem',{recursive:true});
  await page.locator('.ability-cast').waitFor({state:'detached'});
  await page.screenshot({path:'artifacts/summon-dem/foundation.png'});
  await page.getByRole('button',{name:'Load battle camera',exact:true}).click();
  await page.locator('[data-scene-target="dem"]:not([hidden])').waitFor({timeout:60000});
  assert.equal(await page.getByRole('alert').count(),0);
  await page.screenshot({path:'artifacts/summon-dem/arena.png'});
  console.log('PASS: banked 6 AP, cast Summon: Dem, friendly Dem foundation at Ace, no Hold slot');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
