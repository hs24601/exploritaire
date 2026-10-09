// Dark Woods skirmish: the Hero walks into the Dark Woods at (2,1) and a fight
// with the Shadow Wolf starts in the tableau field. Checks the danger embers in
// both cameras, playing a card by tap and by drag (mouse and touch), drawing,
// the wolf eyeing and taking cards, a full fight won by a quick bot, the reward
// and the woods staying quiet afterwards, and the panel's layout at desktop sizes.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const OUT=process.env.SHOTS||'artifacts/combat-skirmish';
const centre=async l=>{const r=await l.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
const fs=require('node:fs');fs.mkdirSync(OUT,{recursive:true});
const walkToDarkWoods=async page=>{
  const a=await centre(page.locator('[data-board-piece="actor"]')),p=await centre(page.locator('[data-biome-id="woods-danger"]'));
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:15});await page.mouse.up();
  await page.locator('.proto-skirmish[data-enemy-hp]').waitFor({timeout:15000});
};
const fightState=page=>page.evaluate(()=>{const f=document.querySelector('.proto-skirmish[data-enemy-hp]');if(!f)return null;
  const hero=+document.querySelector('.proto-skirmish__pile--hero [data-component="playing-card"]').closest('.proto-skirmish__pile').parentElement.closest('.proto-skirmish').querySelector('.proto-skirmish__pile--hero').innerText.trim().replace('A','1').replace('J','11').replace('Q','12').replace('K','13');
  const tops=[...f.querySelectorAll('.proto-skirmish__column')].map(c=>{const el=c.querySelector('[data-top]');const r=el.getBoundingClientRect();const t=el.innerText.trim();return {rank:t==='A'?1:t==='J'?11:t==='Q'?12:t==='K'?13:+t,x:r.x+r.width/2,y:r.y+r.height/2,eyed:Boolean(el.dataset.eyed)};});
  return {enemyHp:+f.dataset.enemyHp,heroHp:+f.dataset.heroHp,fury:+f.dataset.fury,result:f.dataset.result||null,hero,tops};});
const PARTS='.proto-skirmish__foe, .proto-skirmish__who, .proto-skirmish__fury, .proto-skirmish__hp, .proto-skirmish__pile, .proto-skirmish__arena, .proto-skirmish__lair, .proto-skirmish__tableau, .proto-skirmish__column, .proto-skirmish__message, .proto-skirmish__hero, .proto-skirmish__hero-stats, .proto-skirmish__stock, .proto-skirmish__footer, .proto-skirmish__legend, .proto-skirmish__leave';
const adjacent=(a,b)=>a!==b&&(Math.abs(a-b)===1||Math.abs(a-b)===12);
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||undefined});try{
  for(const [w,h] of [[1912,914],[1280,720]]){
    const page=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    await page.goto('http://localhost:5178/proto.html');
    await page.locator('[data-biome-id="woods-danger"]').waitFor();
    // The Dark Woods sit at (2,1) and give off dark red embers even by day, flat.
    assert.equal(await page.locator('[data-biome-id="woods-danger"]').getAttribute('data-grid-reference'),'table:2,1');
    await page.waitForTimeout(400);
    const flatEmbers=await page.locator('.proto-table-air--flat [data-danger="true"]').count();
    assert.ok(flatEmbers>0,'flat camera shows the danger embers');
    await page.screenshot({path:`${OUT}/table-flat-${w}.png`});
    await walkToDarkWoods(page);
    await page.waitForTimeout(300);
    await page.screenshot({path:`${OUT}/fight-start-${w}.png`});
    const defects=await findLayoutDefects(page,'.proto-skirmish',{parts:PARTS});
    assert.deepEqual(defects,[],`layout defects at ${w}x${h}: ${JSON.stringify(defects)}`);
    if(w!==1912){await page.context().close();continue;}
    // Tap a playable card: the wolf loses HP.
    let s=await fightState(page);
    let col=s.tops.findIndex(t=>adjacent(t.rank,s.hero));
    if(col<0){await page.locator('.proto-skirmish__stock').click();s=await fightState(page);col=s.tops.findIndex(t=>adjacent(t.rank,s.hero));}
    if(col>=0){await page.mouse.click(s.tops[col].x,s.tops[col].y);const after=await fightState(page);assert.ok(after.enemyHp<s.enemyHp,'a tapped card strikes');}
    // The wolf eyes a card within a couple of seconds.
    await page.locator('.proto-skirmish__card[data-eyed]').waitFor({timeout:4000});
    await page.screenshot({path:`${OUT}/fight-eye-${w}.png`});
    // A quick bot (mouse drags, then taps) wins the fight.
    let moves=0;const started=Date.now();
    for(;;){s=await fightState(page);if(!s||s.result)break;
      const eyed=s.tops.findIndex(t=>t.eyed&&adjacent(t.rank,s.hero));
      const c=eyed>=0?eyed:s.tops.findIndex(t=>adjacent(t.rank,s.hero));
      if(c>=0){
        if(moves%3===0){const f=await centre(page.locator('.proto-skirmish__pile--hero'));await page.mouse.move(s.tops[c].x,s.tops[c].y);await page.mouse.down();await page.mouse.move(f.x,f.y,{steps:8});await page.mouse.up();}
        else await page.mouse.click(s.tops[c].x,s.tops[c].y);
      } else await page.keyboard.press('Space');
      moves++;await page.waitForTimeout(150);
      if(Date.now()-started>60000)throw new Error('fight took too long');
    }
    s=await fightState(page);
    assert.equal(s.result,'won',`the quick bot wins (hero HP ${s.heroHp})`);
    console.log(`won in ${((Date.now()-started)/1000).toFixed(1)}s with ${s.heroHp} HP, ${moves} moves`);
    await page.screenshot({path:`${OUT}/fight-won-${w}.png`});
    await page.locator('.proto-skirmish__leave').click();
    await page.waitForTimeout(800);
    // Back on the table; returning to the woods today finds them quiet.
    await walkToDarkWoods(page).catch(()=>{});
    await page.locator('.proto-skirmish--quiet').waitFor({timeout:15000});
    await page.screenshot({path:`${OUT}/quiet-${w}.png`});
    // Tilted, the embers stand up over the woods.
    await page.getByRole('button',{name:/tilt/i}).first().click().catch(()=>{});
    await page.waitForTimeout(900);
    assert.ok(await page.locator('.proto-table-air:not(.proto-table-air--flat) [data-danger="true"]').count()>0,'tilted camera shows danger embers');
    await page.screenshot({path:`${OUT}/table-tilt-${w}.png`});
    await page.context().close();
  }
  // Touch: a finger drags a card onto the foundation.
  const ctx=await b.newContext({viewport:{width:1280,height:720},hasTouch:true});const page=await ctx.newPage();
  await page.goto('http://localhost:5178/proto.html');await page.locator('[data-biome-id="woods-danger"]').waitFor();
  await walkToDarkWoods(page);
  const touch=await ctx.newCDPSession(page);
  for(let tries=0;tries<20;tries++){
    const s=await fightState(page);const c=s.tops.findIndex(t=>adjacent(t.rank,s.hero));
    if(c<0){await page.locator('.proto-skirmish__stock').tap();continue;}
    const f=await centre(page.locator('.proto-skirmish__pile--hero'));const a=s.tops[c];
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y}]});
    for(let i=1;i<=10;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(f.x-a.x)*i/10,y:a.y+(f.y-a.y)*i/10}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await fightState(page);assert.ok(after.enemyHp<s.enemyHp,'a touch drag strikes');break;
  }
  console.log('combat skirmish checks passed');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
