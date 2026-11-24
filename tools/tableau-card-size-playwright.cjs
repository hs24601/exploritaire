const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='artifacts/tableau-card-size';
const url=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html?atmosphere=off';
async function enter(page,rest){
  await page.waitForSelector('.proto-game-root');
  await page.evaluate(async rest=>{
    const {arriveActorAtBiome}=await import('/src/proto/biomeArrival.ts');
    const root=document.querySelector('.proto-game-root');
    let fiber=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];
    while(fiber&&fiber.type?.name!=='ProtoVariant')fiber=fiber.return;
    fiber.memoizedState.queue.dispatch(state=>{
      const tile=state.biomeTiles.find(t=>t.id===(rest?'hero-den':'day-one-tree'));
      const next=rest?{...state,ordinaryDay:{...state.ordinaryDay,bedtime:true,supper:true}}:state;
      return arriveActorAtBiome(next,'hero',tile.id,tile.position);
    });
  },rest);
}
async function check(page,scene){
  await page.waitForSelector(scene==='combat'?'.battle-field__column .playing-card':'.proto-tableau-stage .playing-card');
  await page.waitForTimeout(400);
  const sizes=await page.locator('.proto-tableau-field').evaluate(field=>{
    const faces=[...field.querySelectorAll('.proto-occupied-foundation-face,.battle-field__actor-card')].filter(e=>e.offsetWidth&&e.offsetHeight);
    const cards=[...field.querySelectorAll('.proto-tableau-stage .playing-card,.battle-field__column .playing-card')];
    return {faces:faces.map(e=>({w:e.offsetWidth,h:e.offsetHeight})),cards:cards.map(e=>({w:parseFloat(getComputedStyle(e).width),h:parseFloat(getComputedStyle(e).height)}))};
  });
  assert.ok(sizes.faces.length&&sizes.cards.length);
  for(const card of sizes.cards){
    assert.ok(Math.abs(card.w/card.h-63/88)<.002,`${scene} ratio ${JSON.stringify(card)}`);
    for(const face of sizes.faces) assert.ok(card.w<=face.w+1&&card.h<=face.h+1,`${scene} exceeds foundation: ${JSON.stringify({card,face})}`);
  }
  return sizes;
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height] of [[1280,720],[1912,914],[390,844],[844,390]])for(const scene of ['woods','rest','combat']){
      const touch=width<1000;
      const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url+(scene==='combat'?'&combatdemo':''));
      if(scene!=='combat')await enter(page,scene==='rest');
      const sizes=await check(page,scene);
      await page.screenshot({path:`${out}/${width}-${scene}.png`});
      if(scene==='woods'){
        const card=page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
        const count=sizes.cards.length;
        if(touch){const b=await card.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}else await card.click();
        await page.waitForFunction(count=>document.querySelectorAll('.proto-main-tableau .playing-card').length<count,count);
      }
      await page.keyboard.press('Space');await check(page,scene);
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('PASS tableau foundation caps and 63:88 cards: woods/rest/combat, 4 viewport sizes, flat/immersion, mouse/touch play');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
