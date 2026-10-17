const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
async function checkFaces(page){
 const result=await page.locator('.proto-map-viewport').evaluate(el=>{
  const v=el.getBoundingClientRect(),bad=[],faces=[];
  for(const card of el.querySelectorAll('[data-world-card][data-exposed="true"]')){
   const corners=[...card.querySelectorAll('[data-travel-card-corner]')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x-v.x,y:r.y-v.y};});
   faces.push(corners);
   if(card.closest('[data-camera-clipped]')||corners.some(p=>p.x<34||p.x>v.width-34||p.y<94||p.y>v.height-110))bad.push({id:card.dataset.worldCard,corners});
  }
  return {bad,faces,actorY:+el.querySelector('[data-board-piece="actor"][data-actor-id="hero"]').dataset.actorY};
 });
 assert.deepEqual(result.bad,[],'all exposed faces have a safe tapping margin');return result;
}
async function checkRanks(page){
 const covered=await page.locator('.proto-map-viewport').evaluate(el=>{
  const cards=[...el.querySelectorAll('[data-world-card][data-exposed="true"]')].map(card=>{
   const rank=card.querySelector('.proto-card-center-rank').getBoundingClientRect();
   return {id:card.dataset.worldCard,center:{x:rank.x+rank.width/2,y:rank.y+rank.height/2},points:[...card.querySelectorAll('[data-travel-card-corner]')].map(p=>{const r=p.getBoundingClientRect();return {x:r.x,y:r.y};})};
  });
  const inside=(p,points)=>{let sign=0;for(let n=0;n<4;n++){const a=points[n],b=points[(n+1)%4],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(cross)<.01)continue;const next=Math.sign(cross);if(sign&&next!==sign)return false;sign=next;}return !!sign;};
  const blocked=cards.filter(card=>cards.some(other=>card!==other&&inside(card.center,other.points))).map(card=>card.id);
  const actor=el.querySelector('[data-board-piece="actor"][data-actor-id="hero"]').getBoundingClientRect();
  if(cards.some(card=>inside({x:actor.x+actor.width/2,y:actor.y+actor.height/2},card.points)))blocked.push('traveling actor');
  return blocked;
 });assert.deepEqual(covered,[],'exposed ranks stay clear of neighboring card faces');
}
(async()=>{const browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/immersive-travel',{recursive:true});try{
 for(const [width,height] of [[1280,720],[1912,914]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:+process.env.FRAME_DPR||3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/proto.html');await page.waitForTimeout(1200);
  const a=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),b=await page.locator('[data-biome-id="day-one-tree"]').boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
  await page.getByRole('button',{name:'Confirm travel',exact:true}).click();await page.waitForTimeout(1200);await checkFaces(page);
  // Actual mouse play at the face, including foreground scenery click-through.
  const rank=page.locator('[data-exposed="true"] button:enabled .proto-card-center-rank').first();const box=await rank.boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(300);
  assert.match(await page.locator('.travel-summary').textContent(),/1\//,'world-card mouse play');
  const initial=await checkFaces(page);
  for(let n=0;n<8;n++){await page.getByRole('button',{name:'Best Move',exact:true}).click();await page.waitForTimeout(100);}
  let moved=false;
  for(let n=0;n<24;n++){await page.waitForTimeout(250);const sample=await checkFaces(page);moved ||= Math.abs(sample.actorY-initial.actorY)>1;}
  assert(moved,'actor moves while camera retains cards');
  const card=page.locator('[data-exposed="true"] button').first();
  await card.dispatchEvent('pointerdown',{button:0,buttons:1,pointerId:77,pointerType:'mouse',isPrimary:true});
  const yaw=()=>page.locator('[data-physical-world]').evaluate(el=>Number(el.style.transform.match(/rotate\(([-.\d]+)deg/)[1]));
  const heldYaw=await yaw();await page.waitForTimeout(100);assert(Math.abs((await yaw())-heldYaw)<.01,'card press steadies camera orientation');
  await card.dispatchEvent('pointerup',{button:0,buttons:0,pointerId:77,pointerType:'mouse',isPrimary:true});
  await page.getByRole('button',{name:'Pause journey',exact:true}).click();await page.waitForTimeout(150);
  const paused=await page.locator('[data-physical-world]').getAttribute('style');await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-physical-world]').getAttribute('style'),paused,'pause freezes camera');
  await checkFaces(page);await checkRanks(page);assert.deepEqual(await findLayoutDefects(page,'.travel-tableau--world',{parts:'.travel-world-hud,.travel-actor-popup,.travel-foundation',minFontSize:16}),[]);
  await page.screenshot({path:`artifacts/immersive-travel/card-framing-${width}-3x.png`});
  // Bright diagnostic view uses the ordinary shared lighting bypass.
  await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByRole('checkbox',{name:'Global lights',exact:true}).uncheck();await page.getByRole('button',{name:'Game settings',exact:true}).click();
  await page.screenshot({path:`artifacts/immersive-travel/card-framing-${width}-bright-3x.png`});
  await page.getByRole('button',{name:'Resume journey',exact:true}).click();
  await page.getByRole('button',{name:'Auto-Solve',exact:true}).click();await page.waitForTimeout(500);
  await page.keyboard.press('d');await page.waitForTimeout(100);
  const released=await page.locator('[data-physical-world]').getAttribute('style');await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-physical-world]').getAttribute('style'),released,'explicit manual camera input releases follow');
  assert.deepEqual(errors,[]);console.log('PASS',width,'full faces remain framed during movement, mouse input, pause, HUD layout, 3x captures');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
