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
    assert.equal(await tile.getAttribute('data-tile-type'),'berry-patch');
    assert.ok(await overhead.evaluate(el=>el.complete&&el.naturalWidth===32));
    await tile.screenshot({path:`artifacts/berry-patch-${width}-${renderer}-topdown-3x.png`});
    await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(800);
    const popup=page.locator('[data-biome-popup="day-one-berries"]'),canvas=popup.locator('[data-prop-volume]').first();await canvas.waitFor();
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
      assert.equal(sample.engine,renderer);assert.ok(sample.count>1000&&sample.fruit>100,JSON.stringify(sample));
      assert.ok(sample.width>40&&sample.depth>40,'Broad two-axis shrub footprint');samples.push(sample);
      assert.deepEqual(await popup.evaluate(el=>[el.style.left,el.style.top,el.style.width,el.style.height]),placement);
      if([0,2,4,6].includes(i))await canvas.screenshot({path:`artifacts/berry-patch-${width}-${renderer}-orbit-${i*45}-3x.png`});
    }
    assert.equal(samples[0].hash,samples[8].hash);assert.notEqual(samples[0].hash,samples[2].hash);
    assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
    assert.deepEqual(errors,[]);console.log('PASS berry pixel/voxel art, fruit around orbit, mouse/touch turns',width,renderer);await context.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
