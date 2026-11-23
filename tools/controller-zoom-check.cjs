const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.testPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
  await page.goto('http://127.0.0.1:5178/portals.html?tree&quality=low');
  await page.waitForFunction(()=>window.__castle1111&&document.querySelector('.portals-pause-button'),null,{timeout:120000});
  const snapshot=()=>page.evaluate(()=>({hero:__castle1111.hero,camera:__castle1111.camera}));
  const input=(lb,x,y)=>page.evaluate(({lb,x,y})=>{testPad.buttons[4]={pressed:lb,value:lb?1:0};testPad.axes[0]=x;testPad.axes[1]=y;},{lb,x,y});
  // Controller takeover first adopts the close rear framing; subsequent LB
  // adjustments must remain relative to that view rather than resetting it.
  await input(true,0,0);await page.waitForTimeout(1200);await input(false,0,0);
  const initial=await snapshot();
  await input(true,.6,-1);await page.waitForTimeout(1000);const closer=await snapshot();
  assert(closer.camera.distance<initial.camera.distance*.9&&closer.camera.distance>initial.camera.distance*.55,'slow zoom in');
  assert(Math.hypot(closer.hero.x-initial.hero.x,closer.hero.z-initial.hero.z)<.01,'LB prevents movement on both stick axes');
  await input(true,.6,1);await page.waitForTimeout(1000);const farther=await snapshot();
  assert(farther.camera.distance>closer.camera.distance*1.1,'zoom out');
  await input(true,0,.1);await page.waitForTimeout(100);const heldNeutral=await snapshot();
  await page.waitForTimeout(500);const neutral=await snapshot();
  assert(Math.abs(neutral.camera.distance-heldNeutral.camera.distance)<.01,'dead zone prevents zoom drift');
  await input(false,0,-1);await page.waitForTimeout(700);await input(false,0,0);await page.waitForTimeout(500);const moved=await snapshot();
  assert(Math.hypot(moved.hero.x-neutral.hero.x,moved.hero.z-neutral.hero.z)>.1,'release LB restores movement');
  await page.keyboard.press('l');await page.waitForTimeout(700);const freeBefore=await snapshot();assert(freeBefore.camera.free);
  await input(true,.6,1);await page.waitForTimeout(1000);const freeAfter=await snapshot();
  assert(freeAfter.camera.distance>freeBefore.camera.distance*1.1,'free-camera zoom');
  assert(Math.hypot(...freeAfter.camera.target.map((n,i)=>n-freeBefore.camera.target[i]))<.01,'LB prevents free-camera panning');
  assert(Math.hypot(freeAfter.hero.x-freeBefore.hero.x,freeAfter.hero.z-freeBefore.hero.z)<.01);
  await input(false,0,0);await page.waitForTimeout(150);await page.click('.portals-pause-button');
  const paused=await snapshot();await page.click('[data-settings]');
  const tabBefore=await page.locator('[role=tab][aria-selected=true]').textContent();
  await input(true,0,1);await page.waitForTimeout(500);const tabAfter=await page.locator('[role=tab][aria-selected=true]').textContent();
  assert.notEqual(tabAfter,tabBefore,'LB still switches Settings tabs');
  assert.deepEqual((await snapshot()).camera,paused.camera,'paused camera never zooms');
  assert.deepEqual(errors,[]);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/controller-zoom-check.json',JSON.stringify({initial,closer,farther,neutral,moved,freeBefore,freeAfter,tabBefore,tabAfter,errors},null,2));
  console.log('PASS: LB + left stick zooms slowly both ways; dead zone; no movement/pan; release restores movement; follow/free camera; paused tab behavior.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
