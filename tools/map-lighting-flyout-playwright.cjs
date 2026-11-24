const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const base = process.env.PROTO_BASE_URL || 'http://127.0.0.1:5178';
const snapshot = page => page.locator('.proto-map-viewport').evaluate(el => ({
  camera: ['--camera-x','--camera-y','--camera-scale','--camera-yaw'].map(key=>getComputedStyle(el).getPropertyValue(key)),
  actor: el.querySelector('[data-actor-id="hero"]')?.dataset.gridReference,
}));
(async () => {
  fs.mkdirSync('output/map-lighting-flyout', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  try {
    await page.goto(`${base}/roam.html?lightingRenderer=mobile`);
    const button=page.getByRole('button',{name:'Lighting engine options',exact:true});
    await button.waitFor(); await page.waitForTimeout(1100);
    const before=await snapshot(page);
    const sizes=await button.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.nextElementSibling.getBoundingClientRect();return [a.width,a.height,b.width,b.height]});
    assert.deepEqual(sizes,[36,36,36,36]);
    await button.click();
    const flyout=page.getByRole('dialog',{name:'Lighting engine options'});
    await flyout.waitFor();
    const slider=page.getByRole('slider',{name:'Darkness strength'});
    assert.equal(await slider.inputValue(),'25');
    const field=await page.evaluate(async()=>{
      const l=await import('/src/proto/protoLighting.ts'),s=await import('/src/roam/lighting.ts');
      return { ambient:l.getTableLighting(12).ambient, sources:s.ROAM_LIGHTS.map(v=>v.position), far:l.sampleTableLight(0,{x:240,y:0},s.ROAM_LIGHTS).total };
    });
    assert.deepEqual(field,{ambient:0,sources:[{x:0,y:96},{x:0,y:48}],far:0});
    for(const mode of ['mobile','full','off','mobile']) {
      await page.getByRole('combobox',{name:'Lighting renderer'}).selectOption(mode);
      assert.equal(await page.locator('.proto-map').getAttribute('data-lighting-mode'),mode);
      assert.deepEqual(await snapshot(page),before);
    }
    for(const strength of ['15','100']) {
      await slider.fill(strength); await page.waitForTimeout(350);
      assert.equal(await page.locator('.proto-map').getAttribute('data-darkness-strength'),strength);
      await page.screenshot({path:`output/map-lighting-flyout/mobile-${strength}.png`,scale:'css'});
    }
    assert.deepEqual(await findLayoutDefects(page,'.map-lighting-flyout',{parts:'label,select,input,output'}),[]);
    await flyout.screenshot({path:'output/map-lighting-flyout/flyout-3x.png'});
    await page.keyboard.press('Escape'); await flyout.waitFor({state:'detached'});
    assert.equal(await button.getAttribute('aria-expanded'),'false');
    await button.click(); await button.click(); await flyout.waitFor({state:'detached'});
    await button.click(); await page.mouse.click(60,60); await flyout.waitFor({state:'detached'});
    await button.click(); await page.getByRole('combobox',{name:'Lighting renderer'}).selectOption('full');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.screenshot({path:'output/map-lighting-flyout/full-100.png',scale:'css'});
    // Walk three cells away from both emitters and confirm Hero also loses light.
    const point=await page.locator('[data-actor-id="hero"]').evaluate(el=>{
      const at=(dx,dy)=>{const d=document.createElement('div');d.style.cssText=`position:absolute;left:calc(50% + ${+el.dataset.actorX+dx}px);top:calc(50% + ${+el.dataset.actorY+dy}px);width:0;height:0;pointer-events:none`;el.parentElement.append(d);const r=d.getBoundingClientRect();d.remove();return{x:r.x,y:r.y}};
      return{from:at(-10,8),to:at(0,-144)};
    });
    await page.mouse.move(point.from.x,point.from.y);await page.mouse.down();await page.mouse.move(point.to.x,point.to.y,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('[data-actor-id="hero"]').dataset.gridReference==='table:0,-1',null,{timeout:30000});
    await page.locator('[data-route-line="true"]').waitFor({state:'detached',timeout:30000});
    const brightness=await page.locator('[data-table-sectional-sprite="hero"]').evaluate(el=>Number(/brightness\(([^)]+)/.exec(el.style.filter)[1]));
    assert.ok(brightness<.001,`Hero is unlit outside both pools: ${brightness}`);
    await page.screenshot({path:'output/map-lighting-flyout/away.png',scale:'css'});
    await page.goto(`${base}/proto.html?lightingRenderer=mobile`);await button.waitFor();await button.click();await flyout.waitFor();
    assert.deepEqual(await findLayoutDefects(page,'.map-lighting-flyout',{parts:'label,select,input,output'}),[]);
    await page.setViewportSize({width:1912,height:914});await page.waitForTimeout(300);
    await page.screenshot({path:'output/map-lighting-flyout/proto-1912.png',scale:'css'});
    assert.deepEqual(errors,[]);
    console.log('PASS: square LE, flyout open/close/dismiss, all renderer options, strength, two sources/zero ambient, camera retention, Hero walking into real darkness, desktop layout.');
  } catch(e) {await page.screenshot({path:'output/map-lighting-flyout/failure.png',scale:'css'}).catch(()=>{});throw e;}
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
