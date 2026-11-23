const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1736,height:914},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.testPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
  await page.goto('http://127.0.0.1:5178/portals.html?tree&quality=low');
  await page.waitForFunction(()=>window.__castle1111&&document.querySelector('.portals-pause-button'),null,{timeout:120000});
  const snapshot=()=>page.evaluate(()=>({hero:__castle1111.hero,platform:__castle1111.platform,camera:__castle1111.camera}));
  const initial=await snapshot();
  await page.evaluate(()=>{testPad.axes[0]=.1;testPad.axes[1]=-.1;});await page.waitForTimeout(350);
  assert.equal((await snapshot()).camera.distance,initial.camera.distance,'connection/drift cannot acquire camera');
  await page.evaluate(()=>{testPad.axes[0]=testPad.axes[1]=0;testPad.buttons[4]={pressed:true,value:1};});await page.waitForTimeout(1400);
  const rear=await snapshot();
  assert(Math.abs(rear.camera.distance-4.5)<.001);assert(Math.abs(rear.camera.pitch-.13)<.001);
  const dx=rear.camera.position[0]-rear.hero.x,dz=rear.camera.position[2]-rear.hero.z;
  assert(Math.abs(dx*Math.cos(rear.hero.heading)-dz*Math.sin(rear.hero.heading))<.04,'no lateral shoulder offset');
  assert(dx*Math.sin(rear.hero.heading)+dz*Math.cos(rear.hero.heading)<-4,'camera is behind Hero');
  const framing=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js'),w=__castle1111,v=w.camera,c=new THREE.PerspectiveCamera(v.fov,v.aspect,.12,9000);
   c.position.set(...v.position);c.up.set(...v.up);c.lookAt(new THREE.Vector3(...v.target));c.updateMatrixWorld();
   return [0,1.1].map(y=>new THREE.Vector3(w.hero.x,w.platform.y+y,w.hero.z).project(c).toArray());
  });
  assert(Math.abs(framing[0][0])<.03);const height=Math.abs(framing[1][1]-framing[0][1])/2;
  assert(height>.13&&height<.23,'screenshot-scale Hero framing');
  fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/controller-rear-framing.png',timeout:120000});
  await page.evaluate(()=>testPad.axes[1]=-1);await page.waitForTimeout(700);
  await page.evaluate(()=>{testPad.axes[1]=0;testPad.buttons[4]={pressed:false,value:0};testPad.axes[2]=.5;});await page.waitForTimeout(400);
  await page.evaluate(()=>testPad.axes[2]=0);await page.waitForTimeout(200);const adjusted=await snapshot();
  assert(adjusted.camera.distance<rear.camera.distance*.9,'LB changes preset zoom');
  assert(Math.abs(adjusted.camera.yaw-rear.camera.yaw)>.1,'right stick changes preset orbit');
  await page.waitForTimeout(400);assert.equal((await snapshot()).camera.distance,adjusted.camera.distance,'idle controller never resets zoom');
  await page.mouse.move(500,220);await page.mouse.down({button:'middle'});await page.mouse.move(700,220,{steps:10});await page.mouse.up({button:'middle'});
  await page.evaluate(()=>testPad.buttons[4]={pressed:true,value:1});await page.waitForTimeout(1200);const reacquired=await snapshot();
  assert(Math.abs(reacquired.camera.distance-4.5)<.001);assert(Math.abs(Math.sin(reacquired.camera.yaw-reacquired.hero.heading-Math.PI))<.001);
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/controller-framing-check.json',JSON.stringify({initial,rear,framing,adjusted,reacquired,errors},null,2));
  console.log('PASS: neutral/drift ignored; close screenshot-scale rear view; centered boom; LB zoom and orbit retained; mouse/controller takeover.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
