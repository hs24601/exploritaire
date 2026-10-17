const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const url=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
(async()=>{
 fs.mkdirSync('artifacts/hero-faces-v1',{recursive:true});
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:3,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/tools/hero-faces-preview.html',url).href);
  await page.waitForFunction(()=>document.querySelectorAll('canvas').length===8);
  await page.getByRole('button',{name:'Sad',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].every(c=>c.dataset.actorExpression==='sad'));
  for(const pitch of [20,55,90]) {
    await page.getByRole('button',{name:pitch+'°',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('canvas').length===8);
    await page.waitForTimeout(500);
    const views=await page.locator('canvas').evaluateAll(nodes=>nodes.map(n=>({frame:n.dataset.spriteFrame,layer:n.dataset.faceLayer})));
    assert.equal(views.filter(v=>v.layer==='true').length,pitch===90?0:7);
    await page.screenshot({path:`artifacts/hero-faces-v1/registration-${pitch}-3x.png`});
  }
  await page.getByRole('button',{name:'Neutral',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('canvas')].every(c=>c.dataset.faceLayer==='false'));
  assert.deepEqual(errors,[]);await page.close();
  for(const [width,height] of [[1280,720],[1912,914]]) {
   const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:3,reducedMotion:'reduce'});
   p.setDefaultTimeout(15000);
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url);await p.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
   await p.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
   await p.getByRole('button',{name:'Visit denser patch',exact:true}).waitFor({timeout:45000});
   await p.waitForFunction(()=>document.querySelector('[data-callout-id="day01.sparse-patch"] [data-hero-emoji="sad"]') && document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="sad"][data-face-layer="true"]'));
   assert.deepEqual(await findLayoutDefects(p,'.proto-callout-content',{parts:'.proto-callout-expression,.proto-callout-copy'}),[]);
   await p.screenshot({path:`artifacts/hero-faces-v1/day01-${width}-3x.png`});
   await p.locator('[data-actor-id="hero"][data-board-piece="actor"]').screenshot({path:`artifacts/hero-faces-v1/hero-${width}-3x.png`});
   console.log('PASS scene and layout',width);
   const advance=p.locator('[data-callout-id="day01.sparse-patch"] .proto-callout-advance');
   for(let step=0;step<6 && await advance.count();step++) { await advance.click(); await p.waitForTimeout(150); }
   console.log('Closed dialogue',width,await advance.count());
   await p.waitForFunction(()=>document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="neutral"][data-face-layer="false"]'));
   await p.getByRole('button',{name:'Restart scenario',exact:true}).click();
   console.log('Restarted',width);
   await p.getByRole('button',{name:'Visit nearby bush',exact:true}).waitFor();
   if(width===1280) {
     await p.evaluate(()=>localStorage.setItem('exploritaire.callouts.v1',JSON.stringify({'day01.sparse-patch':{text:'Edited expression.',emoji:{actor:'hero',emotion:'happy'},marks:[]}})));
     await p.reload(); await p.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
     await p.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
     await p.getByRole('button',{name:'Visit denser patch',exact:true}).waitFor({timeout:45000});
     await p.waitForFunction(()=>document.querySelector('[data-callout-id="day01.sparse-patch"] [data-hero-emoji="happy"]') && document.querySelector('[data-table-sectional-sprite="hero"] canvas[data-actor-expression="happy"][data-face-layer="false"]'));
     console.log('PASS saved emoji override reaches actor');
   }
   await p.getByLabel('Day scenario',{exact:true}).selectOption('sandbox');
   assert.deepEqual(errors,[]);await p.close();
  }
  console.log('PASS: 24 directional views, expression reset, Day 01 sad face/emoji, close/restart, desktop layout and 3x screenshots');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
