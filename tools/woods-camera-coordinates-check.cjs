const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const timer=setTimeout(()=>browser.close(),180000);try{
 const page=await browser.newPage({viewport:{width:1432,height:734},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|THREE|WebGL/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5178/portals.html?combat&quality=low',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__castle1111?.mode==='play'&&__castle1111.woods?.foundations?.grid?.visible,null,{timeout:120000});
 const read=()=>page.evaluate(()=>({camera:__castle1111.camera,hero:__castle1111.hero,platform:__castle1111.platform,grid:__castle1111.woods.foundations.grid}));
 const near=(a,b,tol=.00001)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
 const initial=await read();near(initial.hero.x,2.4);near(initial.hero.z,3.8);assert.equal(initial.hero.gridCoordinate,'K8');assert(initial.camera.position[1]<3);assert(!initial.camera.overhead);
 assert.equal(new Set(initial.grid.cards.map(c=>c.coordinate)).size,initial.grid.cards.length);assert(initial.grid.cards.every(c=>/^[A-R](?:[1-9]|1[0-4])$/.test(c.coordinate)));
 await page.screenshot({path:'output/woods-camera-default.png'});const beforeToggle=await read();
 await page.keyboard.press('o');await page.waitForFunction(()=>__castle1111.camera.overhead);let top=await read();near(top.camera.position[0],top.hero.x);near(top.camera.position[2],top.hero.z);near(top.camera.target[0],top.hero.x);near(top.camera.target[2],top.hero.z);near(top.camera.position[1]-top.platform.y,17.594658803912374);near(top.camera.up[1],0);near(top.camera.fov,60);
 await page.screenshot({path:'output/woods-camera-overhead.png'});
 await page.keyboard.press('o');const restored=await read();for(let i=0;i<3;i++)near(restored.camera.position[i],beforeToggle.camera.position[i]);await page.waitForTimeout(150);const settled=await read();for(let i=0;i<3;i++)near(settled.camera.position[i],beforeToggle.camera.position[i]);
 await page.evaluate(()=>{const input=document.createElement('input');input.id='woods-edit-check';document.body.append(input);input.focus();});await page.keyboard.press('o');assert(!(await read()).camera.overhead,'typing o must not change camera');await page.evaluate(()=>{document.getElementById('woods-edit-check').remove();document.querySelector('canvas').focus();});
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.keyboard.press('o');assert(!(await read()).camera.overhead,'paused O does nothing');await page.getByRole('button',{name:'Resume',exact:true}).click();
 // Shortcut also works when a combat UX button owns focus.
 await page.getByRole('button',{name:'End turn',exact:true}).focus();await page.keyboard.press('o');assert((await read()).camera.overhead);
 await page.keyboard.down('o');await page.waitForTimeout(120);assert(!(await read()).camera.overhead);await page.keyboard.down('o');assert(!(await read()).camera.overhead,'repeat does not toggle again');await page.keyboard.up('o');await page.keyboard.press('o');
 const beforeJump=await read(),coordinates=beforeJump.grid.cards.map(c=>c.coordinate);
 const choices=beforeJump.grid.cards.filter(c=>c.pickable&&Math.hypot(c.center[0]-beforeJump.hero.x,c.center[2]-beforeJump.hero.z)>.8).sort((a,b)=>Math.hypot(a.center[0]-beforeJump.hero.x,a.center[2]-beforeJump.hero.z)-Math.hypot(b.center[0]-beforeJump.hero.x,b.center[2]-beforeJump.hero.z));
 for(const card of choices.slice(0,8)){
  const screen=await page.evaluate(async point=>{const THREE=await import('/node_modules/.vite/deps/three.js'),s=__castle1111.camera,c=new THREE.PerspectiveCamera(s.fov,s.aspect,.12,9000);c.position.fromArray(s.position);c.up.fromArray(s.up);c.lookAt(new THREE.Vector3(...s.target));c.updateMatrixWorld();const p=new THREE.Vector3(point[0],point[1]+.04,point[2]).project(c);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},card.center);
  await page.mouse.click(screen.x,screen.y);if((await read()).grid.phase==='play')break;
 }
 await page.waitForFunction(()=>__castle1111.woods.foundations.grid.phase==='play'&&__castle1111.platform.grounded,null,{timeout:6000});top=await read();assert(top.camera.overhead);near(top.camera.position[0],top.hero.x);near(top.camera.position[2],top.hero.z);assert.deepEqual(top.grid.cards.map(c=>c.coordinate),coordinates,'tile coordinates survive changed cards');
 await page.screenshot({path:'output/woods-camera-coordinate-detail.png',clip:{x:350,y:120,width:750,height:480}});
 await page.keyboard.press('o');assert(!(await read()).camera.overhead);await page.evaluate(()=>__castle1111.replay(true));await page.waitForFunction(()=>__castle1111.mode==='play'&&__castle1111.hero.x===2.4&&__castle1111.hero.z===3.8,null,{timeout:20000});assert(!(await read()).camera.overhead);
 assert.deepEqual(await findLayoutDefects(page,'.world-woods-rail-preview:not([hidden])',{parts:'.world-rail-preview-foundation,.world-rail-controls'}),[]);assert.deepEqual(errors,[]);
 console.log('PASS: portal-side K8 spawn, low default camera, printed fixed coordinates, O overhead centering/height/up, exact restore, input/pause/repeat guards, button focus, live Hero tracking, stable tile addresses and replay.');
}finally{clearTimeout(timer);await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
