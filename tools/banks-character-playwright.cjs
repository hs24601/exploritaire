const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 fs.mkdirSync('artifacts/banks-watercolor-v3',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BANKS_REVIEW_URL || 'http://127.0.0.1:5189/tools/banks-character.html'));
 await page.locator('.banks-rig canvas[data-pose]').waitFor();await page.locator('.layered-card-art__subject').evaluate(i=>i.decode());
 const results=[];
 for(const pose of ['sitting','standing','walking','flinch','down']){
  await page.getByRole('button',{name:pose,exact:true}).click();
  for(const tier of ['Low','Elevated','Overhead']){
   await page.getByRole('button',{name:tier,exact:true}).click();
   for(const heading of [0,45,90,135,180,225,270,315]){
    await page.getByRole('slider',{name:'Facing'}).fill(String(heading));
    await page.waitForTimeout(35);
    const frame=await page.locator('.banks-rig canvas').getAttribute('data-frame');assert.ok(frame);results.push({pose,tier,heading,frame});
   }
   await page.getByRole('slider',{name:'Facing'}).fill('45');await page.waitForTimeout(60);
   await page.locator('.banks-rig').screenshot({path:`artifacts/banks-watercolor-v3/${pose}-${tier.toLowerCase()}.png`});
  }
 }
 await page.getByRole('button',{name:'walking',exact:true}).click();const phases=new Set();for(let i=0;i<12;i++){await page.waitForTimeout(80);phases.add(await page.locator('.banks-rig canvas').getAttribute('data-phase'));}assert.equal(phases.size,4);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);assert.equal(await page.locator('.banks-rig canvas').getAttribute('data-phase'),'0');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:'sitting',exact:true}).click();await page.getByRole('button',{name:'Low',exact:true}).click();await page.waitForTimeout(100);
 await page.screenshot({path:'artifacts/banks-watercolor-v3/character-1280.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 await page.screenshot({path:'artifacts/banks-watercolor-v3/character-390.png'});
 assert.deepEqual(errors,[]);assert.equal(await page.locator('.banks-rig[data-error]').count(),0);
 fs.writeFileSync('artifacts/banks-watercolor-v3/validation.json',JSON.stringify({views:results,walkingPhases:[...phases],reducedMotion:true,errors},null,2));
 console.log('Validated 120 pose/view/heading combinations, four gait phases, reduced motion, desktop/mobile fit and holocard assets.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
