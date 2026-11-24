const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // Render the actual app at exact film times, without waiting for software GPU
  // frames to catch up or substituting a different scene/renderer for screenshots.
  await page.addInitScript(()=>{window.__filmNow=0;performance.now=()=>window.__filmNow;window.__filmFrames=new Map();let id=0;window.requestAnimationFrame=cb=>{window.__filmFrames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>window.__filmFrames.delete(id);window.__filmTick=t=>{window.__filmNow=t;const callbacks=[...window.__filmFrames.values()];window.__filmFrames.clear();callbacks.forEach(cb=>cb(t));};});
  await page.goto((process.env.BOOK_URL||'http://127.0.0.1:5184')+'/book.html?page=02');
  await page.waitForFunction(()=>[...window.__filmFrames.values()].some(cb=>cb.name==='frame'),null,{timeout:60000,polling:100});
  const tick=async(t)=>page.evaluate(t=>{window.__filmTick(t);return {...document.querySelector('canvas').dataset};},t);
  const dir='output/book/forest-film';fs.mkdirSync(dir,{recursive:true});
  let data=await tick(0);assert.equal(data.ready,'true');assert.equal(data.coverOpenness,'0.0000');
  const samples=[];
  for(const [name,time]of [['closed',0],['opening',2150],['forest',4800],['awakening',7300],['lights',10100],['return',14500],['closing',16275],['closed-end',18000]]){
   data=await tick(time);samples.push({name,time,open:data.coverOpenness,camera:data.camera,light:data.forestLight,atmosphere:data.forestAtmosphere,paintCaptures:data.groundPaintCaptures,stands:data.paintedStands,extensions:JSON.parse(data.pageExtensions||'{}'),poses:JSON.parse(data.turnPopupPoses||'{}')});
   await page.screenshot({path:dir+'/'+name+'.png'});
  }
  assert.equal(data.coverOpenness,'0.0000');assert.equal(data.filmState,'complete');assert.equal(Number(data.forestLight),0);
  fs.writeFileSync(dir+'/check.json',JSON.stringify({samples,errors},null,2));
  assert.equal(Object.keys(samples[0].poses).length,22);
  assert.ok(Number(samples[4].stands)>=80);
  assert.ok(Number(samples[4].atmosphere)>.9);
  assert.equal(Number(samples.at(-1).atmosphere),0);
  assert.equal(samples[4].paintCaptures,samples[0].paintCaptures,'Ground paint was captured per frame');
  assert.ok(Object.values(samples[4].extensions).every(n=>n===1));
  assert.ok(Object.values(samples.at(-1).extensions).every(n=>n===0));
  assert.ok(Number(samples[1].open)>.4&&Number(samples[1].open)<.6);
  assert.ok(samples[3].poses['forest-sapling']>.5);assert.ok(Number(samples[4].light)>1);
  assert.ok(Number(samples[6].open)>.4&&Number(samples[6].open)<.6);
  assert.ok(Object.values(samples.at(-1).poses).every(n=>n===0));
  const layout=await findLayoutDefects(page,'#book-right-tools',{parts:':scope > button, :scope > a',minFontSize:16});assert.deepEqual(layout,[]);
  // Replay and input interruption use the same public controls as the user.
  await page.getByRole('button',{name:'Play forest film',exact:true}).click();await tick(18000);await tick(20000);
  assert.ok(Number((await tick(20100)).coverOpenness)>0);
  await page.locator('canvas').focus();await page.keyboard.press('KeyW');data=await tick(20200);await page.keyboard.up('KeyW');assert.equal(data.filmState,'idle');
  await page.setViewportSize({width:1280,height:720});await tick(20300);
  const smallLayout=await findLayoutDefects(page,'#book-right-tools',{parts:':scope > button, :scope > a',minFontSize:16});assert.deepEqual(smallLayout,[]);
  await page.screenshot({path:dir+'/interrupted-1280.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(dir+'/check.json',JSON.stringify({samples,layout,smallLayout,errors},null,2));
  console.log('PASS: 18-second expanded forest, 22 live mechanisms, 80+ painted stands, cached transparent ground paint, atmosphere, through-tree flight, closing/replay/interruption, desktop layout and no browser/shader errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
