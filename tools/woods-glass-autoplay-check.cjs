const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
 const timer=setTimeout(()=>browser.close(),130000);
 let page;
 try{
  page=await browser.newPage({viewport:{width:1432,height:734}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178/portals.html?combat&quality=low');
  await page.waitForFunction(()=>window.__castle1111?.woods?.location,null,{timeout:65000});
  await page.evaluate(()=>__castle1111.skip());
  await page.waitForFunction(()=>__castle1111.mode==='play'&&__castle1111.camera.overhead&&!__castle1111.camera.transitioning,null,{timeout:25000});
  const initial=await page.evaluate(()=>({cards:__castle1111.woods.foundations.grid.cards,hero:__castle1111.hero}));
  const legal=(a,b)=>[1,12].includes(Math.abs(a-b));
  const choices=initial.cards.filter(c=>{if(!c.pickable)return false;const neighbors=initial.cards.filter(n=>n.index!==c.index&&Math.abs(n.index%18-c.index%18)<=1&&Math.abs(Math.floor(n.index/18)-Math.floor(c.index/18))<=1);return neighbors.some(n=>legal(n.rank,c.rank)&&neighbors.some(m=>m.id!==n.id&&legal(m.rank,n.rank)));}).sort((a,b)=>Math.hypot(a.center[0]-initial.hero.x,a.center[2]-initial.hero.z)-Math.hypot(b.center[0]-initial.hero.x,b.center[2]-initial.hero.z));
  let selected=false;
  for(const card of choices.slice(0,12)){
   const xy=await page.evaluate(async point=>{
    const T=await import('/node_modules/.vite/deps/three.js'),s=__castle1111.camera,c=new T.PerspectiveCamera(s.fov,s.aspect,.12,9000);
    c.position.fromArray(s.position);c.up.fromArray(s.up);c.lookAt(new T.Vector3(...s.target));c.updateMatrixWorld();
    const p=new T.Vector3(point[0],point[1]+.065,point[2]).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
   },card.center);
   await page.mouse.click(xy.x,xy.y);
   const confirm=page.getByRole('button',{name:'Confirm foundation',exact:true});
   if(!await confirm.isVisible())continue;
   await confirm.click();
   if(await page.evaluate(()=>__castle1111.woods.foundations.grid.phase==='play')){selected=true;break;}
   await page.getByRole('button',{name:'Cancel foundation',exact:true}).click();
  }
  assert(selected);
  await page.waitForFunction(()=>__castle1111.woods.foundations.grid.panelVisible&&__castle1111.woods.foundations.grid.fold.state==='folded',null,{timeout:9000});
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.world-grid-panel-window').count(),21);
  assert.equal(await page.locator('.world-grid-panel-card .index,.world-grid-panel-card .reverse').count(),0);
  assert.equal(await page.locator('.world-grid-panel-card .value').count(),9);
  const appearance=await page.locator('.world-grid-panel-card').first().evaluate(el=>{
   const canvas=el.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,colors=new Set();
   for(let i=0;i<data.length;i+=64)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
   const ink=getComputedStyle(el.querySelector('.value'));
   return{colors:colors.size,ink:ink.color,plaque:ink.backgroundColor,width:canvas.width};
  });
  assert(appearance.width>0&&appearance.colors>15,'glass samples live scenery rather than flat paper');
  assert.equal(appearance.ink,'rgb(255, 243, 214)');assert(appearance.plaque.includes('0.96'));
  assert.equal(await page.locator('.world-grid-panel-peek>span').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
  assert.equal(await page.locator('.world-grid-panel-card:enabled').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'2px');
  assert.equal(await page.locator('.world-grid-panel-card:disabled:not([data-foundation=true])').first().evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
  await page.screenshot({path:'output/woods-glass-single-step.png'});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1432,height:734,deviceScaleFactor:3,mobile:false});
  await page.waitForTimeout(150);
  await page.screenshot({path:'output/woods-glass-single-step-3x.png',clip:{x:250,y:108,width:365,height:440}});
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  const before=await page.evaluate(()=>({stock:__castle1111.woods.foundations.grid.fieldCards.length,turn:__castle1111.woods.foundations.turn,length:__castle1111.woods.navi.length}));
  assert(before.length>=2,'a longer legal path exists, to verify tap does not consume it');
  await page.evaluate(()=>{
   window.receipts=[];window.traceAuto=true;let previous=__castle1111.woods.foundations.grid.cards.find(c=>c.foundation)?.id;
   function frame(){if(!traceAuto)return;const id=__castle1111.woods.foundations.grid.cards.find(c=>c.foundation)?.id;if(id&&id!==previous){receipts.push(id);previous=id;}requestAnimationFrame(frame);}frame();
  });
  await page.keyboard.press('ControlLeft');
  await page.waitForFunction(()=>__castle1111.woods.foundations.auto==='idle',null,{timeout:15000});
  await page.waitForTimeout(650);
  const tapped=await page.evaluate(()=>receipts.length);assert.equal(tapped,1,'one Ctrl tap must play exactly one card despite the longer available path');
  assert.equal(await page.evaluate(()=>__castle1111.woods.foundations.turn),'party');
  await page.keyboard.down('ControlRight');await page.waitForTimeout(850);await page.keyboard.up('ControlRight');
  const released=await page.evaluate(()=>receipts.length);assert(released>tapped,'holding Ctrl continues best moves');await page.waitForTimeout(650);
  assert.equal(await page.evaluate(()=>receipts.length),released);assert.equal(await page.evaluate(()=>__castle1111.woods.foundations.auto),'idle');
  assert.equal(await page.evaluate(()=>__castle1111.woods.foundations.turn),'party');
  await page.evaluate(()=>traceAuto=false);assert.deepEqual(errors,[]);
  console.log('PASS: nine center-only opaque rank plaques, small backfill values, clear playable borders and 3x review; one Ctrl tap plays exactly one card despite a longer path, holding continues and release stops without advancing the turn.');
 }catch(error){if(page)await page.screenshot({path:'output/woods-glass-autoplay-failure.png'}).catch(()=>{});throw error;}
 finally{clearTimeout(timer);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
