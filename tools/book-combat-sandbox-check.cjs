const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.addInitScript(()=>addEventListener('book:combat-sandbox-ready',e=>{window.arena=e.detail}));
  await page.goto('http://localhost:5183/book.html?combatsbx');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.sandbox==='combat',null,{timeout:60000});
  assert.equal(await page.locator('canvas').getAttribute('data-trees'),'58');
  assert.equal(await page.locator('canvas').getAttribute('data-pages-open'),'true');
  assert.equal(await page.locator('#book-navigator').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>({id:arena.id,hero:arena.hero.position.x,enemy:arena.enemy.position.x})),{id:'combat-01',hero:-1.175,enemy:1.175});
  for(const [name,width,height] of [['desktop',1280,800],['mobile',390,844]]) {
   await page.setViewportSize({width,height});await page.waitForTimeout(800);
   const box=await page.locator('canvas').boundingBox();assert.equal(box.width,width);assert.equal(box.height,height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(name==='mobile'){assert.equal(await page.locator('canvas').getAttribute('data-composition'),'combat-focus');await page.getByLabel('Arena framing and quality').click();await page.getByLabel('Arena composition').selectOption('arena');}
   // Whole-arena mode still fits the complete open spread on either device.
   const extent=await page.evaluate(()=>{const points=[];arena.camera.updateMatrixWorld();for(const x of [-6.05,6.05])for(const z of [-3.95,3.95]){const v=arena.camera.position.clone().set(x,.16,z).project(arena.camera);points.push({x:v.x,y:v.y})}return points});
   assert(extent.every(p=>Math.abs(p.x)<.97&&Math.abs(p.y)<.97),JSON.stringify(extent));
   await page.screenshot({path:`output/book/combat-sandbox-${name}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS combat sandbox query, readiness hook, 58-tree arena, opposing combatants, desktop/mobile fit, no overflow or browser errors');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
