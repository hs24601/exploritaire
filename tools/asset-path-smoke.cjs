const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],bad=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)bad.push([r.status(),r.url()]);});
  await page.goto('http://127.0.0.1:5178/proto.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(2500);
  const manifests=await page.evaluate(async()=>{
   const battle=await import('/src/proto/battleSpriteAssets.ts');
   const opening=await import('/src/proto/openingHeroAssets.ts');
   const banks=await import('/src/proto/banksSprite.ts');
   const recipes=await import('/src/proto/biomeCardArt.ts');
   const paths=[...Object.values(battle.BATTLE_SPRITE_ASSETS),...Object.values(battle.PIXEL_BATTLE_SPRITE_ASSETS),...Object.values(battle.HERO_EXPRESSION_ASSETS),...Object.values(opening.OPENING_HERO_ASSETS),...Object.values(banks.BANKS_SPRITE_ASSETS)].map(p=>'/assets/'+p);
   for(const style of ['paint','pixel'])for(const kind of Object.keys(recipes.BIOME_CARD_RECIPES))paths.push(...Object.values(recipes.biomeCardSources(kind,style)).filter(Boolean));
   return Promise.all([...new Set(paths)].map(async src=>{const r=await fetch(src);return {src,ok:r.ok&&!(r.headers.get('content-type')||'').includes('text/html')};}));
  });
  await page.screenshot({path:'artifacts/asset-organization-1280.png'});
  const report={errors,bad,checked:manifests.length,missing:manifests.filter(r=>!r.ok)};
  fs.writeFileSync('artifacts/asset-organization-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(errors.length||bad.length||report.missing.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
