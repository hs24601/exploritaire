const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const disk=JSON.parse(fs.readFileSync('src/data/bookScenes.json','utf8'));
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const stale of [true,false]){
   const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
   const draft=structuredClone(disk);draft.chapters[0].scenes[0].shots[0].name='Draft-only obsolete shot';if(stale)draft.revision--;
   await context.addInitScript(d=>localStorage.setItem('exploritaire.book-scene-draft.v1',JSON.stringify(d)),draft);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://zenduo.tail867eff.ts.net/book.html?page=00',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!document.querySelector('#book-navigator [role="treeitem"]'),null,{timeout:90000});
   const result=await page.evaluate(()=>({tree:document.querySelector('#book-navigator [role="tree"]').textContent,status:document.querySelector('#book-navigator output').textContent,archives:Object.keys(localStorage).filter(k=>k.startsWith('exploritaire.book-scene-stale-draft.v1.')).length,dirty:document.querySelector('[data-scene="save"]').classList.contains('is-dirty')}));
   assert.equal(result.tree.includes('Draft-only obsolete shot'),!stale);assert.equal(result.archives,stale?1:0);assert.equal(result.dirty,!stale);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({stale,status:result.status,archives:result.archives,dirty:result.dirty,errors}));await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
