const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PROTO_URL || 'http://localhost:5186/proto.html', {waitUntil:'domcontentloaded'});
  const edit=page.getByRole('button',{name:'Edit tiles',exact:true});await edit.waitFor();
  const a=await edit.boundingBox(), b=await page.getByRole('button',{name:'Game settings',exact:true}).boundingBox();
  assert(a.x+a.width<=b.x); assert.equal((await edit.innerText()).trim(),'');
  await page.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
  await page.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
  console.log('Travel solver started');
  await page.locator('.proto-callout').waitFor({state:'visible',timeout:60000});
  const original=await page.locator('.proto-callout-text').innerText();
  console.log('Harvest callout visible');
  await edit.click(); await page.getByRole('button',{name:'Edit callout',exact:true}).click();
  const input=page.getByLabel('Callout text',{exact:true});await input.fill('Keep this light for tomorrow.');
  await input.press('Control+Home');
  for(let i=0;i<10;i++) await input.press('ArrowRight');
  for(let i=0;i<5;i++) await input.press('Shift+ArrowRight');
  await page.getByRole('button',{name:'Glow',exact:true}).click();
  await page.getByRole('button',{name:'sad',exact:true}).click();
  assert.equal(await page.locator('.callout-editor-preview .callout-fx--glow').innerText(),'light');
  await page.screenshot({path:'artifacts/callout-editor-desktop.png'});
  await page.getByRole('button',{name:'Save callout',exact:true}).click();
  assert.equal(await page.locator('.proto-callout-text').innerText(),'Keep this light for tomorrow.');
  assert.equal(await page.locator('.proto-callout .callout-fx--glow').innerText(),'light');
  assert.equal(await page.locator('.proto-callout [data-hero-emoji="sad"]').count(),1);
  await page.getByRole('button',{name:'Edit callout',exact:true}).click();await input.fill('Discard me');await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.locator('.proto-callout-text').innerText(),'Keep this light for tomorrow.');
  await page.getByRole('button',{name:'Edit callout',exact:true}).click();
  for(const width of [390,320]) {
   await page.setViewportSize({width,height:844});
   const box=await page.locator('.callout-editor').boundingBox();assert(box.x>=0&&box.x+box.width<=width);
   assert.equal(await page.locator('.callout-editor').evaluate(el=>el.scrollWidth>el.clientWidth),false);
   await page.screenshot({path:`artifacts/callout-editor-${width}.png`});
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Close tile editor',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Edit callout',exact:true}).count(),0);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
  await page.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
  await page.locator('.proto-callout').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('.proto-callout-text').innerText(),'Keep this light for tomorrow.');
  await edit.click();await page.getByRole('button',{name:'Edit callout',exact:true}).click();
  await page.getByRole('button',{name:'Restore original',exact:true}).click();
  assert.equal(await page.locator('.proto-callout-text').innerText(),original);
  assert.deepEqual(errors,[]);
  console.log('PASS toolbar order, retained active callout, emoji, word effects, preview, save, cancel, mobile fit, Escape, reload persistence and restore.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

