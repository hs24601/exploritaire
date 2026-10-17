const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Buried tableau cards wear the shared silhouette: a veil over the card body
// and resource (the rank stays above it, dimmed), and they take no input and
// never lift on hover. Front-row cards carry no veil, flat or in the upright
// immersive rack. Playing a card exposes the one beneath: its veil sweeps
// away behind the slanted edge and is gone. Desktop sizes, flat and tilted.
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const stage='.proto-tableau-stage';
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const tilt of [false,true]){
    const tag=`${w}x${h} ${tilt?'tilt':'flat'}`;
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto(URL);await p.waitForTimeout(500);
    if(tilt){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('button[data-biome-id="woods-alpha"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
    await p.locator('.proto-actor-energy').waitFor({state:'attached',timeout:15000});await p.waitForTimeout(1200);
    const cards=()=>p.locator(`${stage} button`).evaluateAll(els=>els.map(e=>({id:e.getAttribute('data-card-id')||e.textContent,buried:Boolean(e.dataset.buried),veil:Boolean(e.querySelector('.proto-card-veil')),
      events:getComputedStyle(e).pointerEvents,rank:getComputedStyle(e.querySelector('.proto-card-rank')).zIndex,veilZ:e.querySelector('.proto-card-veil')?getComputedStyle(e.querySelector('.proto-card-veil')).zIndex:null})));
    const all=await cards();const buried=all.filter(c=>c.buried),front=all.filter(c=>!c.buried);
    if(!buried.length)problems.push(`${tag}: no buried cards to check`);
    for(const c of buried){if(!c.veil)problems.push(`${tag}: a buried card has no silhouette veil`);if(c.events!=='none')problems.push(`${tag}: a buried card takes input`);if(!(Number(c.rank)>Number(c.veilZ)))problems.push(`${tag}: a buried card's rank is under its veil`);}
    for(const c of front)if(c.veil)problems.push(`${tag}: a front card still carries a veil`);
    // No hover lift on a buried card.
    const deep=p.locator(`${stage} button[data-buried]`).first();const before=await deep.boundingBox();await p.mouse.move(before.x+before.width/2,before.y+4);await p.waitForTimeout(250);
    const after=await deep.boundingBox();if(Math.abs(after.y-before.y)>0.5)problems.push(`${tag}: a buried card lifts on hover`);
    // Play a front card: the card beneath it loses its veil with a sweep.
    const count=buried.length;
    const playable=p.locator(`${stage} button:not([disabled]):not([data-buried])`).first();await playable.click();
    let swept=false;for(let i=0;i<12;i++){await p.waitForTimeout(80);if(await p.locator(`${stage} button:not([data-buried]) .proto-card-veil`).count()){swept=true;break;}}
    await p.waitForTimeout(1200);
    const later=await cards();
    if(later.filter(c=>c.buried).length!==count-1)problems.push(`${tag}: playing a card didn't expose the one beneath (${count}→${later.filter(c=>c.buried).length} buried)`);
    if(!swept)problems.push(`${tag}: the exposed card's veil didn't sweep away`);
    if(later.some(c=>!c.buried&&c.veil))problems.push(`${tag}: the exposed card kept its veil after the sweep`);
    await p.close();
  }
  assert.deepEqual(problems,[],'tableau silhouette defects:\n'+problems.join('\n'));
  console.log('Tableau silhouettes: buried cards are veiled, take no input and never lift, ranks stay above the veil; front cards carry none; an exposed card sweeps to colour; flat and in the upright rack, 1912x914 and 1280x720.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
