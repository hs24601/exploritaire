const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report=[];
 try{
  for(const number of (process.env.BOOK_CHECK_PAGE?[+process.env.BOOK_CHECK_PAGE]:[2,3])){
   const page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'no-preference'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.addInitScript(()=>{window.__filmNow=0;performance.now=()=>window.__filmNow;window.__frames=new Map();let id=0;window.requestAnimationFrame=cb=>{window.__frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>window.__frames.delete(id);window.__tick=t=>{window.__filmNow=t;const frames=[...window.__frames.values()];window.__frames.clear();frames.forEach(cb=>cb(t));};});
   await page.goto((process.env.BOOK_URL||'http://127.0.0.1:5184')+'/book.html?page='+number);
   await page.waitForFunction(()=>[...window.__frames.values()].some(cb=>cb.name==='frame'),null,{polling:100,timeout:65000});
   const tick=t=>page.evaluate(t=>{window.__tick(t);return {...document.querySelector('canvas').dataset};},t);
   const dir='output/book/magic-paint/page-'+number;fs.mkdirSync(dir,{recursive:true});const samples=[];
   const moments=number===2?[['closed',0],['flat-sketch',2000],['arrival',4100],['spine-shimmer',4800],['cover-lift',7400],['painting',11200],['grove',14200],['painted',17000],['closed-end',20000]]:[['closed',0],['flat-sketch',2000],['cover-lift',7400],['wonder',14000],['step',20000],['bow',25800],['rest',32500],['wide',36500],['closed-end',40000]];
   for(const[name,time]of moments){const d=await tick(time),sample={name,time,phase:d.magicPhase,open:+d.coverOpenness,paint:+d.forestPaint,sparkles:+d.paintSparkles,coverSparkles:d.coverSparkles,shimmer:+d.coverShimmer,lights:+d.forestLight,motes:+d.atmosphericMotes,reads:+d.sparkleSourceReads,groundCaptures:+d.groundPaintCaptures,poses:JSON.parse(d.turnPopupPoses||'{}'),heroes:JSON.parse(d.heroMoments||'{}')};samples.push(sample);await page.screenshot({path:dir+'/'+name+'.png'});}
   fs.writeFileSync(dir+'/check.json',JSON.stringify({samples,errors},null,2));
   const flat=samples.find(s=>s.name==='flat-sketch');assert.equal(flat.open,1);assert.equal(flat.paint,0);assert.equal(flat.lights,0);assert.equal(flat.motes,0);assert.ok(Object.values(flat.poses).every(n=>n===0));
   assert.ok(Object.values(flat.heroes).every(h=>!h.visible));const lift=samples.find(s=>s.name==='cover-lift');assert.equal(lift.paint,0);assert.equal(lift.coverSparkles,'true');assert.ok(lift.open>0&&lift.open<1);assert.ok(Object.values(lift.poses).every(n=>n===0));
   assert.equal(samples.at(-1).open,0);assert.equal(samples.at(-1).paint,1);assert.equal(samples.at(-1).lights,0);assert.equal(samples.at(-1).sparkles,0);assert.ok(samples.every(s=>s.reads===samples[0].reads));assert.ok(samples.every(s=>s.groundCaptures===samples[0].groundCaptures));
   if(number===2){const painting=samples.find(s=>s.name==='painting');assert.ok(painting.sparkles>10);assert.ok(Object.values(painting.poses).some(n=>n>0));assert.equal(samples.find(s=>s.name==='spine-shimmer').coverSparkles,'true');assert.ok(samples.find(s=>s.name==='spine-shimmer').shimmer>0);}
   else for(const [name,id]of [['wonder','hero3-wonder'],['step','hero3-step'],['bow','hero3-bow'],['rest','hero3-rest']]){const s=samples.find(s=>s.name===name),shown=Object.entries(s.heroes).filter(([,h])=>h.visible);assert.equal(shown.length,1);assert.equal(shown[0][0],id);assert.ok(shown[0][1].open>.8);}
   assert.deepEqual(errors,[]);report.push({page:number,samples,errors});await page.close();
  }
  fs.writeFileSync('output/book/magic-paint/check.json',JSON.stringify(report,null,2));
  console.log('PASS: pages 02/03; flat sketch preview, cover-attached magic opening, delayed paint-driven pop-ups, tinted sparkle front, gated atmosphere, Hero-only magical moments, stable image reads/ground captures, closed endpoints and no page/shader errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
