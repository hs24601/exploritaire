const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=1002',{timeout:45000});
 await page.locator('[data-battle-slot="hero"]').waitFor({timeout:45000});
 const assets=await page.evaluate(async()=>Promise.all(['nature','fire','water','air','earth','chaos'].flatMap(element=>['compact','large'].map(async size=>{
 const image=new Image();image.src=`/assets/runtime/ui/value-backdrops/${element}-${size}-v1.png`;await image.decode();
 return {element,size,width:image.width,height:image.height};
 }))));
 assert.equal(assets.length,12);
 const cards=page.locator('[data-battle-card]');assert.equal(await cards.count(),24);
 assert.equal(await cards.locator('.painted-card-adornment').count(),0);
 const compact=cards.locator('.proto-card-rank:not(.invisible) .element-rank-backdrop');
 const large=cards.locator('.proto-card-center-rank .element-rank-backdrop');
 assert.equal(await compact.count(),18);assert.equal(await large.count(),6);
 const ranks=await cards.locator('.element-rank-backdrop').evaluateAll(nodes=>nodes.map(node=>{
 const img=node.querySelector('img'),ink=node.querySelector('.element-rank-backdrop__ink'),r=ink.getBoundingClientRect(),b=node.getBoundingClientRect();
 return{rank:ink.textContent,size:node.dataset.size,pointer:getComputedStyle(img).pointerEvents,draggable:img.draggable,contained:r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1};
 }));
 for(const r of ranks){assert.match(r.rank,/^(A|[2-9]|10|J|Q|K)$/);assert.equal(r.pointer,'none');assert.equal(r.draggable,false);assert.ok(r.contained,JSON.stringify(r));}
 const notes=page.locator('.scenario-notes__title');if(await notes.count()&&await notes.getAttribute('aria-expanded')==='true')await notes.click();
 await cards.locator('.element-rank-backdrop img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
 fs.mkdirSync('artifacts/element-value-backdrops',{recursive:true});
 await page.screenshot({path:'artifacts/element-value-backdrops/desktop.png'});
 await page.locator('.battle-field__rack').screenshot({path:'artifacts/element-value-backdrops/tableau.png'});
 await page.setViewportSize({width:900,height:700});
 await page.screenshot({path:'artifacts/element-value-backdrops/compact.png'});
 assert.deepEqual(errors,[]);console.log('PASS: 12 assets decode, 18 compact / 6 large value plaques, ranks fit, no perimeter art, no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
