const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out='artifacts/ott-haze';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const [width,height,query] of [[1280,720,'fx=high'],[390,844,'fx=low'],[1280,720,'atmosphere=canvas']]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:5178/proto.html?${query}`);
   const volume=page.locator('[data-atmosphere="volume"]');await volume.waitFor();await page.waitForTimeout(700);
   assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'),'tabletop');
   assert.equal(await volume.getAttribute('data-active'),'true');
   assert.equal(await volume.getAttribute('data-canopies'),'0','OTT never adds upright sprite geometry');
   const settings=page.getByRole('button',{name:'Game settings',exact:true});
   await settings.click();
   const panel=page.getByRole('group',{name:'Game settings',exact:true});
   const hour=page.getByRole('slider',{name:'Table time of day'});
   const setHour=async value=>{await hour.evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForTimeout(600);};
   const global=panel.getByRole('checkbox',{name:'Global lights',exact:true});assert.ok(await global.isChecked());
   await setHour(0);await settings.click();
   await page.screenshot({path:`${out}/${width}-${query.replace('=','-')}-midnight.png`});
   if(width===1280 && query==='fx=high') {
    const a=await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
    const target=await page.locator('[data-board-piece="tile"][data-biome-id="day-one-berries"]').boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:12});await page.mouse.up();
    await page.getByRole('button',{name:'Cancel travel',exact:true}).waitFor();
    assert.ok(await page.locator('[data-route-points]').count());
    await page.waitForTimeout(500);await page.screenshot({path:`${out}/midnight-route.png`});
    await page.getByRole('button',{name:'Cancel travel',exact:true}).click();
   }
   const brightness=async()=>{
    const png=await page.locator('.proto-map-viewport').screenshot();
    return page.evaluate(async data=>{
     const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     let light=0;for(let i=0;i<pixels.length;i+=4)light+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;
     return light/(pixels.length/4);
    },png.toString('base64'));
   };
   const nightBrightness=await brightness();
   await settings.click();await global.uncheck();await settings.click();await page.waitForTimeout(700);
   assert.equal(await volume.getAttribute('data-active'),'false','unchecked bypasses haze');
   assert.ok(await brightness()>nightBrightness*2,'unchecked restores a visibly brighter board at midnight');
   await page.screenshot({path:`${out}/${width}-${query.replace('=','-')}-global-off.png`});
   await settings.click();assert.ok(await page.getByRole('checkbox',{name:'Table lights',exact:true}).isChecked());
   const panelBox=await panel.boundingBox();assert.ok(panelBox.x>=0 && panelBox.x+panelBox.width<=width+1 && panelBox.y+panelBox.height<=height+1);
   await page.reload();await settings.click();assert.equal(await global.isChecked(),false,'setting persists');
   await global.check();await setHour(12);await settings.click();await page.waitForTimeout(700);
   assert.equal(await volume.getAttribute('data-active'),'true','checked applies normal lighting');
   await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(700);
   assert.equal(await volume.getAttribute('data-active'),'true');assert.ok(Number(await volume.getAttribute('data-canopies'))>0);
   await page.getByRole('button',{name:'Flat camera view',exact:true}).click();await page.waitForTimeout(700);
   assert.equal(await volume.getAttribute('data-active'),'true');assert.equal(await volume.getAttribute('data-canopies'),'0');
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS OTT GPU/Canvas/low quality, midnight haze, global lighting toggle, persistence, mobile settings bounds and view transitions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
