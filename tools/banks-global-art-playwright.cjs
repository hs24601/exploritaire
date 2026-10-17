const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const origin=process.env.BANKS_REVIEW_ORIGIN||'http://127.0.0.1:5192';
(async()=>{const browser=await chromium.launch();try{
 fs.mkdirSync('artifacts/banks-watercolor-v3',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/tools/banks-emojis-preview.html');
 const emojis=page.locator('[data-banks-emoji]');await emojis.first().waitFor();assert.equal(await emojis.count(),27);
 await page.locator('svg image').first().evaluate(async node=>{const image=new Image();image.src=node.getAttribute('href');await image.decode();});
 assert.equal(await page.locator('[data-banks-emoji="fighting"]').count(),3);
 const assets=await page.evaluate(async()=>{
  const {BANKS_SPRITE_ASSETS}=await import('/src/proto/banksSprite.ts');
  const {BANKS_EMOJI_SHEET,BANKS_EMOJI_EMOTIONS,banksEmojiImage}=await import('/src/proto/banksEmojis.ts');
  const {BANKS_NUZZLE_ART}=await import('/src/proto/banksCinemaArt.ts');
  const {ACTOR_HOLO_ART,ACTOR_HOLO_LAYERS}=await import('/src/proto/art/actorCardArt.ts');
  const urls=[...Object.values(BANKS_SPRITE_ASSETS).map(path=>'/assets/'+path),BANKS_EMOJI_SHEET,...BANKS_EMOJI_EMOTIONS.map(banksEmojiImage),BANKS_NUZZLE_ART,ACTOR_HOLO_ART.banks,ACTOR_HOLO_LAYERS[ACTOR_HOLO_ART.banks].subject];
  return await Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};}));
 });
 assert.equal(assets.length,21);assert.ok(assets.every(asset=>asset.width>0&&asset.height>0));
 await page.screenshot({path:'artifacts/banks-watercolor-v3/expressions-desktop.png',fullPage:true});
 const checks=[];
 for(const [width,height,reduced]of [[1280,800,false],[390,844,true],[844,390,true]]){
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await page.goto(origin+'/tools/banks-rescue-preview.html');
  await page.locator('[data-cinema-nuzzle-preload]').evaluate(img=>img.decode());
  const preload=await page.locator('[data-cinema-nuzzle-preload]').getAttribute('src');assert.match(preload,/nuzzle-v2\.png$/);
  // Keep normal authored beat timing and ordinary dialogue/solver actions.
  for(let i=0;i<260;i++){
   const beat=await page.locator('[data-cinema-beat]').getAttribute('data-cinema-beat');if(beat==='nuzzle')break;
   const next=page.getByRole('button',{name:'Continue',exact:true});if(await next.count())await next.click();await page.waitForTimeout(100);
  }
  assert.equal(await page.locator('[data-cinema-beat]').getAttribute('data-cinema-beat'),'nuzzle');
  const painting=page.locator('.cinema-nuzzle>div');await painting.waitFor();
  const dimensions=await painting.evaluate(node=>{const b=node.getBoundingClientRect();return {width:b.width,height:b.height,image:getComputedStyle(node).backgroundImage};});
  assert.match(dimensions.image,/nuzzle-v2\.png/);assert.ok(Math.abs(dimensions.width/dimensions.height-1.2)<.02);
  await page.getByRole('button',{name:'Pause cinema',exact:true}).click();
  const before=await painting.evaluate(node=>getComputedStyle(node).backgroundPosition);await page.waitForTimeout(350);
  assert.equal(await painting.evaluate(node=>getComputedStyle(node).backgroundPosition),before);
  if(reduced)assert.equal(await painting.evaluate(node=>getComputedStyle(node).animationName),'none');
  await page.screenshot({path:`artifacts/banks-watercolor-v3/protective-rescue-${width}.png`});
  for(const portrait of await page.locator('.cinema-foundations .actor-holocard').all()){
   const bounds=await portrait.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
   assert.ok(Math.abs(bounds.width/bounds.height-63/88)<.03,JSON.stringify({width,height,bounds}));
  }
  const tableau=await page.locator('.banks-rescue-cinema__tableaus').boundingBox();
  for(const status of await page.locator('.cinema-foundations>div>span:last-child').all()){
   const bounds=await status.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=tableau.y&&bounds.y+bounds.height<=tableau.y+tableau.height,JSON.stringify({width,height,status:bounds,tableau}));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  checks.push({width,height,reduced,dimensions,pause:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/banks-watercolor-v3/global-art-validation.json',JSON.stringify({assets,expressions:9,sizes:[192,64,32],checks,errors},null,2));
 console.log('Nine expressions and production paired rescue passed desktop/mobile/landscape fit, frame aspect, pause and reduced motion.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
