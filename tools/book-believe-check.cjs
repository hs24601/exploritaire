const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{fs.mkdirSync('output/book-believe',{recursive:true});const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,1400))});page.on('request',req=>{if(/^https?:/.test(req.url())&&new URL(req.url()).origin!==new URL(process.env.BOOK_TEST_URL||'http://127.0.0.1:5178').origin)external.push(req.url())});
await page.goto((process.env.BOOK_TEST_URL||'http://127.0.0.1:5178')+'/book.html?page=23&low&test',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.believe==='23',{timeout:180000});
const child=page.frames().find(f=>f.url().includes('/believe/index.html'));assert(child);
assert.equal(await child.evaluate(()=>window.__believe.playing),false);
const poster=await child.evaluate(()=>{window.__believe.seek(0);return document.querySelector('canvas').toDataURL('image/webp',.88)});fs.writeFileSync('output/book-believe/poster.webp',Buffer.from(poster.split(',')[1],'base64'));
for(const [name,t,phase] of [['closed',0,'opening'],['word',5,'entering-dot'],['portal',12.7,'entering-dot'],['castle',35,'film'],['sea',60,'film'],['dragon',85,'film'],['city',105,'film'],['return',136,'returning-to-dot'],['return-light',145.7,'returning-to-dot'],['emerging',149,'emerging'],['spiral',164,'closing'],['end',181,'complete']]){
 await child.evaluate(t=>window.__believe.seek(t),t);assert.equal(await child.evaluate(()=>window.__believe.phase),phase);await page.screenshot({path:`output/book-believe/${name}.png`});
}
assert(Math.abs(await child.evaluate(()=>window.__believe.open))<.001);
await child.locator('#believe-play').click();await child.waitForTimeout(250);assert(await child.evaluate(()=>window.__believe.time<1&&window.__believe.playing));await child.evaluate(()=>window.__believe.pause());
await child.evaluate(()=>window.__believe.seek(180.98));await child.locator('#believe-play').click();await child.waitForFunction(()=>window.__believe.phase==='complete'&&!window.__believe.playing);await child.waitForTimeout(200);assert.equal(await child.evaluate(()=>window.__believe.time),181);
await child.locator('#sound').click();assert(await child.evaluate(()=>window.__penAudio.want&&Boolean(window.__penAudio.ctx)));await child.evaluate(()=>{window.__believe.seek(14);window.__believe.play()});await child.waitForTimeout(300);assert.equal(await child.evaluate(()=>window.__penAudio.ctx.state),'running');await child.evaluate(()=>window.__believe.pause());await child.locator('#sound').click();
await page.setViewportSize({width:390,height:844});await child.waitForTimeout(100);for(const t of[0,5,13.9,150.99,151,181]){await child.evaluate(t=>window.__believe.seek(t),t);await page.screenshot({path:`output/book-believe/portrait-${t}.png`});}
// The rise-to-orbit cut is continuous in both position and target orientation.
const poses=[];for(const t of[150.999,151])poses.push(await child.evaluate(t=>{window.__believe.seek(t);return{position:window.__believe.cam.position.toArray(),rotation:window.__believe.cam.quaternion.toArray()}},t));
assert(Math.hypot(...poses[0].position.map((x,i)=>x-poses[1].position[i]))<.01);
assert(Math.abs(poses[0].rotation.reduce((a,x,i)=>a+x*poses[1].rotation[i],0))>.999);
console.log(JSON.stringify({errors,external,manualPlay:true,fullFilm:true,closedEnd:true,noLoop:true,soundUnlocked:true,portrait:true,continuousExit:true}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
