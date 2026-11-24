const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const out='artifacts/combat-demo';fs.mkdirSync(out,{recursive:true});
const centre=async l=>{const r=await l.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2}};
(async()=>{const b=await chromium.launch({headless:true});try {
for(const [w,h] of [[1280,720],[1912,914]]){
const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:5178/proto.html?combatdemo');await p.locator('.combat-demo canvas').waitFor();
await p.waitForFunction(()=>Number(document.querySelector('.combat-demo')?.dataset.elapsed)>=4);
await p.screenshot({path:`${out}/charge-${w}.png`});
assert.deepEqual(await findLayoutDefects(p,'.combat-demo',{parts:'.combat-demo__header, .combat-demo__header h1, .combat-demo__header p, .combat-demo__header button, .combat-demo__arena, .combat-demo__footer, .combat-demo__footer span'}),[]);
await p.waitForFunction(()=>Number(document.querySelector('.combat-demo')?.dataset.elapsed)>=5.7);await p.screenshot({path:`${out}/impact-${w}.png`});
await p.waitForFunction(()=>document.querySelector('.combat-demo')?.dataset.complete==='true');await p.waitForTimeout(1000);assert.equal(await p.locator('.combat-demo').count(),1);assert.equal(await p.locator('.combat-demo').getAttribute('data-elapsed'),'10.0');
await p.screenshot({path:`${out}/final-${w}.png`});await p.locator('.combat-demo__header').screenshot({path:`${out}/header-${w}.png`,scale:'css'});
await p.keyboard.press('Escape');assert.equal(await p.locator('.combat-demo').count(),0);
const a=await centre(p.locator('[data-board-piece="actor"]').first()),d=await centre(p.locator('[data-biome-id="woods-danger"]'));
await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(d.x,d.y,{steps:15});await p.mouse.up();await p.locator('.combat-demo canvas').waitFor({timeout:15000});assert.equal(await p.locator('.proto-skirmish[data-enemy-hp]').count(),0);
await p.getByRole('button',{name:'Return to table · Esc'}).click();await p.getByRole('button',{name:'Watch battle scene'}).click();await p.locator('.combat-demo canvas').waitFor();await p.keyboard.press('Escape');assert.deepEqual(errors,[]);await ctx.close();console.log(`${w} desktop entry, replay, final hold, Escape, layout passed`);
}
const c=await b.newContext({viewport:{width:1280,height:720},hasTouch:true,reducedMotion:'reduce'});const p=await c.newPage();await p.goto('http://localhost:5178/proto.html?combatdemo');await p.locator('.combat-demo canvas').waitFor();await p.waitForTimeout(500);assert.match(await p.locator('.combat-demo__footer').innerText(),/Reduced motion/);await p.getByRole('button',{name:'Return to table · Esc'}).tap();assert.equal(await p.locator('.combat-demo').count(),0);console.log('touch dismissal and reduced motion passed');await c.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});

