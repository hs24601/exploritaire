const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5191/proto.html';
(async()=>{
 fs.mkdirSync('artifacts/art-style',{recursive:true});
 const browser=await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:width===390?844:720}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(URL);
   const cog=page.getByRole('button',{name:'Game settings',exact:true});
   await cog.click();
   const selector=page.getByLabel('Art style', {exact:true});
   assert.equal(await selector.inputValue(),'paint');
   await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"] .proto-sprite-standee__art')?.style.backgroundImage.includes('hero-sleeping-watercolor-v1.png'));
   const panel=await page.locator('.art-settings__panel').boundingBox();
   assert.ok(panel.x>=0&&panel.x+panel.width<=width&&panel.y>=0);
   await page.screenshot({path:`artifacts/art-style/paint-${width}.png`});
   await selector.selectOption('pixel');
   await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"] .proto-sprite-standee__art')?.style.backgroundImage.includes('/deprecated/pixel/characters/hero-sleeping.png'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('exploritaire.artStyle')),'pixel');
   await page.keyboard.press('Escape');assert.equal(await cog.getAttribute('aria-expanded'),'false');
   await page.reload();await cog.click();assert.equal(await selector.inputValue(),'pixel');
   await selector.selectOption('paint');
   await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"] .proto-sprite-standee__art')?.style.backgroundImage.includes('hero-sleeping-watercolor-v1.png'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('exploritaire.artStyle')),'paint');
   await page.mouse.click(5,5);assert.equal(await cog.getAttribute('aria-expanded'),'false');
   if(width===1280) {
    await page.getByRole('checkbox',{name:'Follow traveling actor'}).uncheck();
    const grip=await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2-160,{steps:12});await page.mouse.up();
    await page.waitForSelector('[data-table-sectional-sprite="hero"] canvas',{state:'attached'});
    await cog.click();await selector.selectOption('pixel');
    await page.waitForSelector('[data-table-sectional-sprite="hero"][data-art-style="pixel"] canvas',{state:'attached'});
    await selector.selectOption('paint');
    await page.waitForSelector('[data-table-sectional-sprite="hero"][data-art-style="paint"] canvas',{state:'attached'});
   }
   assert.deepEqual(errors,[]);await context.close();console.log('PASS default, switching, persistence, dismissal, bounds',width);
  }
  const page=await browser.newPage({viewport:{width:1280,height:720}}),assets=[];
  page.on('response',r=>{if(r.url().includes('/deprecated/pixel/characters/battle/')) assets.push(r.url());});
  await page.goto(URL+'?combatdemo');
  await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/dark-slime-directions-v1.png')),page.getByLabel('Art style',{exact:true}).selectOption('pixel')]);
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/dark-slime-directions-watercolor-v1.png')),page.getByLabel('Art style',{exact:true}).selectOption('paint')]);
  assert.ok(assets.some(p=>p.endsWith('/hero-walking-low-v1.png')));
  console.log('PASS combat reloads both atlas sets');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
