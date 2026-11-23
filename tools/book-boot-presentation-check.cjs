const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const query of ['?page=00','?combatsbx','?kirigami']){
   const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),page=await context.newPage();
   let release;const gate=new Promise(resolve=>release=resolve),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/src/book/main.ts*',async route=>{await gate;await route.continue()});
   await page.goto('http://127.0.0.1:5183/book.html'+query,{waitUntil:'commit'});
   await page.locator('#book-navigator').waitFor({state:'attached'});
   assert.equal(await page.locator('#book-navigator').isVisible(),false);assert.equal(await page.locator('#fold').isVisible(),false);
   assert.equal(await page.locator('#book-stage').getAttribute('aria-busy'),'true');release();
   await page.waitForFunction(()=>document.documentElement.dataset.bookBoot==='ready',null,{timeout:90000});
   assert.equal(await page.locator('#book-stage').getAttribute('aria-busy'),'false');
   assert.equal(await page.locator('#book-stage>canvas').isVisible(),true);
   if(query==='?page=00'){assert.equal(await page.locator('[data-scene="save"] svg').count(),1);assert.ok(await page.locator('[role="treeitem"]').count()>0)}
   assert.deepEqual(errors,[]);console.log(JSON.stringify({query,unfinishedShellHidden:true,firstFramePresented:true,errors}));await context.close();
  }
  const page=await browser.newPage();await page.route('**/assets/runtime/**/*.png',route=>route.abort());
  await page.goto('http://127.0.0.1:5183/book.html?page=00',{waitUntil:'domcontentloaded'});
  await page.locator('#book-error').waitFor({state:'visible',timeout:30000});assert.equal(await page.locator('#book-navigator').isVisible(),false);
  console.log(JSON.stringify({startupFailureVisible:true,unfinishedShellHidden:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
