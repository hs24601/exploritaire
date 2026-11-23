const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{window.__filmNow=0;performance.now=()=>window.__filmNow;window.__frames=new Map();let id=0;window.requestAnimationFrame=cb=>{window.__frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>window.__frames.delete(id);window.__tick=t=>{window.__filmNow=t;const frames=[...window.__frames.values()];window.__frames.clear();frames.forEach(cb=>cb(t));};});
  await page.goto((process.env.BOOK_URL||'http://127.0.0.1:5184')+'/book.html?page=04',{waitUntil:'commit',timeout:20000});
  await page.waitForFunction(()=>[...window.__frames.values()].some(cb=>cb.name==='frame'),null,{polling:100,timeout:60000});
  const dir='output/book/mochi-woodland';fs.mkdirSync(dir,{recursive:true});const samples=[];
  const moments=process.env.BOOK_CHECK_FOCUS==='tree'?[['closed',0],['tree-opening',31400],['tree',36000],['rest',43000],['closed-end',50000]]:[['closed',0],['flat-sketch',2000],['cover-lift',7400],['wonder',14000],['step',20700],['stretch',27000],['tree-opening',31400],['tree',36000],['rest',43000],['wide',46500],['closed-end',50000]];
  for(const[name,time]of moments){const d=await page.evaluate(t=>{window.__tick(t);return {...document.querySelector('canvas').dataset};},time);const sample={name,time,open:+d.coverOpenness,paint:+d.forestPaint,sparkles:+d.paintSparkles,light:+d.forestLight,motes:+d.atmosphericMotes,reads:+d.sparkleSourceReads,captures:+d.groundPaintCaptures,heroes:JSON.parse(d.heroMoments||'{}'),mochi:JSON.parse(d.mochiMoments||'{}'),poses:JSON.parse(d.turnPopupPoses||'{}')};samples.push(sample);await page.screenshot({path:dir+'/'+name+'.png'});}
  fs.writeFileSync(dir+'/check.json',JSON.stringify({samples,errors},null,2));
  const flat=samples.find(s=>s.name==='flat-sketch');if(flat){assert.equal(flat.open,1);assert.equal(flat.paint,0);assert.equal(flat.motes,0);assert.equal(flat.light,0);assert.ok(Object.values(flat.mochi).every(m=>!m.visible));assert.ok(Object.values(flat.poses).every(n=>n===0));}
  for(const [name,id]of [['wonder','mochi4-wonder'],['step','mochi4-step'],['stretch','mochi4-stretch'],['tree','mochi4-tree'],['rest','mochi4-rest']]){const s=samples.find(s=>s.name===name);if(!s)continue;const shown=Object.entries(s.mochi).filter(([,m])=>m.visible);assert.equal(shown.length,1);assert.equal(shown[0][0],id);assert.ok(shown[0][1].open>.98);if(name==='tree')assert.equal(shown[0][1].combined,true);}
  const opening=samples.find(s=>s.name==='tree-opening');assert.ok(opening.mochi['mochi4-tree'].open>0&&opening.mochi['mochi4-tree'].open<1);
  assert.equal(samples.at(-1).open,0);assert.equal(samples.at(-1).paint,1);assert.equal(samples.at(-1).light,0);assert.equal(samples.at(-1).sparkles,0);assert.ok(samples.every(s=>s.reads===samples[0].reads&&s.captures===samples[0].captures));assert.ok(samples.every(s=>Object.keys(s.heroes).length===0));assert.deepEqual(errors,[]);
  console.log('PASS: page 04, five exclusive Mochi moments, connected tree actuation, flat sketch preview, closed endpoints, stable pigment reads/captures and no page/shader errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
