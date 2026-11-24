const {chromium}=require('playwright');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{for(const width of [1280,1912]){const p=await b.newPage({viewport:{width,height:width===1280?720:914}});let errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(1200);
assert.equal(await p.locator('[data-road-shape]').count(),3);assert.equal(await p.locator('[data-biome-id="road-crossroads"]').getAttribute('data-explored'),'1.00');
for(const id of ['road-center','road-east','road-crossroads']){assert.deepEqual(await findLayoutDefects(p,`[data-biome-id="${id}"]`,{parts:'.board-object-label'}),[]);}
const origin=await p.locator('.table-grid-origin').boundingBox();const grip=await p.locator('[data-cell-grip="actor-hero"]').boundingBox();await p.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await p.mouse.down();await p.mouse.move(origin.x+origin.width/2,origin.y+origin.height/2,{steps:12});await p.mouse.up();await p.waitForTimeout(1600);assert.equal(await p.locator('[data-biome-id="road-center"]').getAttribute('data-explored'),'1.00');
await p.screenshot({path:`artifacts/roads-${width}-flat.png`});await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);await p.screenshot({path:`artifacts/roads-${width}-tilted.png`});assert.deepEqual(errors,[]);await p.close();}
console.log('Road layout, mouse crossing and flat/immersive rendering passed at 1280 and 1912.');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});

