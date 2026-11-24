const fs=require('node:fs');const OUT=process.env.CLOSEUP_ARTIFACTS||'artifacts/actor-closeup';fs.mkdirSync(OUT,{recursive:true});
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
for(const reducedMotion of ['no-preference','reduce']){
 const page=await browser.newPage({viewport:{width:1912,height:914},deviceScaleFactor:3,reducedMotion});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5178/proto.html?atmosphere=off');await page.waitForTimeout(900);
 const grip=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),x=grip.x+grip.width/2,y=grip.y+grip.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-48*1.7*3,{steps:10});await page.mouse.up();await page.waitForTimeout(1100);
 await page.getByRole('button',{name:'Actor close-up',exact:true}).click();await page.waitForTimeout(500);
 async function snapshot(){return page.locator('[data-board-piece="actor"][data-actor-id="hero"]').evaluate(el=>{const v=el.closest('.proto-map-viewport');return {actorY:+el.dataset.actorY,actorX:+el.dataset.actorX,x:parseFloat(v.style.getPropertyValue('--camera-x')),y:parseFloat(v.style.getPropertyValue('--camera-y')),scale:+v.style.getPropertyValue('--camera-scale'),body:+v.style.getPropertyValue('--actor-world-scale'),yaw:parseFloat(v.style.getPropertyValue('--camera-yaw'))};});}
 const before=await snapshot();await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(600);const after=await snapshot();
 assert.ok(after.actorY<before.actorY,'actor continues traveling');assert.ok(Math.abs(after.y+after.actorY*after.scale)<.05,'close-up follows live feet');
 assert.ok(Math.abs(after.yaw-before.yaw-45)<.05,'travel does not interrupt orbit');assert.equal(after.body,before.body);
 await page.mouse.move(2,2);await page.waitForTimeout(400);await page.screenshot({path:`${OUT}/actor-closeup-walking-${reducedMotion}-3x.png`});
 await page.getByRole('button',{name:'Exit actor close-up',exact:true}).click();await page.waitForTimeout(300);const restored=await snapshot();await page.waitForTimeout(400);const stable=await snapshot();
 assert.equal(stable.scale,restored.scale);assert.equal(stable.y,restored.y,'follow stays overridden for remainder of trip');assert.deepEqual(errors,[]);
 console.log(`Live travel and orbit, fixed body scale, manual takeover and ${reducedMotion} passed.`);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
