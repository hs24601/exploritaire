const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const fs = require('node:fs');
const OUT = process.env.CLOSEUP_ARTIFACTS || 'artifacts/actor-closeup';
fs.mkdirSync(OUT, { recursive: true });
async function rig(page) {
  return page.locator('.proto-map-viewport').evaluate(el => ({
    x: +el.style.getPropertyValue('--camera-x').replace('px',''),
    y: +el.style.getPropertyValue('--camera-y').replace('px',''),
    scale: +el.style.getPropertyValue('--camera-scale'),
    body: +el.style.getPropertyValue('--actor-world-scale'),
    yaw: +el.style.getPropertyValue('--camera-yaw').replace('deg',''),
    angle: +el.querySelector('.proto-table-stage').style.getPropertyValue('--table-tilt').replace('deg',''),
  }));
}
async function tap(page, locator, touch) {
  if (!touch) return locator.click();
  const r = await locator.boundingBox();
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280,1912]) for (const touch of [false,true]) {
      const page = await browser.newPage({viewport:{width,height:width===1280?720:914},hasTouch:true,deviceScaleFactor:3});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://localhost:5178/proto.html?atmosphere=off');await page.waitForTimeout(1100);
      await tap(page,page.getByRole('button',{name:'Tilt camera view',exact:true}),touch);await page.waitForTimeout(850);
      // Enter at the previous 400% limit to prove magnification exceeds it
      // while preserving the physical actor scale and camera elevation.
      const view=await page.locator('.proto-map-viewport').boundingBox();
      await page.mouse.move(view.x+view.width/2,view.y+view.height/2);await page.mouse.wheel(0,-10000);await page.waitForTimeout(300);
      const before=await rig(page);
      await tap(page,page.getByRole('button',{name:'Actor close-up',exact:true}),touch);await page.waitForTimeout(850);
      const focused=await rig(page);
      assert.equal(focused.body,before.body);assert.equal(focused.angle,before.angle);
      assert.ok(Math.abs(focused.scale/before.scale-3)<.001);
      const actor=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
      const box=await actor.boundingBox();
      assert.ok(box.x+box.width/2>view.x&&box.x+box.width/2<view.x+view.width);
      assert.ok(box.y+box.height/2>view.y&&box.y+box.height/2<view.y+view.height);
      const originalWidth=box.width;
      const slider=page.getByRole('slider',{name:'Actor close-up magnification'});
      await slider.fill('6');await page.waitForTimeout(350);
      const enlarged=await rig(page);
      assert.equal(enlarged.body,before.body);assert.equal(enlarged.angle,before.angle);
      assert.ok(Math.abs(enlarged.scale/before.scale-6)<.001);
      assert.ok((await actor.boundingBox()).width>originalWidth*1.6,'actor visibly grows without world rescaling');
      await slider.fill('3');await page.waitForTimeout(250);
      await tap(page,page.getByRole('button',{name:'Turn table right',exact:true}),touch);await page.waitForTimeout(450);
      const spun=await rig(page), position=await actor.evaluate(el=>({x:+el.dataset.actorX,y:+el.dataset.actorY}));
      assert.ok(Math.abs(spun.x+position.x*spun.scale)<.01&&Math.abs(spun.y+position.y*spun.scale)<.01,'orbit keeps actor at pivot');
      assert.equal(spun.body,before.body);assert.equal(spun.angle,before.angle);
      // Mouse wheel and real two-finger pinch change magnification, not actor scale.
      await page.mouse.move(view.x+view.width*.8,view.y+view.height*.7);
      if(touch){
        const cdp=await page.context().newCDPSession(page), y=view.y+view.height*.7,x=view.x+view.width*.7;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else await page.mouse.wheel(0,-500);
      await page.waitForTimeout(350);
      assert.ok((await rig(page)).scale>spun.scale);assert.equal((await rig(page)).body,before.body);
      // Translation controls cannot turn close-up into a free camera.
      const locked=await rig(page);await page.keyboard.down('w');await page.waitForTimeout(150);await page.keyboard.up('w');
      assert.equal((await rig(page)).y,locked.y);
      assert.deepEqual(await findLayoutDefects(page,'.proto-travel-controls',{parts:'label,input,output'}),[]);
      assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-camera-button,.proto-map-readouts,.table-grid-reference'}),[]);
      await slider.fill('3');await page.waitForTimeout(250);
      await page.screenshot({path:`${OUT}/actor-closeup-${width}-${touch?'touch':'mouse'}-3x.png`});
      await page.keyboard.press('Escape');await page.waitForTimeout(300);
      const restored=await rig(page);for(const key of ['x','y','scale','yaw','body','angle'])assert.ok(Math.abs(restored[key]-before[key])<.001,`restore ${key}`);
      // Flat entry restores the previous flat view; reset exits to defaults.
      await tap(page,page.getByRole('button',{name:'Flat camera view',exact:true}),touch);await page.waitForTimeout(850);
      const flat=await rig(page);await tap(page,page.getByRole('button',{name:'Actor close-up',exact:true}),touch);await page.waitForTimeout(850);
      await tap(page,page.getByRole('button',{name:'Exit actor close-up',exact:true}),touch);await page.waitForTimeout(850);
      assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'),'tabletop');assert.equal((await rig(page)).scale,flat.scale);
      await page.getByRole('button',{name:'Actor close-up',exact:true}).click();await page.waitForTimeout(850);
      await page.getByRole('button',{name:'Reset View',exact:true}).click();await page.waitForTimeout(350);
      assert.equal((await rig(page)).scale,1.7);assert.equal(await page.locator('.proto-map').getAttribute('data-actor-closeup'),'false');
      assert.deepEqual(errors,[]);await page.close();
      console.log(`${width} ${touch?'touch':'mouse'}: fixed scale/elevation, 6× magnification, orbit, wheel/pinch, locked translation, layout, restore and reset passed.`);
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
