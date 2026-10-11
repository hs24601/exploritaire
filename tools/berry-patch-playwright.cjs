const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const url=process.env.PROTO_URL||'http://localhost:5178/proto.html';
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const width of [1280,1912])for(const renderer of ['webgl','canvas']){
    const context=await browser.newContext({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    assert.equal((await page.goto(`${url}?propRenderer=${renderer}`)).status(),200);await page.waitForTimeout(1200);
    const tile=page.locator('[data-biome-id="day-one-berries"]');
    const overhead=tile.locator('[data-berry-overhead]');await overhead.waitFor();
    const ground=tile.locator('[data-berry-ground]');
    assert.ok(await ground.evaluate(el=>el.complete&&el.naturalWidth===32));
    assert.ok(await tile.evaluate(el=>Boolean(el.closest('[data-ground-world]'))),'Tile ground is composited beneath physical scenery');
    assert.equal(await tile.getAttribute('data-tile-type'),'berry-patch');
    assert.ok(await overhead.evaluate(el=>el.complete&&el.naturalWidth===32));
    await tile.screenshot({path:`artifacts/berry-patch-${width}-${renderer}-topdown-3x.png`});
    if(renderer==='webgl')await tile.click();else await tile.tap();
    await page.locator('[data-tile-card-art="day-one-berries"]').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(800);
    const popup=page.locator('[data-biome-popup="day-one-berries"]'),canvas=popup.locator('[data-prop-volume]').first();await canvas.waitFor();
    assert.equal(await ground.count(),1,'Immersion retains textured ground');
    assert.equal(await page.locator('[data-biome-edge="day-one-berries"]').count(),0,'Berry patch has no pine edge scenery');
    const placement=await popup.evaluate(el=>[el.style.left,el.style.top,el.style.width,el.style.height]);
    const samples=[];
    for(let i=0;i<=8;i++){
      if(i){const turn=page.getByRole('button',{name:'Turn table right',exact:true});if(i%2)await turn.click();else await turn.tap();await page.waitForTimeout(250);}
      const sample=await canvas.evaluate(el=>{
        const data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;let fruit=0,count=0,hash=0;
        for(let i=0;i<data.length;i+=4)if(data[i+3]){count++;if(data[i]>data[i+1]*1.5)fruit++;hash=(hash*31+data[i]+data[i+1]+data[i+2])|0;}
        return {fruit,count,hash,engine:el.dataset.volumeEngine,width:Number(el.dataset.volumeGroundWidth),depth:Number(el.dataset.volumeGroundDepth)};
      });
      assert.equal(sample.engine,renderer);assert.ok(sample.count>1000&&sample.fruit>30&&sample.fruit/sample.count>.02,JSON.stringify(sample));
      assert.ok(sample.width>40&&sample.depth>40,'Broad two-axis shrub footprint');samples.push(sample);
      assert.deepEqual(await popup.evaluate(el=>[el.style.left,el.style.top,el.style.width,el.style.height]),placement);
      if([0,2,4,6].includes(i))await canvas.screenshot({path:`artifacts/berry-patch-${width}-${renderer}-orbit-${i*45}-3x.png`});
    }
    assert.equal(samples[0].hash,samples[8].hash);assert.notEqual(samples[0].hash,samples[2].hash);
    // The separated ground layer must still receive actor drops.
    await page.getByRole('button',{name:'Flat camera view',exact:true}).click();
    const center=async locator=>{const box=await locator.boundingBox();return{x:box.x+box.width/2,y:box.y+box.height/2};};
    const from=await center(page.locator('[data-cell-grip="actor-hero"]')),to=await center(tile);
    const touch=renderer==='canvas',cdp=touch?await context.newCDPSession(page):null;
    const send=(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:p.x,y:p.y}]});
    if(touch)await send('touchStart',from);else{await page.mouse.move(from.x,from.y);await page.mouse.down();}
    for(let step=1;step<=12;step++){
      const p={x:from.x+(to.x-from.x)*step/12,y:from.y+(to.y-from.y)*step/12};
      if(touch)await send('touchMove',p);else await page.mouse.move(p.x,p.y);await page.waitForTimeout(20);
    }
    if(touch)await send('touchEnd',to);else await page.mouse.up();await cdp?.detach();
    await page.waitForFunction(()=>document.querySelector('[data-board-piece="actor"][data-actor-id="hero"]')?.getAttribute('data-grid-reference')==='table:-1,1');
    assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
    assert.deepEqual(errors,[]);console.log('PASS berry pixel/voxel art, fruit around orbit, mouse/touch turns',width,renderer);await context.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
