const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
await p.goto('http://localhost:5183/book.html?page=00');await p.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',null,{timeout:60000});
const doc=()=>p.locator('[aria-label="Book scene document JSON"]').inputValue().then(JSON.parse);
const context=async(id,action)=>{await p.locator('.book-tree-row[data-id="'+id+'"]').click({button:'right'});await p.getByRole('menuitem',{name:action,exact:true}).click();};
const name=async value=>{await p.getByLabel('Scene item name').fill(value);await p.getByRole('button',{name:'Apply',exact:true}).click();await p.waitForFunction(value=>document.querySelector('[aria-label="Book scene document JSON"]').value.includes(value),value);};
await context('scene-page-1','Go to');await p.waitForFunction(()=>document.querySelector('canvas').dataset.scene==='den',null,{timeout:30000});
await context('scene-page-1','Rename');await name('Playtest clearing');assert.equal((await doc()).chapters[0].scenes[1].name,'Playtest clearing');
await context('shot-page-1','Copy as');await name('Playtest second shot');let d=await doc();const copied=d.chapters[0].scenes[1].shots[1].id;
await p.locator('.book-tree-row[data-id="shot-page-1"]').click();await p.getByRole('button',{name:'Move shot down',exact:true}).click();await p.waitForFunction(()=>JSON.parse(document.querySelector('[aria-label="Book scene document JSON"]').value).chapters[0].scenes[1].shots[1].id==='shot-page-1');await p.getByRole('button',{name:'Move shot up',exact:true}).click();
await p.locator('[data-scene="chapter"]').click();await name('Playtest chapter');d=await doc();const chapter=d.chapters.at(-1);
await p.locator('.book-scene-tree').evaluate(el=>el.scrollTop=el.scrollHeight);
await p.locator('.book-tree-row[data-id="'+copied+'"]').dragTo(p.locator('.book-tree-row[data-id="'+chapter.id+'"]'));
await p.waitForFunction(()=>JSON.parse(document.querySelector('[aria-label="Book scene document JSON"]').value).chapters.at(-1).scenes.length>0);
d=await doc();assert.equal(d.chapters.at(-1).scenes[0].shots[0].id,copied);assert.equal(d.chapters.at(-1).scenes[0].page,1);
await p.reload();await p.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',null,{timeout:60000});assert.equal((await doc()).chapters.at(-1).name,'Playtest chapter');
await p.route('**/__book-scenes/save',route=>route.fulfill({status:500,body:'Test unavailable disk'}));await p.locator('[data-scene="save"]').click();await p.waitForFunction(()=>document.querySelector('#book-navigator output').textContent.includes('Save failed'));assert.equal((await doc()).chapters.at(-1).name,'Playtest chapter');await p.unroute('**/__book-scenes/save');
await p.screenshot({path:'output/book/scene-navigator.png'});
// Real disk validation saves the existing authored file unchanged except revision.
const original=JSON.parse(fs.readFileSync('src/data/bookScenes.json','utf8'));
await p.locator('.book-scene-json>summary').click();await p.getByLabel('Book scene document JSON').fill(JSON.stringify(original));await p.locator('[data-scene="import"]').click();
const responsePromise=p.waitForResponse(r=>r.url().includes('/__book-scenes/save')&&r.request().method()==='POST');await p.locator('[data-scene="save"]').click();const response=await responsePromise;assert.equal(response.status(),200,await response.text());const saved=await response.json();assert.equal(saved.revision,original.revision+1);assert.deepEqual(saved.chapters,original.chapters);assert.deepEqual(JSON.parse(fs.readFileSync('src/data/bookScenes.json','utf8')),saved);
const stale=await p.request.post('http://localhost:5183/__book-scenes/save',{data:{document:original,baseRevision:original.revision}});assert.equal(stale.status(),409);
const fresh=await b.newPage({viewport:{width:1280,height:800}});await fresh.goto('http://localhost:5183/book.html?page=00');await fresh.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',null,{timeout:60000});assert.equal(JSON.parse(await fresh.getByLabel('Book scene document JSON').inputValue()).revision,saved.revision);assert.deepEqual(errors,[]);
console.log('PASS tree selection/context go-to/rename/copy, chapter drag, draft reload, failed-save preservation, real disk save, conflict rejection and fresh-context persistence');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
