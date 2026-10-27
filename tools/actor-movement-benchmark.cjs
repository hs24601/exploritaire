const { chromium } = require('playwright');
const fs = require('node:fs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
(async () => {
 const browser = await chromium.launch();
 const results=[];
 try {
  for (const width of [1280,1912]) {
   const page=await browser.newPage({viewport:{width,height:width===1280?720:914}});
   await page.goto(URL); await page.waitForTimeout(1000);
   const view=await page.locator('.proto-map-viewport').boundingBox(),grip=await page.locator('[data-cell-grip="actor-hero"]').boundingBox();
   await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down({button:'right'});
   await page.mouse.move(view.x+view.width/2,view.y+view.height/2,{steps:10});await page.mouse.up({button:'right'});
   await page.keyboard.press('Space');await page.waitForTimeout(1200);
   await page.mouse.move(view.x+view.width*.8,view.y+view.height*.4);
   await page.mouse.wheel(0,-10000);await page.waitForTimeout(1600);await page.mouse.wheel(0,-1000);await page.waitForTimeout(1200);
   const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');
   for(const moving of [false,true]) {
    const first=(await cdp.send('Performance.getMetrics')).metrics;
    await cdp.send('Profiler.start');
    const frames=await page.evaluate(moving=>new Promise(resolve=>{
     const gaps=[],positions=new Set();let index=0,last=performance.now(),start=last;
     const world=document.querySelector('[data-physical-world]');
     const anchor=document.createElement('i');anchor.style.cssText='position:absolute;width:0;height:0;pointer-events:none';world.append(anchor);
     const timer=moving?setInterval(()=>{
      const point=[[0,48],[48,48],[0,96]][index++%3];anchor.style.left=`calc(50% + ${point[0]}px)`;anchor.style.top=`calc(50% + ${point[1]}px)`;
      const r=anchor.getBoundingClientRect();window.dispatchEvent(new CustomEvent('proto-actor-pointer-drop',{detail:{actorId:'hero',x:r.x,y:r.y}}));
     },450):0;
     function tick(now) {
      gaps.push(now-last);last=now;
      const actor=world.querySelector('[data-board-piece="actor"]');positions.add(`${actor.dataset.actorX},${actor.dataset.actorY}`);
      if(now-start<5000)requestAnimationFrame(tick);else{clearInterval(timer);anchor.remove();gaps.sort((a,b)=>a-b);resolve({fps:gaps.length*1000/(now-start),p95:gaps[Math.floor(gaps.length*.95)],worst:gaps.at(-1),positions:positions.size});}
     }requestAnimationFrame(tick);
    }),moving);
    const {profile}=await cdp.send('Profiler.stop');
    const last=(await cdp.send('Performance.getMetrics')).metrics;
    const metrics=Object.fromEntries(last.filter(m=>/Duration|Count/.test(m.name)).map(m=>[m.name,+(m.value-(first.find(f=>f.name===m.name)?.value||0)).toFixed(3)]));
    const weights=new Map();profile.samples.forEach((id,i)=>weights.set(id,(weights.get(id)||0)+(profile.timeDeltas[i]||0)));
    const hot=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber,ms:Math.round((weights.get(n.id)||0)/1000)})).sort((a,b)=>b.ms-a.ms).slice(0,18);
    const result={width,moving,...frames,metrics,hot};results.push(result);console.log(JSON.stringify(result));await page.waitForTimeout(800);
   }
   await page.close();
  }
 } finally {await browser.close();}
 fs.writeFileSync(`artifacts/actor-movement-${process.env.PERF_STAGE||'before'}.json`,JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
