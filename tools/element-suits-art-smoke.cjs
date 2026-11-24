const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5202/proto.html?combatsbx&scenario=1002');
  await page.locator('[data-battle-slot="hero"]').waitFor();
  // Fresh deals vary; expose a Fire face for visual review of its full perimeter.
  for(let attempt=0;attempt<8 && !await page.locator('[data-battle-depth="3"].proto-card--fire-adorned').count();attempt++){
   await page.reload();await page.locator('[data-battle-slot="hero"]').waitFor();
  }
  assert.ok(await page.locator('[data-battle-card].proto-card--fire-adorned').count()>0);
  const elements=['earth','air','fire','water','nature','chaos'];
  const assets=await page.evaluate(async elements=>Promise.all(elements.map(async element=>{
   const img=new Image();img.src=`/assets/runtime/ui/element-suits/${element}-v1.png`;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,img.width,img.height).data;
   let clear=0,opaque=0;for(let i=3;i<data.length;i+=4){clear+=data[i]===0;opaque+=data[i]===255;}
   return{element,width:img.width,height:img.height,clear,opaque};
  })),elements);
  for(const asset of assets){assert.equal(asset.width,256);assert.equal(asset.height,256);assert.ok(asset.clear>100);assert.ok(asset.opaque>100);}
  const suits=await page.locator('[data-battle-card] .element-glyph').evaluateAll(nodes=>nodes.map(node=>({element:node.dataset.element,label:node.getAttribute('aria-label'),image:node.querySelector('img')?.getAttribute('src')})));
  const adorned=page.locator('[data-battle-card].proto-card--nature-adorned, [data-battle-card].proto-card--fire-adorned');
  assert.ok(await adorned.count()>0);
  assert.equal(suits.length+await adorned.count(),24);
  assert.equal(await adorned.locator('.element-glyph').count(),0);
  assert.equal(await adorned.locator('.nature-card-adornment, .fire-card-adornment').count(),await adorned.count());
  assert.equal(await adorned.locator('.sr-only').count(),await adorned.count());
  for(const suit of suits){assert.ok(elements.includes(suit.element));assert.ok(suit.label);assert.ok(suit.image.endsWith(suit.element+'-v1.png'));}
  assert.equal(await page.locator('[data-element="dark"], [data-element="light"]').count(),0);
  fs.mkdirSync('artifacts/element-suits',{recursive:true});
  if(await page.locator('.scenario-notes__title').getAttribute('aria-expanded')==='true')await page.locator('.scenario-notes__title').click();
  await page.screenshot({path:'artifacts/element-suits/desktop.png'});
  await page.setViewportSize({width:900,height:700});
  await page.screenshot({path:'artifacts/element-suits/compact.png'});
  await page.locator('[data-battle-actor="hero"]').click();
  await page.locator('.ability-fan [data-skill="hold"]').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: six retained RGBA assets, 24 cards with glyphs or accessible Nature/Fire adornments, no duplicate affinity glyphs, compact view, Hero radial');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
