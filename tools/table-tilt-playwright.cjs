const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// Tilted camera: the table leans back, actors stand up as standees, pointer
// input still lands on the table cell under it, and Flat restores the 2D view.
const TOOLBAR={parts:'.proto-map-toolbar button'};
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const toggle=p.getByRole('button',{name:'Tilt camera view'});await toggle.click();await p.waitForTimeout(300);
    const stage=p.locator('.proto-table-stage');assert.match(await stage.evaluate(el=>getComputedStyle(el).transform),/matrix3d/,`${w}x${h} table plane tilts`);
    (await findLayoutDefects(p,'.proto-map-toolbar',TOOLBAR)).forEach(d=>problems.push(`${w}x${h} toolbar: ${d}`));
    const actor=p.locator('[data-board-piece="actor"]');const box=await actor.boundingBox();assert.ok(box.height>box.width*1.1,`${w}x${h} Hero stands up (${box.width}x${box.height})`);
    // Drop Hero two cells right of where it stands; it must arrive where the pointer said.
    const view=await p.locator('.proto-map-viewport').boundingBox();const from={x:box.x+box.width/2,y:box.y+box.height*0.6};
    const to={x:Math.min(view.x+view.width-40,from.x+view.width*0.22),y:Math.min(view.y+view.height-40,from.y+view.height*0.12)};
    await p.mouse.move(to.x,to.y);const aimed=await p.locator('.table-grid-reference').getAttribute('data-grid-reference');
    await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:12});await p.mouse.up();
    await p.waitForFunction(ref=>document.querySelector('[data-board-piece="actor"]')?.dataset.gridReference===ref,aimed,{timeout:8000}).catch(()=>problems.push(`${w}x${h}: Hero did not arrive at ${aimed}`));
    await p.waitForTimeout(700);
    // The base sits under the standee's feet.
    const base=await p.locator('.proto-standee-base').first().boundingBox(),hero=await actor.boundingBox();
    assert.ok(Math.abs(base.x+base.width/2-(hero.x+hero.width/2))<hero.width*0.15&&Math.abs(base.y+base.height/2-(hero.y+hero.height))<12,`${w}x${h} standee stands on its base`);
    // Tapping the visible tile still selects it through the tilt.
    const tile=p.locator('[data-biome-id="woods-alpha"]');const t=await tile.boundingBox();await p.mouse.click(t.x+t.width/2,t.y+4);
    if(w>=900)await p.locator('.proto-tableau-field:not(.hidden)').first().waitFor({timeout:3000}).catch(()=>problems.push(`${w}x${h}: tapping the tilted tile did not open its tableau`));
    if(process.env.SHOTS){await p.screenshot({path:`${process.env.SHOTS}/tilt-${w}x${h}.png`});}
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.getByRole('button',{name:'Flat camera view'}).click();await p.waitForTimeout(200);
    assert.equal(await stage.evaluate(el=>getComputedStyle(el).transform),'none',`${w}x${h} Flat restores the 2D table`);
    assert.equal(await p.locator('.proto-standee-base').count(),0);
    await p.close();
  }
  assert.deepEqual(problems,[],'tilt defects:\n'+problems.join('\n'));
  console.log('Tilted camera: plane tilts, Hero stands on its base, drops land on the aimed cell, tiles stay tappable, toolbar fits, Flat restores the 2D view.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
