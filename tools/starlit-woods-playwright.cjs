const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'artifacts/starlit-woods';
const url = process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html?atmosphere=off';
async function woods(page) {
  await page.goto(url);
  await page.waitForSelector('.proto-game-root');
  await page.evaluate(() => {
    const root = document.querySelector('.proto-game-root');
    let fiber = root[Object.keys(root).find(k => k.startsWith('__reactFiber'))];
    while (fiber && fiber.type?.name !== 'ProtoVariant') fiber = fiber.return;
    fiber.memoizedState.queue.dispatch(state => {
      const tile = state.biomeTiles.find(t => t.id === 'day-one-tree');
      return {...state, selectedBiomeId: tile.id, tableau: tile.tableau, stock: tile.stock,
        foundations: [{card: {id:'woods-receiving', rank:2}, cards:[], count:0}],
        biomeTiles: state.biomeTiles.map(t => t.id === tile.id ? {...t, flags: []} : t),
        worldActors: state.worldActors.map((a,i) => i ? a : {...a, location: 'foundation', biomeId: tile.id, foundationIndex: 0, position: tile.position})};
    });
  });
  await page.waitForSelector('.proto-tableau-landscape[data-ready="true"] canvas', {timeout: 10000}).catch(async e => {
    await page.screenshot({path:`${out}/load-failure.png`});
    console.log(await page.locator('.proto-tableau-field').evaluate(el=>el.outerHTML.slice(0,1500)));
    console.log(await page.locator('.proto-main-layout').getAttribute('data-primary-viewport')); throw e;
  });
  await page.waitForTimeout(400);
}
async function drag(page, from, to, touch) {
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[from]});
    for (let i=1;i<=10;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/10,y:from.y+(to.y-from.y)*i/10}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await cdp.detach();
  } else { await page.mouse.move(from.x,from.y); await page.mouse.down(); await page.mouse.move(to.x,to.y,{steps:10}); await page.mouse.up(); }
}
async function press(page, target, touch) {
  if (!touch) return target.click();
  const b=await target.boundingBox(); assert.ok(b);
  await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
}
(async()=>{
  fs.mkdirSync(out,{recursive:true}); const browser=await chromium.launch({headless:true});
  try {
    for (const [width,height,touch] of [[1280,720,false],[1280,720,true],[1912,914,false],[390,844,true],[844,390,true]]) {
      const page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:touch?'reduce':'no-preference'});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await woods(page);
      const landscape=page.locator('.proto-tableau-landscape'), canvas=landscape.locator('canvas');
      assert.equal(await landscape.getAttribute('data-freecam-enabled'),'true');
      const position=()=>landscape.getAttribute('data-camera-position');
      const initial=await position();
      const first=await canvas.screenshot(); await page.waitForTimeout(550); const second=await canvas.screenshot();
      assert.equal(first.equals(second),touch,'sway animates except under reduced motion');
      await page.screenshot({path:`${out}/${width}-${touch?'touch-reduced':'mouse'}-woods.png`});
      // Find an actual exposed background point, outside controls and card faces.
      const start=await page.locator('.proto-tableau-field').evaluate(field=>{
        const b=field.getBoundingClientRect();
        for(let y=b.y+70;y<b.bottom-40;y+=20)for(let x=b.x+15;x<b.right-15;x+=20){
          const el=document.elementFromPoint(x,y);
          if(el && field.contains(el) && !el.closest('button,a,input,select,[role="button"],[draggable="true"],.playing-card,.proto-foundation,.proto-world-minimap') && !el.closest('.proto-tableau-heading')) return {x,y};
        }
        throw Error('No background available');
      });
      await drag(page,start,{x:start.x+45,y:start.y+15},touch); await page.waitForTimeout(100);
      assert.notEqual(await position(),initial,'background orbit works');
      if (touch) {
        const cdp=await page.context().newCDPSession(page);
        const beforePinch=await position();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y},{x:start.x+20,y:start.y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y:start.y+5},{x:start.x+40,y:start.y+5}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await cdp.detach();
        await page.waitForTimeout(100); assert.notEqual(await position(),beforePinch,'two-finger pinch and pan work');
      } else {
        const beforeWheel=await position(); await page.mouse.move(start.x,start.y); await page.mouse.wheel(0,100); await page.waitForTimeout(100);
        assert.notEqual(await position(),beforeWheel,'mouse wheel zoom works');
      }
      const orbited=await position();
      await page.keyboard.down('w'); await page.waitForTimeout(200); await page.keyboard.up('w');
      const moved=await position();
      assert.notEqual(moved,orbited,'keyboard movement works');
      await press(page,page.getByRole('button',{name:'Woods freecam',exact:true}),touch);
      await drag(page,start,{x:start.x+45,y:start.y+15},touch); await page.waitForTimeout(100);
      assert.equal(await position(),moved,'disabled freecam holds pose');
      await press(page,page.getByRole('button',{name:'Woods freecam',exact:true}),touch);
      const playable=page.locator('.proto-main-tableau .playing-card:not([data-gameplay-disabled="true"]):not([data-buried])').first();
      const count=await page.locator('.proto-main-tableau .playing-card').count();
      const beforeCard=await position(); await press(page,playable,touch);
      await page.waitForFunction(count=>document.querySelectorAll('.proto-main-tableau .playing-card').length<count,count);
      assert.equal(await position(),beforeCard,'card input does not move camera');
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const pixel=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    await pixel.addInitScript(()=>localStorage.setItem('exploritaire.artStyle','pixel'));
    const pixelErrors=[]; pixel.on('pageerror',e=>pixelErrors.push(e.message));
    const pixelAssets=[]; pixel.on('response',r=>{if(r.url().endsWith('/deprecated/pixel/environment/small_woods_pines.png'))pixelAssets.push(r.status());});
    await woods(pixel); assert.ok(pixelAssets.includes(200),'Pixel keeps its own tree artwork');
    await pixel.screenshot({path:`${out}/pixel-woods.png`}); assert.deepEqual(pixelErrors,[]); await pixel.close();
    const page=await browser.newPage({viewport:{width:1280,height:720}}); const errors=[];
    page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(url+'&combatdemo'); await page.waitForSelector('.combat-demo[data-freecam-enabled="true"]');
    await page.waitForFunction(()=>document.querySelector('.combat-demo__arena')?.dataset.actors);
    await page.waitForTimeout(900);
    await page.screenshot({path:`${out}/combat.png`});
    assert.deepEqual(errors,[]); await page.close();
    console.log('PASS starlit woods: motion/reduced motion, default freecam, mouse/touch orbit, keyboard, disabled pose, card input priority, combat');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
