const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.addInitScript(()=>addEventListener('book:platformer-ready',e=>{window.platformer=e.detail;}));
  await page.goto((process.env.BOOK_TEST_URL??'http://127.0.0.1:5178')+'/book.html?page=22',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.platformer==='22',null,{timeout:60000});
  assert.equal(await page.locator('#book-loading').isVisible(),false);assert.equal(await page.locator('#book-navigator').isVisible(),false);
  const canvas=page.locator('#book-stage>canvas');assert.equal(await canvas.getAttribute('data-surface'),'a-start');
  async function clickLedge(id){const point=await page.evaluate(id=>{const p=platformer.ledges.find(p=>p.id===id),c=platformer.camera,v=c.position.clone().set(p.x+p.width/2,1100-p.y,4).project(c);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};},id);await page.mouse.click(point.x,point.y+10);}
  await page.waitForTimeout(1500);await clickLedge('a-gap');
  await page.waitForFunction(()=>['hurdle','jump'].includes(document.querySelector('canvas').dataset.motion),null,{timeout:12000});
  assert(['hurdle','jump'].includes(await canvas.getAttribute('data-hero-clip')));
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.surface==='a-gap',null,{timeout:12000});
  await page.waitForTimeout(1200);await page.screenshot({path:'output/book/platformer-desktop.png'});
  await page.getByRole('button',{name:'Show both pages',exact:true}).click();await page.waitForTimeout(1500);
  await page.screenshot({path:'output/book/platformer-spread.png'});await clickLedge('b-finish');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.target==='b-finish');
  // Advance the live controller with its measured browser glyph widths.
  // This avoids thousands of redundant software-GPU frames in headless CI.
  const climb=await page.evaluate(()=>{const j=platformer.journey;for(let i=0;i<10000&&(j.surface!=='b-vine-2'||j.motion!=='climb');i++)j.update(1/60);return {surface:j.surface,visited:j.visited.size};});
  assert.equal(climb.surface,'b-vine-2');await page.waitForTimeout(100);await page.screenshot({path:'output/book/platformer-climb.png'});
  const complete=await page.evaluate(()=>{const j=platformer.journey;for(let i=0;i<10000&&!j.completed;i++){j.update(1/60);if(j.x<50||j.x>1610||j.y<50||j.y>1030)throw Error('Actor outside page bounds');}return {done:j.completed,visited:j.visited.size,surface:j.surface};});
  assert.equal(complete.done,true);assert.equal(complete.visited,32);assert.equal(complete.surface,'b-finish');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.complete==='true');await page.waitForTimeout(2000);
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.idleAction==='sit');await page.screenshot({path:'output/book/platformer-complete.png'});
  await page.getByRole('button',{name:'Return to checkpoint',exact:true}).click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.complete==='false');
  await page.getByRole('button',{name:'Restart page',exact:true}).click();await page.waitForFunction(()=>document.querySelector('canvas').dataset.surface==='a-start');
  await page.getByRole('button',{name:'Follow Hero',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1500);
  const bounds=await canvas.boundingBox();assert.equal(bounds.width,390);assert.equal(bounds.height,844);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  const actorBounds=await page.evaluate(()=>{const {journey:j,camera:c}=platformer;return [-70,70].map(dx=>{const v=c.position.clone().set(j.x+dx,1100-j.y,26).project(c);return v.x;});});assert(actorBounds.every(x=>Math.abs(x)<.98),JSON.stringify(actorBounds));
  await page.screenshot({path:'output/book/platformer-mobile.png'});await page.waitForTimeout(2000);
  const again=await canvas.boundingBox();assert.equal(again.height,844);assert.equal(again.width,390);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pointClick:true,inferredAerialMove:true,climb:climb.surface,completeRoute:complete,checkpointAndRestart:true,stableMobileViewport:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

