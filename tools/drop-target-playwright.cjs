const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Dragging a piece over a biome that accepts it lights the biome up before the
// drop; moving off it, or letting go, clears the cue. Every other square gets
// the same kind of cue: the one cell under the pointer (by grid square, at any
// spin), red over impassable terrain, gone on drop, and the Hero lands on it.
// Flat and tilted cameras, at 0 and 90 degrees, desktop sizes.
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const tilt of [false,true]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(400);
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
  // Empty squares: the cue follows the square under the pointer.
  for(const [w,h] of [[1912,914],[1280,720]])for(const tilt of [false,true])for(const yaw of [0,90]){
    const tag=`${w}x${h} ${tilt?'tilt':'flat'} ${yaw}° empty squares`;
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(400);
    if(tilt){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    if(yaw){await p.keyboard.press('e');await p.waitForTimeout(450);await p.keyboard.press('e');await p.waitForTimeout(600);}
    // Zoomed out, so the terrain past the clear area is in view.
    const view=await p.locator('.proto-map-viewport').boundingBox();await p.mouse.move(view.x+view.width*0.3,view.y+view.height*0.3);for(let i=0;i<6;i++){await p.mouse.wheel(0,300);await p.waitForTimeout(60);}await p.waitForTimeout(300);
    const grip=await p.locator('[data-cell-grip^="actor-"]').boundingBox();const from={x:grip.x+grip.width/2+4,y:grip.y+grip.height/2+10};
    const o=await p.locator('.table-grid-origin').boundingBox();const to={x:o.x+o.width/2,y:o.y+o.height/2};
    await p.mouse.move(from.x,from.y);await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(from.x+(to.x-from.x)*i/12,from.y+(to.y-from.y)*i/12);await p.waitForTimeout(16);}await p.waitForTimeout(120);
    const cues=await p.locator('[data-cell-cue]').count();const cue=await p.locator('[data-cell-cue]').first().getAttribute('data-cell-cue').catch(()=>null);
    const hover=await p.locator('.table-grid-reference').getAttribute('data-grid-reference');
    if(cues!==1)problems.push(`${tag}: ${cues} cells lit at once`);
    if(cue!=='table:0,0'||hover!=='table:0,0')problems.push(`${tag}: over True Center the cue reads ${cue} (pointer on ${hover})`);
    if(await p.locator('[data-cell-cue][data-cue-blocked]').count())problems.push(`${tag}: an open square shows as blocked`);
    // Out over the impassable terrain past the edge of the clear area, the cue turns red.
    const area=await p.locator('.proto-map-viewport').boundingBox();let reached=false;
    for(const [fx,fy] of [[0.02,0.5],[0.98,0.5],[0.5,0.04],[0.5,0.97],[0.02,0.04],[0.98,0.97]]){
      await p.mouse.move(area.x+area.width*fx,area.y+area.height*fy,{steps:6});await p.waitForTimeout(80);
      const ref=(await p.locator('.table-grid-reference').getAttribute('data-grid-reference')).split(':')[1].split(',').map(Number);
      if(Math.max(...ref.map(Math.abs))>7){reached=true;if(!(await p.locator('[data-cell-cue][data-cue-blocked]').count()))problems.push(`${tag}: terrain square table:${ref} isn't shown as blocked`);break;}
    }
    if(!reached)problems.push(`${tag}: no terrain square in view to try`);
    await p.mouse.move(to.x,to.y,{steps:8});await p.waitForTimeout(80);await p.mouse.up();await p.waitForTimeout(150);
    if(await p.locator('[data-cell-cue]').count())problems.push(`${tag}: the cue stayed after the drop`);
    await p.waitForTimeout(1500);
    const landed=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');if(landed!=='table:0,0')problems.push(`${tag}: the Hero landed on ${landed}, not the cued table:0,0`);
    await p.close();
  }
  assert.deepEqual(problems,[],'drop cue defects:\n'+problems.join('\n'));
  console.log('Drop cue: Small Woods lights up only while a dragged Hero is over it; empty squares light one at a time under the pointer, red over terrain, gone on drop, and the Hero lands there; flat and tilted, 0 and 90 degrees, desktop sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
