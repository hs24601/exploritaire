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
 const assets=await page.evaluate(async()=>Promise.all(['nature','fire','water','air','earth','chaos'].map(async element=>{
 const img=new Image();img.src=`/assets/runtime/ui/card-adornments/${element}-v3.png`;await img.decode();
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
 const pixels=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,paint=0,soft=0;
 for(let i=3;i<pixels.length;i+=4){clear+=pixels[i]===0;paint+=pixels[i]>=128;soft+=pixels[i]>0&&pixels[i]<255;}
 return{element,width:img.width,height:img.height,clear,paint,soft};
 })));
 console.log(JSON.stringify(assets)); for(const a of assets){assert.ok(a.width>500&&a.height>500);assert.ok(a.clear>100&&a.paint>100,JSON.stringify(a));}
 const cards=page.locator('[data-battle-card]');assert.equal(await cards.count(),24);
 await cards.locator('.painted-card-adornment').evaluateAll(nodes=>Promise.all(nodes.map(n=>n.decode())));
 assert.equal(await cards.locator('.painted-card-adornment').count(),24);
 assert.equal(await cards.locator('.element-glyph').count(),0);
 assert.equal(await cards.locator('.sr-only').count(),24);
 const decorations=await cards.locator('.painted-card-adornment').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),pointer:getComputedStyle(n).pointerEvents,drag:n.draggable})));
 for(const d of decorations){assert.match(d.src,/-v3\.png$/);assert.equal(d.pointer,'none');assert.equal(d.drag,false);}
 const notes=page.locator('.scenario-notes__title');if(await notes.getAttribute('aria-expanded')==='true')await notes.click();
 fs.mkdirSync('artifacts/card-adornments-v3',{recursive:true});
 await page.screenshot({path:'artifacts/card-adornments-v3/desktop.png'});
 await page.setViewportSize({width:900,height:700});
 await page.screenshot({path:'artifacts/card-adornments-v3/compact.png'});
 assert.deepEqual(errors,[]);console.log('PASS: six v3 RGBA assets with transparent backgrounds; 24 decorated cards with accessible affinity labels, no duplicate glyphs, no page errors.');
 console.log(JSON.stringify(assets));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
