const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({ viewport: { width:1280, height:720 }, deviceScaleFactor:3, reducedMotion:'reduce' });
  await page.goto('http://localhost:5178/proto.html'); await page.waitForTimeout(700);
  async function center(locator) { const b = await locator.boundingBox(); return { x:b.x+b.width/2, y:b.y+b.height/2 }; }
  async function drag(to) {
   const a=await center(page.locator('[data-cell-grip="actor-hero"]')), b=await center(to);
   await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:12}); await page.mouse.up(); await page.waitForTimeout(2400);
  }
  await drag(page.locator('[data-biome-id="day-one-berries"]'));
  for(let i=0;i<2;i++) { await page.locator('.proto-main-tableau .playing-card:not(:disabled)').first().click(); await page.waitForTimeout(600); }
  await page.getByRole('button',{name:'Exit tableau',exact:false}).first().click(); await page.waitForTimeout(900);
  await page.getByRole('button',{name:'Reset View',exact:true}).click(); await page.waitForTimeout(600);
  await drag(page.locator('[data-biome-id="hero-den"]'));
  await page.getByRole('button',{name:'Eat supper'}).click(); await page.getByRole('button',{name:'Curl up'}).click(); await page.waitForTimeout(900);
  if(await page.getByRole('button',{name:'Tilt camera view',exact:true}).count()) await page.keyboard.press('Space');
  const view=await page.locator('.proto-map-viewport').boundingBox();
  await page.mouse.move(view.x+view.width*.8,view.y+view.height*.4); await page.mouse.wheel(0,-10000); await page.waitForTimeout(1600); await page.mouse.wheel(0,-10000); await page.waitForTimeout(1200);
  const result=await page.locator('[data-physical-world] [data-board-piece="actor"]').evaluate(el=>{
   const matrix=new DOMMatrix(getComputedStyle(el).transform);
   return {pose:el.dataset.actorPose,orientation:el.dataset.actorOrientation,width:Math.hypot(matrix.m11,matrix.m12,matrix.m13)*el.offsetWidth,scale:getComputedStyle(el).getPropertyValue('--actor-world-scale')};
  });
  assert.equal(result.pose,'sleeping'); assert.equal(result.orientation,'world-plane'); assert.ok(Math.abs(result.width-8)<.01); assert.equal(Number(result.scale),.25);
  await page.screenshot({path:'artifacts/actor-shrink-sleeping-3x.png'});
  console.log('PASS sleeping world-plane pose shrinks to 8 world units at maximum immersion zoom',result);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
