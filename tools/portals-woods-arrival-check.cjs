const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const timer=setTimeout(()=>b.close(),180000);try{
 const context=await b.newContext({viewport:{width:960,height:640}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message);});p.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text().slice(0,1200));});
 await p.goto('http://127.0.0.1:5178/portals.html?quality=low',{waitUntil:'domcontentloaded',timeout:30000});
 try{await p.waitForFunction(()=>window.__castle1111||document.querySelector('#book-error')?.textContent?.includes('could not open'),null,{timeout:75000});assert(await p.evaluate(()=>!!window.__castle1111),await p.locator('body').innerText());}catch(e){console.error('BOOT',await p.locator('body').innerText());await p.screenshot({path:'artifacts/portals-woods-boot-failure.png'});throw e;}
 const initial=await p.evaluate(()=>{const w=__castle1111;return{hero:w.hero,woods:w.woods,arrival:w.arrival,mode:w.mode};});
 assert.equal(initial.woods.location,true);assert.equal(initial.woods.phase,'waiting');assert(Math.abs(initial.hero.x)<.01&&Math.abs(initial.hero.z)<.01);
 const delta={x:initial.woods.enemy[0]-initial.hero.x,z:initial.woods.enemy[2]-initial.hero.z};assert(Math.sin(initial.hero.heading)*delta.x+Math.cos(initial.hero.heading)*delta.z>7);
 await p.evaluate(()=>{window.woodsTrace=[];function trace(){const w=__castle1111;woodsTrace.push({mode:w.mode,arrival:w.arrival,camera:w.camera});if(woodsTrace.length<180)requestAnimationFrame(trace);}requestAnimationFrame(trace);__castle1111.skip();});
 await p.waitForFunction(()=>__castle1111.mode==='play',null,{timeout:55000});
 await p.waitForTimeout(650);
 const settled=await p.evaluate(()=>({camera:__castle1111.camera,hero:__castle1111.hero,woods:__castle1111.woods,trace:woodsTrace}));
 assert(settled.trace.some(s=>s.arrival.woods.inWoods));assert.equal(settled.woods.phase,'waiting');
 const rest=settled.trace.filter(s=>s.mode==='play');assert(rest.length>1);for(const s of rest){for(let i=0;i<3;i++){assert(Math.abs(s.camera.position[i]-settled.camera.position[i])<.001);assert(Math.abs(s.camera.target[i]-settled.camera.target[i])<.001);}}
 const framing=await p.evaluate(async()=>{const THREE=await import('/node_modules/.vite/deps/three.js');const w=__castle1111,c=new THREE.PerspectiveCamera(w.camera.fov,w.camera.aspect,.12,9000);c.position.set(...w.camera.position);c.lookAt(new THREE.Vector3(...w.camera.target));c.updateMatrixWorld();return [new THREE.Vector3(w.hero.x,.55,w.hero.z),new THREE.Vector3(...w.woods.enemy).add(new THREE.Vector3(0,1.3,0))].map(v=>v.project(c).toArray());});
 for(const q of framing)assert(Math.abs(q[0])<.9&&Math.abs(q[1])<.9&&q[2]>-1&&q[2]<1,JSON.stringify(framing));
 await p.screenshot({path:'artifacts/portals-combat-woods-opening.png'});
 await p.evaluate(()=>{__castle1111.replay(true);__castle1111.skip();});await p.waitForFunction(()=>__castle1111.mode==='play',null,{timeout:45000});
 const replay=await p.evaluate(()=>({camera:__castle1111.camera,woods:__castle1111.woods}));assert.equal(replay.woods.phase,'waiting');for(let i=0;i<3;i++)assert(Math.abs(replay.camera.position[i]-settled.camera.position[i])<.001);
 fs.writeFileSync('artifacts/portals-woods-arrival-check.json',JSON.stringify({initial,settled,replay,framing,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({spawn:true,facingEnemy:true,portalCrossing:true,heldLanding:true,bothInFrame:true,replay:true,errors}));
}finally{clearTimeout(timer);await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
