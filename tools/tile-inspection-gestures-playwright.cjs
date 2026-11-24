const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true});try{
 fs.mkdirSync('artifacts/tile-inspection',{recursive:true});
 for(const [width,height,touch] of [[1280,900,false],[390,844,true],[844,390,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/proto.html');await page.locator('[data-biome-id="dirt-0-1"]').waitFor();
  assert(await page.evaluate(()=>!document.body.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))), 'native menu suppressed outside map');
  const tile=page.locator('button[data-biome-id="dirt-0-1"]');const box=await tile.boundingBox();const point={x:box.x+box.width/2,y:box.y+box.height/2};
  if(touch){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await page.locator('[data-tile-inspection-hold]').waitFor();await page.waitForTimeout(250);
   const offset=await page.locator('.tile-inspection-hold__progress').evaluate(el=>getComputedStyle(el).strokeDashoffset);assert(parseFloat(offset)>0&&parseFloat(offset)<126);
   await page.screenshot({path:`artifacts/tile-inspection/${width}-holding.png`});
   await page.locator('[data-inspection-id="dirt-0-1"]').waitFor();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(await page.locator('[data-inspection-id]').count(),1);await page.keyboard.press('Escape');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+30,y:point.y}]});
   await page.waitForTimeout(750);assert.equal(await page.locator('[data-tile-inspection-hold]').count(),0);assert.equal(await page.locator('[data-inspection-id]').count(),0);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.click(point.x,point.y,{button:'right'});await page.locator('[data-inspection-id="dirt-0-1"]').waitFor();
   assert.equal(await page.locator('[data-inspection-id]').count(),1);await page.screenshot({path:'artifacts/tile-inspection/right-click.png'});await page.keyboard.press('Escape');
   const den=await page.locator('button[data-biome-id="hero-den"]').boundingBox();await page.mouse.click(den.x+den.width/2,den.y+den.height/2,{button:'right'});await page.locator('[data-inspection-id="hero-den"]').waitFor();assert.equal(await page.locator('[data-inspection-id="hero"]').count(),0);await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(700);
   const immersive=await tile.boundingBox();await page.mouse.click(immersive.x+immersive.width/2,immersive.y+immersive.height/2,{button:'right'});await page.locator('[data-inspection-id="dirt-0-1"]').waitFor();await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Flat camera view',exact:true}).click();await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByRole('button',{name:'Edit tiles',exact:true}).click();
   await page.getByRole('complementary',{name:'Developer tile editor'}).waitFor();await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.waitForTimeout(700);
   await page.evaluate(()=>{const marker=document.createElement('i');marker.id='inspection-editor-origin';marker.style.cssText='position:absolute;left:192px;top:0;width:1px;height:1px;pointer-events:none';document.querySelector('[data-physical-world]').append(marker);});
   const origin=await page.locator('#inspection-editor-origin').boundingBox();await page.mouse.click(origin.x,origin.y,{button:'right'});await page.getByRole('menu',{name:'Recently used tiles'}).waitFor();assert.equal(await page.locator('[data-inspection-id]').count(),0);
  }
  assert.deepEqual(errors,[]);console.log('PASS tile inspection gestures',width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
