const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5178/artifacts/world-foundations-preview.html',{waitUntil:'domcontentloaded',timeout:20000});
 await p.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:45000});
 const inspect=()=>p.evaluate(()=>{const a=__foundations,root=a.scene.foundations.root,meshes=root.children.filter(m=>m.visible);return{diagnostics:a.scene.foundations.diagnostics,panels:meshes.map(m=>{const p=m.geometry.attributes.position;let maxX=0,maxY=0;for(let i=0;i<p.count;i++){const v=m.position.clone().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).project(a.camera);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}return{name:m.name,depthTest:m.material.depthTest,depthWrite:m.material.depthWrite,position:m.position.toArray(),quaternion:m.quaternion.toArray(),renderOrder:m.renderOrder,maxX,maxY};}),draws:a.renderer.info.render.calls};});
 const opening=await inspect();assert.equal(opening.diagnostics.ground,'party');assert.equal(opening.panels.length,2);assert(opening.panels.every(m=>m.depthTest&&m.depthWrite));assert(opening.panels.every(m=>m.maxX<1&&m.maxY<1),'opening foundations fit in frame');
 assert.equal(opening.diagnostics.tableaus.columns,6);assert.equal(opening.diagnostics.tableaus.cards,24);assert.equal(opening.diagnostics.tableaus.left,3);assert.equal(opening.diagnostics.tableaus.right,3);
 const tableau=await p.evaluate(()=>{const a=__foundations,list=a.scene.foundations.tableaus.root.children;return {count:list.length,sameAngle:list.every(m=>m.quaternion.angleTo(list[0].quaternion)<.00001),columns:[...new Set(list.map(m=>m.userData.tableau.column))],depth:list.every(m=>m.material.depthTest&&m.material.depthWrite),sharedAtlas:new Set(list.map(m=>m.material.map.uuid)).size};});
 assert.equal(tableau.count,24);assert.equal(tableau.sameAngle,true);assert.equal(tableau.columns.length,6);assert.equal(tableau.depth,true);assert.equal(tableau.sharedAtlas,1);
 await p.screenshot({path:'artifacts/world-foundations-opening.png'});
 await p.evaluate(()=>__foundations.reverse());const reverse=await inspect();assert.equal(reverse.diagnostics.ground,'enemy');assert.equal(reverse.diagnostics.billboard,'party');
 await p.screenshot({path:'artifacts/world-foundations-reverse.png'});
 await p.evaluate(()=>{__foundations.opening();__foundations.damage();});const damage=await inspect();assert.equal(damage.diagnostics.party.hp,17);assert.equal(damage.diagnostics.party.detail,'AP 3/6');assert.equal(damage.diagnostics.enemy.hp,6);
 await p.screenshot({path:'artifacts/world-foundations-damage.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/world-foundations-check.json',JSON.stringify({opening,reverse,damage,tableau,errors},null,2));console.log(JSON.stringify({panels:2,tableau,opening:true,reverse:true,liveValues:true,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
