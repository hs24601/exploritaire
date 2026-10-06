const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Switching camera eases the table's lean both ways instead of snapping: the
// angle passes through in-between values, the table stays oversized until it is
// flat again (no far edge showing mid-move), and the Hero pops up as a standee
// on the way up and folds back to its flat board on the way down.
const sampleFrames=(p,ms)=>p.evaluate(ms=>new Promise(done=>{const frames=[];const start=performance.now();
  const view=document.querySelector('.proto-map-viewport').getBoundingClientRect();
  const tick=()=>{const stage=document.querySelector('.proto-table-stage');const cs=getComputedStyle(stage);const actor=document.querySelector('[data-board-piece="actor"]');
    frames.push({t:performance.now()-start,angle:parseFloat(cs.getPropertyValue('--table-tilt')),transform:cs.transform,oversized:stage.offsetWidth>view.width*2,standee:!!actor?.classList.contains('proto-sprite-standee')});
    if(performance.now()-start<ms)requestAnimationFrame(tick);else done(frames);};requestAnimationFrame(tick);}),ms);
(async()=>{const b=await chromium.launch({headless:true});try{
  for(const [w,h] of [[1280,720],[390,844]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.locator('[data-board-piece="actor"]').waitFor();
    await p.getByRole('button',{name:'Tilt camera view'}).click();
    const up=await sampleFrames(p,900);
    const mid=up.filter(f=>f.angle>3&&f.angle<35);
    assert.ok(mid.length>=3,`${w}x${h} tilting passes through in-between angles (${up.map(f=>f.angle.toFixed(0)).join(',')})`);
    assert.ok(up.every(f=>f.transform==='none'||f.oversized||f.angle<0.01),`${w}x${h} the table stays oversized while it leans`);
    assert.ok(!up[0].standee&&up.at(-1).standee,`${w}x${h} the Hero pops up partway through`);
    assert.equal(up.at(-1).angle,38,`${w}x${h} ends fully tilted`);
    await p.getByRole('button',{name:'Flat camera view'}).click();
    const down=await sampleFrames(p,900);
    assert.ok(down.filter(f=>f.angle>3&&f.angle<35).length>=3,`${w}x${h} flattening passes through in-between angles`);
    assert.ok(down.every(f=>f.transform==='none'||f.oversized||f.angle<0.01),`${w}x${h} the far edge never shows while settling flat`);
    assert.ok(down[0].standee&&!down.at(-1).standee,`${w}x${h} the Hero folds back to its board`);
    assert.equal(down.at(-1).transform,'none',`${w}x${h} ends as the plain 2D table`);
    await p.close();
  }
  console.log('Tilt animation: eases both ways through in-between angles, no table edge shows, Hero pops up and folds down.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
