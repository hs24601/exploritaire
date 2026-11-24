const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch({headless:true});
try { for (const width of [1280,1912]) {
const p=await b.newPage({viewport:{width,height:width===1280?720:914},deviceScaleFactor:1});
await p.goto('http://localhost:5178/proto.html');await p.locator('.day-objective').waitFor();await p.waitForTimeout(1200);
for(let i=0;i<4;i++){if(!await p.locator('.proto-callout-advance').count())break;await p.locator('.proto-callout-advance').evaluate(e=>e.click());await p.waitForTimeout(70);}
const opacity=()=>p.locator('.day-objective__pin').evaluate(e=>+getComputedStyle(e).opacity);
await p.waitForTimeout(1000);if(await opacity()!==1)throw Error('flight hold');
await p.waitForFunction(async()=>!(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/proto/cameraDirector.ts')).name)).getCameraPlayback().playing);
await p.waitForTimeout(100);
await p.evaluate(async()=>{(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/gameTime.ts')).name)).gameTime.setPaused(true);});const paused=await opacity();await p.waitForTimeout(400);if(await opacity()!==paused)throw Error('pause');
await p.evaluate(async()=>{(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/gameTime.ts')).name)).gameTime.setPaused(false);});await p.waitForFunction(()=>+getComputedStyle(document.querySelector('.day-objective__pin')).opacity===0);
await p.screenshot({path:`artifacts/quest-cue-fade-${width}.png`});
await p.locator('.day-objective__title').hover();if(await opacity()!==1)throw Error('hover');
const {findLayoutDefects}=require('./lib/layout-check.cjs');const defects=await findLayoutDefects(p,'.day-objective__tracker',{parts:'.day-objective__heading, .day-objective__title, .day-objective__locate'});if(defects.length)throw Error(JSON.stringify(defects));
console.log('PASS',width,'flight hold, fade, pause/resume, hover, layout');await p.close();
}} finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});








