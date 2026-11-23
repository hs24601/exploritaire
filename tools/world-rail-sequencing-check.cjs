const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.PORTALS_TEST_ORIGIN??'http://127.0.0.1:5178')+'/portals.html?tree&quality=low');
  await page.waitForFunction(()=>window.__castle1111?.mode==='play',null,{timeout:120000});
  const pause=page.getByRole('button',{name:'Pause',exact:true});assert.equal((await pause.textContent()).trim(),'');assert.equal(await pause.locator('svg').count(),1);
  await pause.click();await page.getByRole('dialog',{name:'Paused',exact:true}).waitFor();await page.getByRole('button',{name:'Resume',exact:true}).click();
  // Exercise the actual rail against a deterministic long-lived encounter so
  // both shortcuts, full-auto and resource controls remain inspectable.
  await page.evaluate(async()=>{
   const {createWorldWoodsRailPreview}=await import('/src/book/worldWoodsRailPreview.tsx'),{createWorldRailBattle}=await import('/src/book/worldRailBattle.ts');
   window.railHarness=createWorldWoodsRailPreview();window.resetRail=()=>{
    const s=createWorldRailBattle();railHarness.setBattle({...s,tutorial:undefined,rules:{...s.rules,finiteTableau:true},party:s.party.map(a=>({...a,rank:2,charge:6,hp:1000,maxHp:1000})),foes:s.foes.map(f=>({...f,hp:1000,profile:{...f.profile,maxHp:1000}})),columns:Array.from({length:6},(_,i)=>i<4?[{...s.columns[i][0],rank:i+3}]:[]),stock:[]});
   };resetRail();let last=performance.now();const tick=now=>{railHarness.update(true,Math.min(.05,(now-last)/1000));last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  });
  const host=page.locator('.world-woods-rail-preview:not([hidden])'),auto=host.locator('.world-rail-auto');
  await auto.waitFor();assert.equal(await host.getByRole('button',{name:'Withdraw',exact:true}).count(),0);
  for(const key of ['ControlLeft','ControlRight']){
   await page.evaluate(()=>resetRail());await page.keyboard.down(key);await page.waitForTimeout(60);await page.keyboard.up(key);
   try{await page.waitForFunction(()=>railHarness.state.party[0].rank===6&&railHarness.diagnostics.auto==='idle',null,{timeout:6000});}catch(error){console.log(await page.evaluate(()=>({state:railHarness.state,diagnostics:railHarness.diagnostics,active:document.activeElement?.outerHTML,paused:document.querySelector('.portals-pause')?.hidden})));throw error;}
   assert.equal(await page.evaluate(()=>railHarness.state.turn),'party','one sequence does not hand off a turn');
  }
  await page.evaluate(()=>resetRail());await auto.click();await page.waitForFunction(()=>railHarness.state.party[0].rank===6&&railHarness.diagnostics.auto==='idle',null,{timeout:6000});
  await page.evaluate(()=>{resetRail();const input=document.createElement('input');input.id='auto-edit-test';document.body.append(input);input.focus();});
  await page.keyboard.down('ControlLeft');await page.waitForTimeout(350);await page.keyboard.up('ControlLeft');assert.equal(await page.evaluate(()=>railHarness.state.party[0].rank),2,'Ctrl in an editing field must not play');
  await page.evaluate(async()=>{document.getElementById('auto-edit-test').remove();const {gameTime}=await import('/src/gameTime.ts');gameTime.setPaused(true);});
  await page.keyboard.down('ControlRight');await page.waitForTimeout(350);await page.keyboard.up('ControlRight');assert.equal(await page.evaluate(()=>railHarness.state.party[0].rank),2,'pause blocks shortcuts');
  await page.evaluate(async()=>{const {gameTime}=await import('/src/gameTime.ts');gameTime.setPaused(false);});
  await page.evaluate(()=>resetRail());await page.keyboard.down('ControlLeft');await page.waitForFunction(()=>railHarness.diagnostics.auto==='continuous');
  await page.waitForFunction(()=>railHarness.state.round>1,null,{timeout:6000});await page.keyboard.up('ControlLeft');
  await page.waitForFunction(()=>railHarness.diagnostics.auto==='idle');await page.waitForTimeout(300);assert.equal(await auto.getAttribute('data-auto-mode'),'idle');
  // Pointer hold shares the same semantics and releases outside the button.
  await page.evaluate(()=>resetRail());const box=await auto.boundingBox();await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.waitForTimeout(450);
  assert.equal(await auto.getAttribute('data-auto-mode'),'continuous');await page.mouse.move(box.x+100,box.y-80);await page.mouse.up();await page.waitForFunction(()=>railHarness.diagnostics.auto==='idle');
  await page.evaluate(()=>resetRail());await host.getByRole('button',{name:'Familiars',exact:true}).click();
  const panel=host.getByRole('region',{name:'Hero familiars'});await panel.waitFor();await panel.locator('summary').first().click();
  for(const size of [{width:1200,height:800},{width:410,height:400},{width:800,height:430}]){
   await page.setViewportSize(size);await page.waitForTimeout(150);
   const layout=await panel.evaluate(el=>{
    const p=el.querySelector('details[open] p'),actions=el.querySelector('details[open] .world-rail-keru-actions'),r=p.getBoundingClientRect(),a=actions.getBoundingClientRect(),b=el.getBoundingClientRect();
    return {overflow:el.scrollWidth>el.clientWidth+1,descriptionPosition:getComputedStyle(p).position,overlap:r.bottom>a.top+1,bounds:{x:b.x,y:b.y,right:b.right,bottom:b.bottom}};
   });
   assert(!layout.overflow,'no horizontal panel scroll');assert(!layout.overlap,'description precedes actions');assert.equal(layout.descriptionPosition,'static');assert(layout.bounds.x>=0&&layout.bounds.right<=size.width&&layout.bounds.y>=76&&layout.bounds.bottom<=size.height);
   fs.mkdirSync('artifacts/world-rail-sequencing',{recursive:true});await page.screenshot({path:`artifacts/world-rail-sequencing/familiars-${size.width}x${size.height}.png`});
  }
  assert.deepEqual(errors,[]);console.log('PASS: both Ctrl taps, held auto across turns, square tap/hold button and release, no Withdraw, readable familiar disclosures at three viewport sizes; no runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
