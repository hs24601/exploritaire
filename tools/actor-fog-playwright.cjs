const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{fs.mkdirSync('artifacts/actor-fog',{recursive:true});const browser=await chromium.launch({headless:true});try{
for(const [width,height,mode] of [[1280,720,''],[1912,914,'?atmosphere=canvas']]){
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5178/proto.html'+mode);await page.getByLabel('Day scenario',{exact:true}).selectOption('day02');
await page.getByRole('button',{name:'Visit manaberry patch',exact:true}).click();await page.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
await page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first().waitFor({timeout:60000});
for(let i=0;i<3;i++){await page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first().click();await page.waitForTimeout(650);}
await page.getByRole('button',{name:'Search darker woods',exact:true}).click();await page.waitForTimeout(1500);
const volume=page.locator('[data-atmosphere="volume"]').first();await volume.waitFor();
await page.screenshot({path:`artifacts/actor-fog/${width}-dark-travel.png`});
const hero=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');assert.equal(await hero.locator('canvas').count(),1);
const r=await hero.boundingBox();const x=Math.max(0,r.x-100),y=Math.max(0,r.y-160);await page.screenshot({path:`artifacts/actor-fog/${width}-hero-3x.png`,clip:{x,y,width:Math.min(350,width-x),height:Math.min(350,height-y)}});
assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
assert.deepEqual(errors,[]);console.log('PASS dark travel, live rig, layout, no errors',width,mode||'webgl');await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
