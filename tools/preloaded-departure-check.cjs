const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const b=await chromium.launch();try{for(const width of [1674,1280]){const p=await b.newPage({viewport:{width,height:width===1280?720:940},reducedMotion:'reduce'});p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(e.message));let delayed=false,finished=false,late=0,travel=false;
await p.route('**/assets/**',async r=>{if(travel&&/hero-(curious|neutral|sad)-heads|hero-(directions|walking|sitting)|hero-den-(front-quarter|side|rear)/.test(r.request().url())){late++;console.log("LATE",r.request().url());}if(r.request().url().endsWith('hero-curious-heads-v1.png')&&!delayed){delayed=true;await new Promise(resolve=>setTimeout(resolve,10000));finished=true;}await r.continue();});
await p.goto('http://127.0.0.1:5178/proto.html',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.querySelector('[data-media-loading]'));
await p.waitForTimeout(8200);assert.equal(await p.locator('[data-media-loading]').count(),1,'startup must not release at eight seconds while critical art is delayed');
await p.locator('.proto-game-root').waitFor();console.log(width,'startup prepared');assert.ok(finished,'expression sheet is ready before play');
// Clear the authored opening bubbles through their normal controls.
for(let i=0;i<5&&await p.locator('[data-callout-id="day01.opening"]').count();i++){await p.locator('[data-callout-id="day01.opening"] .proto-callout-next').click();await p.waitForTimeout(150);}
await p.getByRole('button',{name:'Flat camera view',exact:true}).click();await p.getByRole('button',{name:'Reset View',exact:true}).click();await p.waitForTimeout(800);console.log(width,'flat drag ready');
const a=await p.locator('[data-cell-grip="actor-hero"]').boundingBox();const t=p.locator('[data-board-piece="tile"][title*="one bush"]').first();const c=await t.boundingBox();
await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(c.x+c.width/2,c.y+c.height/2,{steps:12});await p.mouse.up();
await p.screenshot({path:'artifacts/preloaded-route-debug.png'});console.log(width,'route',await p.locator('[data-route-line]').count());await p.getByRole('button',{name:'Confirm travel',exact:true}).waitFor({timeout:5000});travel=true;await p.getByRole('button',{name:'Confirm travel',exact:true}).click({timeout:5000});
await p.locator('[data-table-sectional-sprite="hero"] canvas[data-face-layer="true"]').waitFor({state:'visible',timeout:3000});
await p.locator('[data-biome-popup="hero-den"] .proto-sprite-standee__art').first().waitFor({state:'visible',timeout:3000});
await p.screenshot({path:`artifacts/preloaded-departure-${width}.png`});assert.equal(late,0,'first OK must not request cold Hero or den views');assert.deepEqual(errors,[]);console.log(`PASS ${width}: delayed expression gates startup; actual OK renders Hero and den without cold travel-art requests`);await p.close();}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});



