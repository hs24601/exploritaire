const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const reducedMotion of ['no-preference','reduce']){
   const page=await browser.newPage({viewport:{width:1280,height:844},reducedMotion});
   // Keep this fixture independent of edits/reloads in other active chats.
   await page.routeWebSocket('**/*',()=>{});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:5178/proto.html?combatsbx');
   await page.evaluate(async()=>{
    // Observe the real shader input, independently of its animated texture.
    const locations=new WeakMap(),proto=WebGLRenderingContext.prototype;
    const locate=proto.getUniformLocation,uniform=proto.uniform1f;
    proto.getUniformLocation=function(program,name){const location=locate.call(this,program,name);if(location)locations.set(location,name);return location;};
    proto.uniform1f=function(location,value){if(this.canvas.closest('#growth-fixture')&&locations.get(location)==='u_fill')window.flameFill=value;return uniform.call(this,location,value);};
    const React=(await import('/node_modules/.vite/deps/react.js')).default;
    const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {WebMomentumFlame}=await import('/src/proto/components/WebMomentumFlame.tsx');
    const host=document.createElement('div');host.id='growth-fixture';host.style.cssText='position:fixed;inset:80px auto auto 20px;z-index:999999';document.body.append(host);
    const root=createRoot(host);
    window.showGrowth=(value,animated=true,energy=1)=>root.render(React.createElement(WebMomentumFlame,{variant:0,value,capacity:12,size:180,numbers:true,animated,energy,tailEmphasis:1.65}));
    window.showGrowth(0);
   });
   await page.waitForFunction(()=>window.flameFill===0);
   const fill=()=>page.evaluate(()=>window.flameFill);
   await page.evaluate(()=>window.showGrowth(6));
   await page.waitForFunction(()=>document.querySelector('#growth-fixture strong').textContent==='6');
   if(reducedMotion==='reduce'){
    assert.equal(await fill(),.5,'Reduced motion renders the target directly');
   }else{
    assert.ok(await fill()<.5,'Number updates before the growing front arrives');
    await page.waitForFunction(()=>window.flameFill>0&&window.flameFill<.5);
    const first=await fill();assert.ok(first>0&&first<.5,`Intermediate growth frame: ${first}`);
    await page.evaluate(()=>window.showGrowth(12));
    await page.waitForFunction(previous=>window.flameFill>previous&&window.flameFill<1,first);
    const retarget=await fill();assert.ok(retarget>first&&retarget<1,`Rapid receipts continue growing from current front: ${first} -> ${retarget}`);
    await page.evaluate(()=>window.showGrowth(12,false));
    await page.waitForTimeout(80);const paused=await fill();await page.waitForTimeout(200);assert.equal(await fill(),paused,'Pause holds unfinished growth');
    await page.evaluate(()=>window.showGrowth(12,true));
    await page.waitForFunction(()=>Math.abs(window.flameFill-1)<.002);
    await page.evaluate(()=>window.showGrowth(18));
    await page.waitForFunction(()=>window.flameFill>1&&window.flameFill<1.5);
    await page.waitForFunction(()=>Math.abs(window.flameFill-1.5)<.002);
    await page.evaluate(()=>window.showGrowth(0));
    await page.waitForFunction(()=>window.flameFill>0&&window.flameFill<1.49);
    await page.waitForFunction(()=>window.flameFill===0);
    await page.evaluate(()=>window.showGrowth(12,true,.1));
    await page.waitForTimeout(150);const slow=await fill();assert.ok(slow>0&&slow<.2,'Bullet time slows growth');
   }
   assert.deepEqual(errors,[]);console.log(reducedMotion,'fluid growth, immediate numbers, retargeting, pause, overflow, spending and bullet time passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
