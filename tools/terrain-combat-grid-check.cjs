const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const timer=setTimeout(()=>browser.close(),180000);try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|THREE|WebGL/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:5178/portals.html?combat&quality=low',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__castle1111?.mode==='play'&&__castle1111.woods?.foundations?.grid?.visible&&__castle1111.woods.foundations.grid.cards.length>0,null,{timeout:120000});
 const state=()=>page.evaluate(()=>({grid:__castle1111.woods.foundations.grid,hero:__castle1111.hero,platform:__castle1111.platform,pose:__castle1111.exploration.pose,camera:__castle1111.camera}));
 const initial=await state();assert.equal(initial.grid.space,'world');assert.equal(initial.grid.phase,'pick');assert(initial.grid.cards.length>100);assert.equal(initial.grid.cardWidth,2);assert(initial.grid.gap<.02);assert(initial.grid.coverage>.985);assert(initial.grid.batched);assert(initial.grid.heightRange[1]<2,'tree collision-box tops must not become card terrain');assert(initial.grid.cards.every(c=>c.vertices>=3&&c.terrainError<.00001&&c.depthTest&&c.depthWrite));assert.equal(await page.locator('.world-combat-grid').count(),0);
 await page.screenshot({path:'output/terrain-grid-pick.png'});
 const coordinates=initial.grid.cards.map(c=>({id:c.id,center:c.center}));await page.setViewportSize({width:1600,height:900});await page.waitForTimeout(150);assert.deepEqual((await state()).grid.cards.map(c=>({id:c.id,center:c.center})),coordinates,'resize leaves world coordinates fixed');
 // Raycast through the real gameplay canvas at an interior floor card.
 let selected;
 for(const card of initial.grid.cards.filter(c=>c.pickable).sort((a,b)=>Math.hypot(a.center[0],a.center[2])-Math.hypot(b.center[0],b.center[2]))){
  const screen=await page.evaluate(async point=>{const THREE=await import('/node_modules/.vite/deps/three.js'),s=__castle1111.camera,camera=new THREE.PerspectiveCamera(s.fov,s.aspect,.12,9000);camera.position.fromArray(s.position);camera.up.fromArray(s.up);camera.lookAt(new THREE.Vector3(...s.target));camera.updateMatrixWorld();const p=new THREE.Vector3(point[0],.06,point[2]).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},card.center);
  await page.mouse.click(screen.x,screen.y);const next=await state();if(next.grid.phase==='play'){selected=card;break;}
 }
 assert(selected,'world click selects a reachable foundation');
 await page.waitForFunction(()=>!__castle1111.platform.grounded,null,{timeout:5000});assert.equal((await state()).platform.jump,3,'actual Hero uses somersault poses');
 await page.getByRole('button',{name:'Pause',exact:true}).click();const held=await state();await page.waitForTimeout(250);assert.deepEqual((await state()).hero,held.hero,'manual pause freezes actual Hero');await page.getByRole('button',{name:'Resume',exact:true}).click();
 await page.waitForFunction(()=>__castle1111.platform.grounded,null,{timeout:6000});const landed=await state();
 assert(Math.hypot(landed.hero.x-selected.center[0],landed.hero.z-selected.center[2])<.02,'actual Hero lands on chosen world card');assert(Math.hypot(landed.grid.selected[0]-selected.center[0],landed.grid.selected[2]-selected.center[2])<.0001,'foundation stays at clicked world position');assert.equal(landed.pose.action,'combatReady');assert.equal(landed.grid.cards.length,initial.grid.cards.length,'selection keeps the entire floor tiled');
 await page.waitForTimeout(250);await page.screenshot({path:'output/terrain-grid-landed.png'});
 const centers=(await state()).grid.cards.map(c=>({id:c.id,center:c.center}));await page.mouse.move(1100,700);await page.mouse.down({button:'middle'});await page.mouse.move(1190,650,{steps:6});await page.mouse.up({button:'middle'});await page.waitForTimeout(150);assert.deepEqual((await state()).grid.cards.map(c=>({id:c.id,center:c.center})),centers,'orbit leaves cards fixed to floor');
 await page.screenshot({path:'output/terrain-grid-orbit.png'});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:3,mobile:false});await page.screenshot({path:'output/terrain-grid-3x.png',clip:{x:510,y:300,width:600,height:390}});
 assert.deepEqual(await findLayoutDefects(page,'.world-woods-rail-preview:not([hidden])',{parts:'.world-rail-preview-foundation,.world-rail-controls'}),[]);
 await page.getByRole('button',{name:'Familiars',exact:true}).click();await page.getByRole('region',{name:'Hero familiars'}).waitFor();
 await page.goto('http://127.0.0.1:5178/3xgrid.html');await page.locator('.card.pickable').first().waitFor();assert.equal(await page.locator('.card').count(),52);await page.locator('.card.pickable').nth(7).click();await page.waitForFunction(()=>!document.querySelector('#foundSlot').hidden);assert(await page.locator('.card[data-peek]').count()>0);
 await page.evaluate(async()=>{
  const {mountGridTableau}=await import('/src/book/gridTableau.js'),holder=document.createDocumentFragment(),stage=document.createElement('div'),board=document.createElement('div');stage.append(board);holder.append(stage);
  const mask=Array(100).fill(true);mask[0]=mask[9]=mask[90]=mask[99]=false;
  const grid=mountGridTableau({stage,board,seed:1234,fieldColumns:10,fieldRows:10,fieldMask:mask,denseBackfill:true});
  const check=(value,message)=>{if(!value)throw Error(message);};check(Object.keys(grid.cards).length===108,'masked field deals 96 cards and 12 stock');check(grid.activate(grid.state.field[55]),'pick in expanded field');
  const slot=grid.state.slots.A1,v=slot.v.length,s=slot.s.length;check(v>1&&s>1,'long directional floor lines');
  for(let i=0;i<6;i++){for(const sl of Object.values(grid.state.slots))grid.cards[sl.top].rank=7;grid.setFoundationRank(7);grid.cards[slot.top].rank=8;check(grid.autoStep(),'dense legal receipt');check(slot.v.length===v&&slot.s.length===s,'receipt refills far end and retains full line lengths');}
  grid.dispose();
 });
 assert.deepEqual(errors,[]);console.log(`PASS: ${initial.grid.cards.length} two-meter cards, ${(100*initial.grid.coverage).toFixed(2)}% tree-ring coverage, narrow seams, batched terrain/depth, persistent floor after selection, resize/orbit stability, Hero flip/landing/pause, layout, Familiars and standalone regression.`);
}finally{clearTimeout(timer);await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
