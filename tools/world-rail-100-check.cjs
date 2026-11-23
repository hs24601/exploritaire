const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{let seed=370;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto('http://127.0.0.1:5178/artifacts/world-rail-preview.html',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>window.__worldRail?.state,null,{timeout:30000});
 const state=await page.evaluate(()=>({scenario:__worldRail.state.sandboxScenario,ap:__worldRail.state.party[0].charge,adept:__worldRail.state.party[0].adept,kit:__worldRail.state.keruInvoke?.kit}));assert.equal(state.scenario,'100');assert.equal(state.ap,0);assert.equal(state.adept,undefined);assert.equal(state.kit,'upkeep');
 assert.equal(await page.locator('.battle-field,.combat-sandbox').count(),0);
 const ratios={};for(const width of [1280,1912,900,640]){
  await page.setViewportSize({width,height:width===1912?914:720});await page.evaluate(()=>__worldRail.render());
  ratios[width]=await page.locator('[data-rail-card]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return r.width/r.height;}));
  for(const ratio of ratios[width])assert(Math.abs(ratio-63/88)<.001);
 }
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>__worldRail.render());
 // The canonical random opening may have no adjacent card. Author one legal
 // exposed rank in this isolated fixture to exercise the receipt UI reliably.
 await page.evaluate(()=>{const s=__worldRail.state,columns=s.columns.map(c=>c.slice()),last=columns[0].length-1;columns[0][last]={...columns[0][last],rank:s.party[0].rank===13?1:s.party[0].rank+1};__worldRail.world.scene.foundations.setBattle({...s,columns});});
 const card=page.locator('[data-legal=true]').first(),rank=await card.locator('span').textContent();await card.click();await page.locator('[data-rail-actor=hero]').click();
 const flight=page.locator('.world-rail-card-flight');if(await flight.count()){const r=await flight.evaluate(e=>{const r=e.getBoundingClientRect();return r.width/r.height;});assert(Math.abs(r-63/88)<.001);}
 await page.waitForFunction(()=>__worldRail.state.party[0].charge===1);assert.equal(await page.locator('.world-rail-pips i[data-on]').count(),1);
 await page.screenshot({path:'artifacts/world-rail-100.png'});
 const parts='.world-rail-preview-foundation,.world-rail-preview-tableau,.world-rail-controls,.world-rail-preview-hint',layout1280=await findLayoutDefects(page,'.world-woods-rail-preview',{parts});
 await page.setViewportSize({width:1912,height:914});await page.evaluate(()=>__worldRail.render());const layout1912=await findLayoutDefects(page,'.world-woods-rail-preview',{parts});await page.screenshot({path:'artifacts/world-rail-100-wide.png'});
 await page.getByRole('button',{name:'Familiars',exact:true}).click();await page.locator('.world-rail-keru details').filter({has:page.locator('summary',{hasText:'Riv'})}).locator('summary').click();
 await page.getByRole('button',{name:'Surge → Hero',exact:true}).click();assert.equal(await page.evaluate(()=>__worldRail.state.party[0].charge),3);assert.equal(await page.evaluate(()=>__worldRail.state.keruInvoke.exhausted.riv),true);
 const cir=page.locator('.world-rail-keru details').filter({has:page.locator('summary',{hasText:'Cir'})});await cir.locator('summary').click();await cir.getByRole('button',{name:/Familiarize/}).click();await cir.getByRole('button',{name:'Feed 1 AP',exact:true}).click();assert.equal(await page.evaluate(()=>__worldRail.state.party[0].harness.cir),1);await cir.getByRole('button',{name:'Dismiss',exact:true}).click();assert(await page.evaluate(()=>__worldRail.state.keruInvoke.cooldown.cir>0));
 await page.getByRole('button',{name:'Familiars',exact:true}).click();
 await page.evaluate(()=>{const w=__worldRail.world;w.camera.position.set(5.8,2,-3.8);w.camera.lookAt(3.3,1,-7.3);w.camera.updateMatrixWorld();w.renderer.render(w.scene.scene,w.camera);});await page.screenshot({path:'artifacts/khadroot-mixed-paint.png'});
 const materials=await page.evaluate(()=>{const out={};__worldRail.world.scene.scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.customProgramCacheKey().includes('continuous-mixed-surface-1-true'))out[m.uuid]={color:m.color.getHexString(),type:m.type};}});return Object.values(out);});assert.equal(materials.length,4);assert.deepEqual(materials.map(m=>m.color).sort(),['35443a','422531','c65d70','f34b65']);
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{__worldRail.world.opening?.();__worldRail.render();});
 const zoom=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:3});await zoom.goto('http://127.0.0.1:5178/artifacts/world-rail-preview.html',{waitUntil:'domcontentloaded'});await zoom.waitForSelector('[data-rail-card]');await zoom.locator('.world-rail-preview-tableau').screenshot({path:'artifacts/world-rail-100-cards-3x.png'});await zoom.close();
 const result={state,ratios,rank,layout1280,layout1912,materials,familiarActions:true,errors};fs.writeFileSync('artifacts/world-rail-100-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.deepEqual(errors,[]);assert.deepEqual(layout1280,[]);assert.deepEqual(layout1912,[]);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
