const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const results=[];
  for(const jumping of [false,true]){
   const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.testPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[testPad]});});
   await page.goto((process.env.PORTALS_TEST_ORIGIN??'http://127.0.0.1:5178')+'/portals.html?tree&quality=low');
   await page.waitForFunction(()=>window.__castle1111?.mode==='play',null,{timeout:120000});
   await page.mouse.move(350,200);await page.mouse.down({button:'middle'});await page.mouse.move(750,200,{steps:10});await page.mouse.up({button:'middle'});await page.waitForTimeout(700);
   const point=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js'),{treeGround}=await import('/src/book/worldTreeScene.ts');
    const d=__castle1111.portals.find(p=>p.id==='painted-valley').entry,v=__castle1111.camera;
    const x=d.x+Math.sin(d.yaw)*4.2,z=d.z+Math.cos(d.yaw)*4.2;
    const c=new THREE.PerspectiveCamera(v.fov,v.aspect,.12,9000);c.position.set(...v.position);c.up.set(...v.up);c.lookAt(new THREE.Vector3(...v.target));c.updateMatrixWorld();
    const p=new THREE.Vector3(x,treeGround(x,z),z).project(c);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
   });
   assert(point.x>0&&point.x<1200&&point.y>0&&point.y<800,'approach ground in view');
   // Use the existing ground teleport only to set up a precise approach.
   // Crossing itself uses real controller motion, collision and jump input.
   await page.keyboard.down('Control');await page.mouse.click(point.x,point.y);await page.keyboard.up('Control');await page.waitForTimeout(500);
   let airborne=false,entered=false,jumpSent=false;const samples=[];
   for(let i=0;i<160;i++){
    const s=await page.evaluate(({jumping,jumpSent})=>{
     const v=__castle1111,c=v.camera,h=v.hero,d=v.portals.find(p=>p.id==='painted-valley').entry;
     const gap=Math.hypot(d.x-h.x,d.z-h.z),dx=(d.x-h.x)/gap,dz=(d.z-h.z)/gap;
     testPad.axes[0]=dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw);testPad.axes[1]=dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw);
     const jump=jumping&&(jumpSent||gap<3.2);testPad.buttons[1]={pressed:jump,value:jump?1:0};
     return {location:v.meadowPortal.location,hero:h,platform:v.platform,gap,jump,portals:v.portals};
    },{jumping,jumpSent});
    jumpSent||=s.jump;airborne||=!s.platform.grounded;samples.push(s);
    if(s.location==='painted-valley'){entered=true;break;}await page.waitForTimeout(60);
   }
   await page.evaluate(()=>{testPad.axes[0]=testPad.axes[1]=0;testPad.buttons[1]={pressed:false,value:0};});
   fs.mkdirSync('artifacts',{recursive:true});
   fs.writeFileSync(`artifacts/portal-controller-${jumping?'jump':'walk'}.json`,JSON.stringify(samples,null,2));
   assert(entered,'controller enters Painted Valley without Y or click on card');if(jumping)assert(airborne,'jump actually left the ground');assert.deepEqual(errors,[]);
   results.push({jumping,entered,airborne,errors});await page.close();
  }
  console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
