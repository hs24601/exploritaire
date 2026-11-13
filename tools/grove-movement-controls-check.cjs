const PORTALS_TEST_ORIGIN=process.env.PORTALS_TEST_ORIGIN||'http://127.0.0.1:5178';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.testPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
  await page.goto(PORTALS_TEST_ORIGIN + '/portals.html?tree&quality=low');
  await page.waitForFunction(()=>window.__castle1111&&document.querySelector('.portals-pause-button'),null,{timeout:120000});
  const snapshot=()=>page.evaluate(()=>({hero:__castle1111.hero,platform:__castle1111.platform,camera:__castle1111.camera}));
  const start=await snapshot();
  await page.evaluate(()=>{testPad.buttons[0]={pressed:true,value:1};testPad.axes[1]=-1;});
  await page.waitForFunction(()=>__castle1111.hero.z<60,null,{timeout:12000});
  const sprint=await snapshot();assert(sprint.platform.grounded,'A must not jump');assert(sprint.platform.sprinting);assert(sprint.hero.speed>8.5);
  await page.evaluate(()=>testPad.buttons[0]={pressed:false,value:0});await page.waitForTimeout(700);
  const run=await snapshot();assert.equal(run.platform.sprinting,false);assert(run.hero.speed>5&&run.hero.speed<8);
  await page.waitForFunction(()=>__castle1111.hero.z<49,null,{timeout:12000});
  await page.evaluate(()=>testPad.axes[1]=0);await page.waitForTimeout(500);const cleared=await snapshot();
  assert(cleared.hero.z<50,'crosses former invisible ivy wall');assert(cleared.platform.grounded);
  await page.evaluate(()=>testPad.buttons[1]={pressed:true,value:1});
  await page.waitForFunction(()=>!__castle1111.platform.grounded&&__castle1111.platform.move==='jump',null,{timeout:5000});
  const jump=await snapshot();
  // A dive becomes legal after the existing .08-second jump launch window.
  await page.waitForTimeout(150);await page.evaluate(()=>{testPad.buttons[1]={pressed:false,value:0};testPad.buttons[2]={pressed:true,value:1};});
  await page.waitForFunction(()=>__castle1111.platform.move==='dive',null,{timeout:5000});
  const dive=await snapshot();await page.evaluate(()=>testPad.buttons[2]={pressed:false,value:0});
  await page.waitForFunction(()=>__castle1111.platform.grounded,null,{timeout:6000});
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/grove-wall-cleared.png',timeout:120000});
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/grove-movement-controls-check.json',JSON.stringify({start,sprint,run,cleared,jump,dive,errors},null,2));
  console.log('PASS: A held sprint; release returns to run; B jumps; X dives; traverses the formerly blocked grove; no runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
