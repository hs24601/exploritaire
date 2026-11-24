const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/immersive-travel',{recursive:true});try{for(const [width,height] of (process.env.FOLLOW_WIDTH ? [[+process.env.FOLLOW_WIDTH,914]] : [[1280,720],[1912,914]])){
const page=await browser.newPage({viewport:{width,height}});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5178/proto.html');await page.waitForTimeout(1200);const a=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),b=await page.locator('[data-tile-type="berry-patch"]').first().boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();await page.getByRole('button',{name:'Confirm travel',exact:true}).click();await page.waitForTimeout(1200);

const nativeCard=page.locator('[data-exposed="true"] button:enabled').first();
await nativeCard.dispatchEvent('pointerdown',{button:0,buttons:1,pointerId:77,pointerType:'mouse',isPrimary:true});await nativeCard.dispatchEvent('pointerup',{button:0,buttons:0,pointerId:77,pointerType:'mouse',isPrimary:true});
await page.getByRole('button',{name:'Auto-Solve',exact:true}).click();
let moved=false,first;
for(let i=0;i<4;i++){
 await page.waitForTimeout(300);
 const sample=await page.locator('.proto-map-viewport').evaluate(el=>{
 const actor=el.querySelector('[data-board-piece="actor"][data-actor-id="hero"]'),world=el.querySelector('[data-physical-world]');
 const scale=parseFloat(world.style.getPropertyValue('--camera-scale')),x=+actor.dataset.actorX,y=+actor.dataset.actorY;
 const p=new DOMPoint(x,y,0,1).matrixTransform(new DOMMatrix(getComputedStyle(world).transform));
 const q=p.matrixTransform(new DOMMatrix(getComputedStyle(el.querySelector('.proto-table-stage')).transform));
 return {x,y,dx:q.x/q.w,dy:q.y/q.w,width:el.clientWidth,height:el.clientHeight};
 });if(!first)first=sample;else moved ||=Math.hypot(sample.x-first.x,sample.y-first.y)>1;
 assert(Math.abs(sample.dx)<sample.width/2-24 && sample.dy>-sample.height/2+64 && sample.dy<sample.height/2-48,'adaptive camera keeps live actor framed: '+JSON.stringify(sample));
}
assert(moved,'actor advances while camera follows');if(await page.getByRole('button',{name:'Pause journey',exact:true}).count()){await page.getByRole('button',{name:'Pause journey',exact:true}).click();await page.waitForTimeout(100);await page.screenshot({path:'artifacts/immersive-travel/follow-'+width+'.png'});
assert.deepEqual(await findLayoutDefects(page,'.travel-tableau--world',{parts:'.travel-world-hud,.travel-actor-popup,.travel-foundation',minFontSize:16}),[]);
}assert.deepEqual(errors,[]);console.log('PASS',width,'native card input preserves tracking; adaptive camera keeps actor framed throughout live travel');await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
