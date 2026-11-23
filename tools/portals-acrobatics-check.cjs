const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.testPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
  await page.goto((process.env.PORTALS_TEST_ORIGIN??'http://127.0.0.1:5178')+'/portals.html?valley&quality=low');
  await page.waitForFunction(()=>window.__castle1111?.mode==='play',null,{timeout:120000});
  const snapshot=()=>page.evaluate(()=>({hero:__castle1111.hero,platform:__castle1111.platform,exploration:__castle1111.exploration}));
  const button=async(n,down)=>page.evaluate(({n,down})=>testPad.buttons[n]={pressed:down,value:down?1:0},{n,down});
  const axis=async(y)=>page.evaluate(y=>testPad.axes[1]=y,y);
  fs.mkdirSync('artifacts/portals-acrobatics',{recursive:true});
  await button(6,true);await axis(-1);
  await page.waitForFunction(()=>__castle1111.exploration.pose?.action==='crawl'&&__castle1111.exploration.texture?.includes('world-traversal/v1/crawl.png'),null,{timeout:15000});
  const crawl=[],frames=new Set();
  for(let i=0;i<18;i++){const s=await snapshot();crawl.push(s);frames.add(s.exploration.pose.frame);assert(s.platform.grounded);assert(s.platform.crouching);assert(Math.abs(Math.abs(s.exploration.scale[0])-s.exploration.scale[1])<.0001,'crawl must retain uniform proportions');await page.waitForTimeout(70);}
  assert(frames.size>=3,'crawl advances the painted limb poses');
  await page.screenshot({path:'artifacts/portals-acrobatics/crawl.png',timeout:120000});
  await axis(0);await page.waitForTimeout(400);await button(1,true);
  await page.waitForFunction(()=>__castle1111.platform.move==='back'&&!__castle1111.platform.grounded,null,{timeout:5000});
  await button(1,false);const back=[];
  for(let i=0;i<19;i++){const s=await snapshot();back.push(s);assert.equal(s.platform.move,'back','holding LT must not ground pound');await page.waitForTimeout(55);}
  assert(back.some(s=>s.platform.frame===9),'backflip reaches inverted pose');
  await page.waitForFunction(()=>__castle1111.platform.grounded,null,{timeout:5000});
  await button(6,false);await axis(-1);await page.waitForTimeout(800);
  await axis(1);await page.waitForTimeout(220);await button(1,true);
  await page.waitForFunction(()=>__castle1111.platform.move==='side'&&!__castle1111.platform.grounded,null,{timeout:5000});
  const pivot=await snapshot();assert.equal(pivot.exploration.pose.action,'sideflip');await button(1,false);
  await page.waitForTimeout(400);await page.screenshot({path:'artifacts/portals-acrobatics/pivot-flip.png',timeout:120000});
  await axis(0);await page.waitForFunction(()=>__castle1111.platform.grounded,null,{timeout:5000});
  // Keyboard shares the same backflip and release/re-press ground-pound path.
  await page.keyboard.down('KeyC');await page.keyboard.down('Space');
  await page.waitForFunction(()=>__castle1111.platform.move==='back'&&!__castle1111.platform.grounded,null,{timeout:5000});
  await page.keyboard.up('Space');await page.waitForTimeout(130);await page.keyboard.up('KeyC');await page.waitForTimeout(60);await page.keyboard.down('KeyC');
  await page.waitForFunction(()=>__castle1111.platform.move==='pound',null,{timeout:5000});const pound=await snapshot();await page.keyboard.up('KeyC');
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/portals-acrobatics/results.json',JSON.stringify({crawl,back,pivot,pound,errors},null,2));
  console.log('PASS: animated uniform-scale low crawl, LT+B held backflip, delayed running pivot flip, keyboard crouch backflip and release/re-press ground pound; no runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
