const PORTALS_TEST_ORIGIN=process.env.PORTALS_TEST_ORIGIN||'http://127.0.0.1:5178';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // The book route opens in the grove; portals.html shares this exact travel
  // lifecycle, but intentionally starts in the existing combat woods.
  await page.goto(PORTALS_TEST_ORIGIN + '/book.html?page=1111&quality=low');
  await page.waitForFunction(()=>window.__castle1111,null,{timeout:150000});
  const doors=await page.evaluate(()=>__castle1111.portals);
  assert.deepEqual(doors.map(p=>p.id),['meadow','woods','painted-valley']);
  async function orbit(pixels){
   await page.mouse.move(350,200);await page.mouse.down({button:'middle'});
   await page.mouse.move(350+pixels,200,{steps:10});await page.mouse.up({button:'middle'});
   await page.waitForTimeout(750);
  }
  async function clickDoor(door){
   const point=await page.evaluate(async door=>{
    const THREE=await import('/node_modules/three/build/three.module.js'),view=__castle1111.camera;
    const camera=new THREE.PerspectiveCamera(view.fov,view.aspect,.12,9000);
    camera.position.set(...view.position);camera.up.set(...view.up);camera.lookAt(new THREE.Vector3(...view.target));camera.updateMatrixWorld();
    const p=new THREE.Vector3(door.x,door.y+3,door.z).project(camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
   },door);
   assert(point.x>0&&point.x<1200&&point.y>0&&point.y<800,'portal is in view');
   await page.mouse.click(point.x,point.y);
  }
  await orbit(400);await clickDoor(doors.find(p=>p.id==='painted-valley').entry);
  await page.waitForFunction(()=>__castle1111.meadowPortal.location==='painted-valley',null,{timeout:45000});
  const arrival=await page.evaluate(()=>({hero:__castle1111.hero,platform:__castle1111.platform,portal:__castle1111.meadowPortal,art:__castle1111.meadowArt}));
  assert(arrival.platform.grounded);assert(arrival.art.paintedValley);assert(arrival.portal.preview);
  const d=arrival.portal.door;
  assert(Math.hypot(arrival.hero.x-d.x,arrival.hero.z-d.z)>2,'arrival clears membrane');
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/painted-valley-entered.png',timeout:120000});
  await orbit(438);await clickDoor(d);
  await page.waitForFunction(()=>__castle1111.meadowPortal.location==='grounds',null,{timeout:45000});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/painted-valley-check.json',JSON.stringify({doors,arrival,returned:true,errors},null,2));
  console.log('PASS: three holocards; explicit walk-in; supported valley arrival; live portal view; return to grove; no runtime/shader errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
