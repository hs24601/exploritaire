const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const width=Number(process.env.TEST_WIDTH||1912),height=width===1280?720:914;
    const page = await browser.newPage({ viewport: { width, height } });
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/src/proto/components/ProtoMap.tsx*',async route=>{
      const response=await route.fetch(),source=await response.text();
      assert(source.includes('const volumeCamera ='));
      await route.fulfill({response,body:source.replace('const volumeCamera =','window.__questCamera = camera; const volumeCamera =')});
    });
    await page.goto('http://127.0.0.1:5178/proto.html?khad-roots-exposed');
    await page.waitForFunction(() => !document.querySelector('.ink-loader'), { timeout: 60000 });
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-travel-card]:not([data-buried]):not([data-gameplay-disabled])').first().click();
      await page.waitForTimeout(900);
    }
    const pickup = page.locator('[data-found-quest="denser-patch"]');
    await page.waitForFunction(() => document.querySelector('[data-found-quest="denser-patch"]')?.dataset.covered !== 'true');
    await page.waitForTimeout(3000);
    await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(true));
    await page.addStyleTag({content:'*,*::before,*::after{animation-play-state:paused!important;transition:none!important}'});
    await page.waitForTimeout(300);
    fs.mkdirSync('artifacts/quest-lighting-composite', { recursive: true });
    const region = await page.locator('.proto-map-viewport').boundingBox();
    const shots = [];
    for (const [phase, position, opacity] of [['off', '-100%', 0], ['on', '0%', .85], ['end', '100%', .01], ['off-again', '-100%', 0]]) {
      await pickup.evaluate((el, { position, opacity }) => {
        el.style.setProperty('--quest-gleam-position', position);
        el.style.setProperty('--quest-gleam-offset', position);
        el.style.setProperty('--quest-gleam-opacity', String(opacity));
        el.style.setProperty('--quest-edge-glow', String(.55 + opacity / 4));
      }, { position, opacity });
      await page.waitForTimeout(200);
      shots.push(await page.screenshot({ path: `artifacts/quest-lighting-composite/${phase}.png`, omitBackground:true }));
    }
    const changes = await page.evaluate(async ({shots,region}) => {
      const images = await Promise.all(shots.map(async base64 => {
        const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
        const c=document.createElement('canvas'); c.width=img.width;c.height=img.height;
        const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height);
      }));
      return images.slice(1).map(image => {
        let changed=0;
        for(let y=Math.ceil(region.y+220);y<region.y+region.height-85;y++)for(let x=Math.ceil(region.x+10);x<region.x+region.width-10;x++){
          const i=(y*image.width+x)*4;
          if([0,1,2].some(c=>Math.abs(image.data[i+c]-images[0].data[i+c])>2))changed++;
        }
        return changed;
      });
    }, {shots:shots.map(shot=>shot.toString('base64')),region});
    console.log(JSON.stringify({mapPixelsChangedByQuestPhase:changes}));
    assert(changes.every(count=>count===0),'Quest shimmer must not change unrelated map pixels');
    const composition = await pickup.evaluate(el => ({
      blend:getComputedStyle(el.querySelector('.quest-card'),'::after').mixBlendMode,
      isolation:getComputedStyle(el.querySelector('.quest-card')).isolation,
      shadow:getComputedStyle(el,'::before').boxShadow,
      shade:el.closest('.proto-tableau-field').querySelectorAll('.quest-discovery-shade').length,
    }));
    assert.equal(composition.blend,'normal');assert.equal(composition.isolation,'isolate');
    assert.equal(composition.shadow,'none');assert.equal(composition.shade,1);
    const shadeBounds=await page.locator('.quest-discovery-shade').evaluate(el=>{
      const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();
      return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
    });
    assert(shadeBounds<=1,'The dimmer stays bounded to its existing tableau clipping area');
    // Exercise the ongoing camera trajectory while the real quest gleam runs.
    await page.evaluate(async()=>{
      (await import('/src/gameTime.ts')).gameTime.setPaused(false);
      const start={...window.__questCamera.getLiveCamera()};
      window.__questMotion=new Promise(resolve=>{
        const began=performance.now();
        const tick=now=>{
          const t=(now-began)/3600;
          window.__questCamera.setCameraFrame({...start,x:start.x+Math.sin(t*6.28)*65,y:start.y+Math.sin(t*6.28)*35,
            scale:start.scale*(1+Math.sin(t*6.28)*.04),yaw:(start.yaw||0)+Math.sin(t*6.28)*18},false);
          if(t<1)requestAnimationFrame(tick);else resolve();
        };requestAnimationFrame(tick);
      });
    });
    await page.evaluate(()=>window.__questMotion);
    await page.screenshot({path:`artifacts/quest-lighting-composite/moving-${width}.png`});
    const cdp=await page.context().newCDPSession(page),cardBounds=await pickup.boundingBox();
    const detail=await cdp.send('Page.captureScreenshot',{format:'png',clip:{...cardBounds,scale:3}});
    fs.writeFileSync(`artifacts/quest-lighting-composite/card-${width}-3x.png`,Buffer.from(detail.data,'base64'));
    await cdp.detach();
    // Pickup still uses the shared jumbo travel and removes its field veil.
    await page.evaluate(async () => (await import('/src/gameTime.ts')).gameTime.setPaused(false));
    await pickup.click();
    await page.waitForFunction(()=>!document.querySelector('.quest-discovery-shade'));
    assert.deepEqual(errors,[]);
    console.log('Quest phases leave the map unchanged; bounded shade and pickup cleanup passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
