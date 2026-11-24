const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const url = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
async function fullFrameInk(page) {
  const boxes=await page.locator('.proto-map-fps,.proto-map-zoom').evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  const frame=await page.screenshot();
  return page.evaluate(async({data,boxes})=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const ratio=img.width/window.innerWidth;
    return boxes.map(box=>{const canvas=document.createElement('canvas');canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);const ctx=canvas.getContext('2d');ctx.drawImage(img,box.x*ratio,box.y*ratio,box.width*ratio,box.height*ratio,0,0,canvas.width,canvas.height);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<rgba.length;i+=4)if(Math.min(rgba[i],rgba[i+1],rgba[i+2])>150)ink++;return ink;});
  },{data:frame.toString('base64'),boxes});
}
async function imagePixels(page, buffer) {
  return page.evaluate(async data => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0);
    return [...ctx.getImageData(0,0,canvas.width,canvas.height).data];
  }, buffer.toString('base64'));
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  fs.mkdirSync('artifacts/dawn-flicker', { recursive: true });
  try {
    for (const width of (process.env.DAWN_WIDTH ? [Number(process.env.DAWN_WIDTH)] : [1280, 1912])) for (const art of (process.env.DAWN_ART ? [process.env.DAWN_ART] : ['paint','pixel'])) {
      const density=Number(process.env.DAWN_DPR||1);
      const page = await browser.newPage({ viewport: { width, height: width === 1280 ? 720 : 914 }, deviceScaleFactor:density, hasTouch: true });
      await page.routeWebSocket('**/*', socket => socket.onMessage(() => {}));
      await page.addInitScript(style => localStorage.setItem('exploritaire.artStyle',style),art);
      await page.goto(url);
      await page.getByRole('button',{name:'Tilt camera view',exact:true}).click(); await page.waitForTimeout(800);
      await page.mouse.move(width*.8,350);
      for(let i=0;i<5;i++) { await page.mouse.wheel(0,-3000); await page.waitForTimeout(300); if(await page.locator('.proto-map-zoom').innerText()==='Zoom 400%')break; }
      assert.equal(await page.locator('.proto-map-zoom').innerText(),'Zoom 400%');
      const cdp=await page.context().newCDPSession(page);let layers=[];
      cdp.on('LayerTree.layerTreeDidChange',e=>{layers=e.layers||[];});await cdp.send('LayerTree.enable');
      assert.ok(await page.locator('[data-physical-world]').evaluate(el=>el.offsetWidth===0&&el.offsetHeight===0));
      assert.equal(await page.locator('[data-biome-popup="hero-den"] .proto-oversample').first().evaluate(el=>Number(el.style.zoom)),Math.max(1,6/Math.max(1,density)),'Display density does not multiply the sprite raster allowance');
      const report=[];
      for(const hour of [5.95,6,6.05,6.5,12,18.05,0]) {
        await page.getByLabel('Table time of day',{exact:true}).fill(String(hour));await page.waitForTimeout(180);
        assert.ok(await page.locator('[data-biome-popup="hero-den"]').isVisible(),`Den at ${hour}`);
        const ink={};
        for(const selector of ['.proto-map-fps','.proto-map-zoom']) {
          const rgba=await imagePixels(page,await page.locator(selector).screenshot());let count=0;
          for(let i=0;i<rgba.length;i+=4)if(Math.min(rgba[i],rgba[i+1],rgba[i+2])>150)count++;
          ink[selector]=count;assert.ok(count>30,`${selector} has actual rendered text at ${hour}`);
        }
        const giant=layers.filter(l=>l.drawsContent&&(l.width>width*2||l.height>1830));
        assert.deepEqual(giant,[],'No oversized compositor planes');
        report.push({hour,ink,largestLayer:Math.max(...layers.filter(l=>l.drawsContent).map(l=>l.width*l.height))});
        assert.ok((await fullFrameInk(page)).every(ink=>ink>30),'Readouts must survive the full-frame compositor, not only cropped captures');
        if(hour===6.05)await page.screenshot({path:`artifacts/dawn-flicker/${width}-${art}-dawn.png`});
      }
      // View the mouth for the pixel assertion: from the rear, foreground
      // mountains intentionally cover the den on the taller desktop viewport.
      for(let turn=0;turn<4;turn++){await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(360);}
      await page.getByLabel('Table time of day',{exact:true}).fill('6.05');await page.waitForTimeout(200);
      const den=page.locator('[data-biome-popup="hero-den"]'),box=await den.boundingBox();
      const view=await page.locator('.proto-map-viewport').boundingBox();
      const clip={x:Math.max(box.x,view.x),y:Math.max(box.y,view.y),width:Math.min(box.x+box.width,view.x+view.width)-Math.max(box.x,view.x),height:Math.min(box.y+box.height,view.y+view.height)-Math.max(box.y,view.y)};
      const visibleBuffer=await page.screenshot({clip}),visible=await imagePixels(page,visibleBuffer);
      await den.evaluate(el=>{el.style.setProperty('visibility','hidden','important');});const hiddenBuffer=await page.screenshot({clip}),hidden=await imagePixels(page,hiddenBuffer);
      await den.evaluate(el=>el.style.removeProperty('visibility'));
      let denPixels=0;for(let i=0;i<visible.length;i+=4)if(Math.abs(visible[i]-hidden[i])+Math.abs(visible[i+1]-hidden[i+1])+Math.abs(visible[i+2]-hidden[i+2])>40)denPixels++;
      if(denPixels<=2000){fs.writeFileSync('artifacts/dawn-flicker/den-present.png',visibleBuffer);fs.writeFileSync('artifacts/dawn-flicker/den-hidden.png',hiddenBuffer);}
      assert.ok(denPixels>2000,`Den artwork contributes visible dawn pixels (${denPixels})`);
      await page.getByLabel('Table time of day',{exact:true}).fill('5.95');await page.getByLabel('Cycle day/night',{exact:true}).check();
      await page.evaluate(()=>{window.dawnSamples={frames:0,vanished:0};window.dawnSampling=true;const sample=()=>{if(!window.dawnSampling)return;const den=document.querySelector('[data-biome-popup="hero-den"]');if(!den||getComputedStyle(den).display==='none'||getComputedStyle(den).visibility==='hidden')window.dawnSamples.vanished++;window.dawnSamples.frames++;requestAnimationFrame(sample);};sample();});
      const x=view.x+view.width*.8,y=view.y+view.height*.45;
      for(let i=0;i<8;i++) {
        const button=i%2?'middle':'right';await page.mouse.move(x,y);await page.mouse.down({button});
        await page.mouse.move(x+(i%4<2?28:-28),y,{steps:10});
        if(i===3||i===7) for(const selector of ['.proto-map-fps','.proto-map-zoom']) {
          const rgba=await imagePixels(page,await page.locator(selector).screenshot());let ink=0;
          for(let p=0;p<rgba.length;p+=4)if(Math.min(rgba[p],rgba[p+1],rgba[p+2])>150)ink++;
          assert.ok(ink>30,`${selector} retains actual pixels during the live dawn camera gesture`);
        }
        if(i===3||i===7)assert.ok((await fullFrameInk(page)).every(ink=>ink>30),'Full-frame readouts remain visible during camera movement');
        await page.mouse.up({button});await page.waitForTimeout(100);
      }
      const samples=await page.evaluate(()=>{window.dawnSampling=false;return window.dawnSamples;});
      assert.equal(samples.vanished,0,'No den disappearance during live dawn pan/orbit');
      const defects=await findLayoutDefects(page,'.proto-map-hud',{parts:'.proto-map-footer, .proto-travel-controls'});assert.deepEqual(defects,[]);
      fs.writeFileSync(`artifacts/dawn-flicker/${width}-${art}-${density}x.json`,JSON.stringify({report,denPixels,samples,defects},null,2));
      console.log(JSON.stringify({width,art,density,denPixels,samples,defects}));
      await page.screenshot({path:`artifacts/dawn-flicker/${width}-${art}-${density}x-final.png`});await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
