const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const [width,height,touch] of [[1280,720,false],[1912,914,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PROTO_URL||'http://localhost:5178/proto.html');
  await page.getByRole('button',{name:'Visit nearby bush',exact:true}).waitFor();
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('[data-manaberry-glow="standee"]').count(),1);
  assert.match(await page.locator('.day-cinema-grade').evaluate(el=>getComputedStyle(el).backgroundImage),/radial-gradient/);
  await page.screenshot({path:`artifacts/blue-berry-${width}-opening-3x.png`});
  assert.deepEqual(await findLayoutDefects(page,'.proto-day-panel',{parts:'button,select'}),[]);
  assert.deepEqual(await findLayoutDefects(page,'.day-objective',{parts:'button'}),[]);
  await page.getByRole('button',{name:'Flat camera view',exact:true}).click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-manaberry-glow="overhead"]').count(),1);
  await page.screenshot({path:`artifacts/blue-berry-${width}-overhead-3x.png`});
  const visit=page.getByRole('button',{name:'Visit nearby bush',exact:true});
  if(touch)await visit.tap();else await visit.click();
  await page.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.proto-day-panel button')].some(b=>b.textContent==='Visit denser patch'&&!b.disabled),{},{timeout:45000});
  assert.equal(await page.locator('[data-manaberry-glow]').count(),0);
  assert.match(await page.locator('.proto-day-panel').innerText(),/Mana 1/);
  assert.deepEqual(errors,[]);
  console.log('PASS',width,'blue glow in immersion/OTT, layout, finite harvest extinguishes glow, no browser errors');
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
