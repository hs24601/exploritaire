const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='artifacts/tableau-lighting';fs.mkdirSync(out,{recursive:true});
async function enter(page,scene,party){
 await page.waitForSelector('.proto-game-root');
 await page.evaluate(async({scene,party})=>{
  const {arriveActorAtBiome}=await import('/src/proto/biomeArrival.ts');
  const {beginJourney,planTravel,prepareTravelTableau}=await import('/src/proto/travelJourney.ts');
  let fiber=document.querySelector('.proto-game-root');fiber=fiber[Object.keys(fiber).find(k=>k.startsWith('__reactFiber'))];
  while(fiber&&fiber.type?.name!=='ProtoVariant')fiber=fiber.return;
  let hook=fiber.memoizedState;while(hook&&!hook.memoizedState?.worldActors)hook=hook.next;
  if(!hook?.queue)throw Error('Game state hook missing');
  hook.queue.dispatch(state=>{
   if(scene==='travel'){
    const actors=state.worldActors.filter(a=>a.id==='hero'||(party&&a.id==='mochi'));
    const next={...state,worldActors:actors,journey:beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[]))};
    if(party){const hero={...actors.find(a=>a.id==='hero'),partyId:'lighting-test'};next.worldActors=[hero,{...hero,id:'mochi',label:'Mochi'}];}
    return prepareTravelTableau(next);
   }
   const tile=state.biomeTiles.find(t=>t.id===(scene==='rest'?'hero-den':'day-one-tree'));
   return arriveActorAtBiome(scene==='rest'?{...state,ordinaryDay:{...state.ordinaryDay,bedtime:true,supper:true}}:state,'hero',tile.id,tile.position);
  });
 },{scene,party});
 if(await page.getByRole('button',{name:'Tableau',exact:true}).isVisible())await page.getByRole('button',{name:'Tableau',exact:true}).click();
 await page.waitForTimeout(800);
 await page.waitForSelector('.tableau-lighting[data-foundation-lights]:not([data-foundation-lights="0"])');
 await page.waitForTimeout(350);
}
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height] of [[1280,720],[390,844],[844,390]])for(const scene of ['travel','party','woods','rest']){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.goto('http://127.0.0.1:5178/proto.html');await enter(page,scene==='party'?'travel':scene,scene==='party');
  const metrics=()=>page.locator('.proto-tableau-field').evaluate(field=>({
   darkness:Number(field.querySelector('.tableau-lighting').dataset.darkness),
   sources:Number(field.querySelector('.tableau-lighting').dataset.foundationLights),
   cards:[...field.querySelectorAll('.proto-tableau-stage .playing-card')].map(c=>({opacity:Number(getComputedStyle(c).opacity),light:Number(c.style.getPropertyValue('--tableau-card-brightness')),disabled:c.disabled,alpha:getComputedStyle(c).backgroundColor})),
  }));
  const night=await metrics();assert.equal(night.darkness,.66);assert.equal(night.sources,scene==='party'?2:1);assert(night.cards.length);assert(night.cards.every(c=>c.opacity===1&&c.light>.8&&c.light<=1));
  if(scene==='travel')assert(night.cards.some(c=>c.disabled),'test includes currently unplayable cards');
  await page.screenshot({path:`${out}/${width}-${scene}-night.png`});
  await page.locator('button[aria-label="Game settings"]').evaluate(button=>button.click());
  await page.evaluate(()=>{const input=document.querySelector('input[aria-label="Table time of day"]');input[Object.keys(input).find(k=>k.startsWith('__reactProps'))].onChange({target:{value:'12'}});});
  await page.waitForFunction(()=>Number(document.querySelector('.tableau-lighting')?.dataset.darkness)===.04);
  const noon=await metrics();assert(noon.cards.every(c=>c.light===1));
  await page.locator('button[aria-label="Game settings"]').evaluate(button=>button.click());
  await page.evaluate(async()=>{const {setGlobalLightsEnabled}=await import('/src/proto/globalLighting.ts');setGlobalLightsEnabled(false);});
  await page.waitForFunction(()=>document.querySelector('.tableau-lighting')?.dataset.darkness==='0');
  const bright=await metrics();assert(bright.cards.every(c=>c.opacity===1&&c.light===1));
  await page.screenshot({path:`${out}/${width}-${scene}-bypass.png`});
  assert.deepEqual(errors,[]);console.log('PASS opaque cards, foundation light, noon and global bypass',width,height,scene);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
