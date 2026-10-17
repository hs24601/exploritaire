const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('artifacts/settings-consolidation', {recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  for (const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568},{width:1280,height:720}]) {
   const page = await browser.newPage({viewport,hasTouch:viewport.width<901,deviceScaleFactor:3});
   const errors=[]; page.on('pageerror', e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('exploritaire.artStyle','pixel'));
   await page.goto('http://127.0.0.1:5178/proto.html');
   await page.getByRole('button',{name:'Game settings',exact:true}).click();
   const panel=page.locator('#art-settings-panel');
   await panel.waitFor();
   const mapBounds=await page.locator('.proto-map').boundingBox();
   const cogBounds=await page.getByRole('button',{name:'Game settings',exact:true}).boundingBox();
   const topInset=cogBounds.y-mapBounds.y, rightInset=mapBounds.x+mapBounds.width-cogBounds.x-cogBounds.width;
   assert(topInset>=8 && topInset<=14 && rightInset>=8 && rightInset<=14,'cog anchored inside map upper right');
   assert.equal(await page.locator('.proto-main-header').isVisible(),false,'empty header releases its space');
   assert.equal(await panel.getByRole('combobox').count(),0);
   assert(!/pixel|art style/i.test(await panel.innerText()));
   assert.equal(await page.evaluate(async()=>(await import('/src/proto/artStyle.ts')).useArtStyle()),'paint');
   const bounds=await panel.boundingBox();
   assert(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=viewport.width && bounds.y+bounds.height<=viewport.height);
   assert.equal(await page.locator('.proto-lighting-rail').count(),0);
   assert.equal(await page.locator('.proto-party-controls').count(),1);
   assert.equal(await panel.locator('.proto-party-controls').count(),1);
   assert.equal(await panel.getByRole('button',{name:'Edit tiles',exact:true}).count(),1);
   assert.equal(await panel.locator('.proto-build-label').count(),1);
   {
    for(const name of ['Cycle day/night','Table lights','Light %']) {
     const control=panel.getByRole('checkbox',{name,exact:true});
     await control.scrollIntoViewIfNeeded(); const before=await control.isChecked(); await control.click(); assert.equal(await control.isChecked(),!before);
    }
    await panel.getByRole('slider',{name:'Table time of day'}).fill('12');
    assert.equal(await panel.getByRole('slider').inputValue(),'12');
   }
   const add=panel.getByRole('button',{name:'Add playtest companion',exact:true});
   await add.scrollIntoViewIfNeeded();
   if(viewport.width<901) await add.tap(); else await add.click();
   const join=panel.getByRole('button',{name:'Join Hero · Glacia',exact:true});
   await join.scrollIntoViewIfNeeded();
   if(viewport.width<901) await join.tap(); else await join.click();
   await panel.getByRole('button',{name:'Leave party · Glacia',exact:true}).waitFor();
   await panel.evaluate(el=>{el.scrollTop=0;});
   await page.screenshot({path:`artifacts/settings-consolidation/${viewport.width}.png`});
   await panel.screenshot({path:`artifacts/settings-consolidation/${viewport.width}-3x.png`,scale:'device',animations:'disabled'});
   await page.keyboard.press('Escape'); assert.equal(await panel.count(),0);
   assert.deepEqual(errors,[]); console.log('PASS settings',viewport); await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
