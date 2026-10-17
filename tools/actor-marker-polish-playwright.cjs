const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const out='artifacts/actor-marker-polish';fs.mkdirSync(out,{recursive:true});
async function checkRects(p) {
 const surface=await p.locator('.combat-shared-view').boundingBox();
 const actors=JSON.parse(await p.locator('.combat-demo__arena').getAttribute('data-actors'));
 const visible=actors.filter(a=>a.marker.visible);assert.ok(visible.length>0);
 for(const a of visible){const c=a.marker.corners;
  assert.ok(Math.abs(c[0][1]-c[1][1])<1e-7 && Math.abs(c[2][1]-c[3][1])<1e-7,a.id+' horizontal edges');
  assert.ok(Math.abs(c[0][0]-c[3][0])<1e-7 && Math.abs(c[1][0]-c[2][0])<1e-7,a.id+' vertical edges');
  const width=(c[1][0]-c[0][0])*surface.width/2,height=(c[0][1]-c[3][1])*surface.height/2;
  assert.ok(Math.abs(width/height-4)<1e-5,a.id+' stable aspect');assert.ok(width>103.9&&width<156.1,a.id+' readable scale');
 }
 return {surface,visible};
}
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const [width,height,reduced] of [[1912,914,false],[1600,900,false],[1280,720,false],[390,844,false],[844,390,false],[1280,720,true]].filter(([w,h,r])=>!process.env.MARKER_CASES||process.env.MARKER_CASES.split(',').includes(w+'x'+h+(r?'-reduced':'')))) {
  const p=await b.newPage({viewport:{width,height},deviceScaleFactor:width===1280&&!reduced?3:1,reducedMotion:reduced?'reduce':'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');if(height>=500){await p.getByRole('checkbox',{name:'maxAP',exact:true}).check();
  await p.getByRole('button',{name:'Bite',exact:true}).click();await p.locator('[data-battle-target="dark-slime"]').click();await p.getByRole('button',{name:'Pause',exact:true}).click();}
  if(width<900)await p.getByRole('button',{name:'Table',exact:true}).click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena')?.dataset.actors||'[]').filter(a=>a.marker?.corners).length===5);
  for(const view of ['side','overview','party','enemy']){
   await p.locator('.combat-demo__tools > summary').click();await p.locator('[data-view="'+view+'"]').click();await p.locator('.combat-demo__tools > summary').click();await p.waitForTimeout(reduced?150:800);
   const {surface,visible}=await checkRects(p);await p.screenshot({path:out+'/'+width+'-'+reduced+'-'+view+'.png'});
   if(width===1280&&!reduced&&view==='side'){
    const arena=await p.locator('.combat-demo__arena').boundingBox();const a=visible.find(a=>{const c=a.marker.corners;const x=surface.x+(c[0][0]+1)*surface.width/2;const right=surface.x+(c[1][0]+1)*surface.width/2;return x>arena.x+8&&right<arena.x+arena.width-8;});assert.ok(a);
    const c=a.marker.corners,x=surface.x+(c[0][0]+1)*surface.width/2,y=surface.y+(1-c[0][1])*surface.height/2,w=(c[1][0]-c[0][0])*surface.width/2,h=(c[0][1]-c[3][1])*surface.height/2;
    await p.screenshot({path:out+'/bar-3x.png',clip:{x:x-6,y:y-6,width:w+12,height:h+12}});
   }
  }
  const arena=await p.locator('.combat-demo__arena').boundingBox();await p.mouse.move(arena.x+arena.width/2,arena.y+arena.height/2);
  for(let n=0;n<3;n++)await p.mouse.wheel(0,-350);await p.waitForTimeout(150);await checkRects(p);await p.screenshot({path:out+'/'+width+'-'+reduced+'-close.png'});
  assert.deepEqual(await findLayoutDefects(p,'.combat-demo',{parts:'.combat-demo__tools > summary'}),[]);assert.deepEqual(errors,[]);console.log(width,reduced?'reduced':'normal','passed');await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
