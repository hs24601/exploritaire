const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Dragging a piece over a biome that accepts it lights the biome up before the
// drop; moving off it, or letting go, clears the cue. Flat and tilted cameras.
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1280,720],[390,844]])for(const tilt of [false,true]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(400);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    if(tilt){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(800);}
    const tag=`${w}x${h} ${tilt?'tilt':'flat'}`;const tile=p.locator('button[data-biome-id="woods-alpha"]');
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await tile.boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height*0.7);await p.mouse.down();
    await p.mouse.move(a.x+a.width/2+30,a.y+a.height*0.7+30,{steps:5});
    if(await tile.getAttribute('data-drop-target'))problems.push(`${tag}: lit before reaching the tile`);
    await p.mouse.move(t.x+t.width/2,t.y+t.height*0.6,{steps:12});await p.waitForTimeout(100);
    if(await tile.getAttribute('data-drop-target')!=='true')problems.push(`${tag}: no cue over Small Woods`);
    const glow=await tile.evaluate(el=>getComputedStyle(el).outlineStyle);if(glow==='none')problems.push(`${tag}: cue has no visible outline`);
    await p.mouse.move(t.x+t.width/2,t.y+t.height*3,{steps:8});await p.waitForTimeout(100);
    if(await tile.getAttribute('data-drop-target'))problems.push(`${tag}: cue stayed after moving off`);
    await p.mouse.move(t.x+t.width/2,t.y+t.height*0.6,{steps:8});await p.mouse.up();await p.waitForTimeout(150);
    if(await tile.getAttribute('data-drop-target'))problems.push(`${tag}: cue stayed after the drop`);
    if(process.env.SHOTS&&!tilt)await p.screenshot({path:`${process.env.SHOTS}/drop-${w}.png`});
    await p.close();
  }
  assert.deepEqual(problems,[],'drop cue defects:\n'+problems.join('\n'));
  console.log('Drop cue: Small Woods lights up only while a dragged Hero is over it, flat and tilted, desktop and phone.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
