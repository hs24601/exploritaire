// Profiles the 5 s after one legal play in 222 and 223 and prints frame counts and the hottest functions.
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({ headless:true, executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe', args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
 try {
  for (const scenario of ['222','223']) {
   const page = await browser.newPage({viewport:{width:1912,height:914}});
   await page.goto('http://localhost:5178/proto.html?combatsbx&scenario='+scenario);
   await page.locator('.battle-field[data-vertical-columns] [data-battle-card]').first().waitFor();
   await page.waitForTimeout(8000);
   const frames=()=>page.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r(n/3);};requestAnimationFrame(f);}));
   console.log(scenario,'idle fps',(await frames()).toFixed(1));
   const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');
   const legal=page.locator('.battle-field[data-vertical-columns] [data-battle-card]:not([data-row-inaccessible]):not([disabled])');
   for(let i=0;i<15 && !await legal.count();i++){await page.reload();await page.locator('.battle-field[data-vertical-columns] [data-battle-card]').first().waitFor();await page.waitForTimeout(6000);}
   if(!await legal.count()){console.log(scenario,'no legal play');await page.close();continue;}
   await legal.first().click();await page.mouse.move(3,3);
   console.log(scenario,'fps after play (0-3s)',(await frames()).toFixed(1));
   console.log(scenario,'fps after play (3-6s)',(await frames()).toFixed(1));
   const {profile}=await cdp.send('Profiler.stop');
   const self=new Map(),byId=new Map(profile.nodes.map(n=>[n.id,n]));
   const dt=profile.timeDeltas;profile.samples.forEach((id,i)=>{const n=byId.get(id);const k=n.callFrame.functionName+' '+(n.callFrame.url.split('/').pop()||'')+':'+n.callFrame.lineNumber;self.set(k,(self.get(k)||0)+(dt[i]||0)/1000);});
   console.log([...self].sort((a,b)=>b[1]-a[1]).slice(0,18).map(([k,v])=>'  '+v.toFixed(0).padStart(6)+' ms  '+k).join('\n'));
   const longTasks=await page.evaluate(()=>performance.getEntriesByType('longtask')?.length);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
