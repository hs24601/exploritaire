const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const context=await b.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const disk=JSON.parse(fs.readFileSync('src/data/bookPages.json','utf8')),old=structuredClone(disk);old.revision--;delete old.pages.find(p=>p.page===1).contentEpoch;
 const exemplar=structuredClone(old.pages.find(p=>p.page===2).controls.find(c=>c.kind==='text'));exemplar.id='stale-home-text';old.pages.find(p=>p.page===1).controls=[exemplar];
 const other=old.pages.find(p=>p.page===2).controls[0];other.name='Unrelated unsaved draft';
 await p.addInitScript(draft=>localStorage.setItem('exploritaire.book-page-draft.v1',JSON.stringify(draft)),old);
 await p.goto('http://localhost:5183/book.html?page=01');await p.waitForFunction(()=>document.querySelector('canvas').dataset.safeFrame,null,{timeout:60000});
 const doc=await p.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')));assert.equal(doc.pages.find(p=>p.page===1).controls.length,0);assert.equal(doc.pages.find(p=>p.page===2).controls[0].name,'Unrelated unsaved draft');
 assert.equal(await p.locator('canvas').getAttribute('data-relief-count'),'0');assert.equal(await p.locator('#page-narrative').textContent(),'');
 await p.getByRole('button',{name:'Page editor',exact:true}).click();assert.equal(await p.locator('[data-control-id]').count(),0);
 await p.screenshot({path:'output/book/page-01-clean-slate.png'});
 await p.getByRole('button',{name:'+ Text box',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')).pages.find(p=>p.page===1).controls.length===1);
 await p.getByRole('button',{name:'+ Popup prop',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')).pages.find(p=>p.page===1).controls.length===2);
 const reopened=await p.context().newPage();reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto('http://localhost:5183/book.html?page=01');await reopened.waitForFunction(()=>document.querySelector('canvas').dataset.safeFrame,null,{timeout:60000});assert.equal(await reopened.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')).pages.find(p=>p.page===1).controls.length),2);await reopened.close();
 assert.deepEqual(errors,[]);console.log('PASS blank 01A/01B, no built-in relief or prose, stale page-one reset, unrelated draft retained, new text and props can be authored');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
