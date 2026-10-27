const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{fs.mkdirSync('artifacts/mobile-side-by-side',{recursive:true});const browser=await chromium.launch();try{
 for(const [width,height] of [[390,844],[844,390],[320,568],[1280,720],[1912,914]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<901,deviceScaleFactor:3,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PROTO_URL||'http://localhost:5180/proto.html');
  const toggle=page.locator('.proto-day-panel__toggle');await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();
  await page.getByLabel('Day scenario',{exact:true}).selectOption('day01');
  await page.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  await page.locator('.travel-tableau').waitFor();
  const map=await page.locator('.proto-map').boundingBox(),field=await page.locator('.proto-tableau-field').boundingBox();
  assert(map&&field,'both fields visible');assert(field.x+field.width<=map.x+1,'fields side by side');
  assert.equal(await page.locator('.proto-mobile-nav').count(),0);
  const play=await page.locator('.proto-play-area').boundingBox(),tab=await toggle.boundingBox();
  assert(tab.x>=play.x+play.width,'collapsed scenario tab sits to the right of play');
  assert.deepEqual(await findLayoutDefects(page,'.tableau-template__foundations',{parts:'.travel-toolbar,.travel-receiver'}),[]);
  assert.deepEqual(await findLayoutDefects(page,'.proto-workspace',{parts:'.proto-play-area,.proto-day-panel,.proto-day-panel__toggle'}),[]);
  await page.screenshot({path:`artifacts/mobile-side-by-side/${width}-3x.png`});
  await toggle.click();assert(await page.getByLabel('Day scenario',{exact:true}).isVisible());await toggle.click();
  assert.deepEqual(errors,[]);console.log('PASS',width,height,map.width,field.width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
