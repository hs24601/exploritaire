// Battle camera on the tableau: with the camera tilted, the tableau leans back
// from its front row, back rows shrink and blur (depth of field), the front
// row stays sharp and playable, everything stays inside the tableau panel, and
// Flat restores the 2D tableau.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(400);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.getByRole('button',{name:'Tilt camera view'}).click();
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height*0.8);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
    await p.locator('.proto-actor-energy').waitFor({state:'attached',timeout:15000});if(w<900)await p.getByRole('button',{name:'Tableau',exact:true}).click();await p.waitForTimeout(600);
    const stage=p.locator('.proto-tableau-stage');assert.match(await stage.evaluate(el=>getComputedStyle(el).transform),/matrix3d/,`${w}x${h} tableau leans back`);
    // Front row (each column's top card) vs. the back row.
    const cols=await p.locator('.proto-tableau-stage > * > div').evaluateAll(cols=>cols.map(col=>{const cards=[...col.querySelectorAll(':scope > button, :scope > [role="button"], :scope > div[style*="absolute"]')].filter(el=>el.style.transform.includes('translateY'));return cards.map(el=>{const r=el.getBoundingClientRect();return {w:r.width,filter:el.style.filter||''}})}));
    const full=cols.find(c=>c.length>=2);assert.ok(full,`${w}x${h} found a stacked column`);
    const front=full[full.length-1],back=full[0];
    assert.ok(back.w<front.w-0.5,`${w}x${h} back row looks farther away (${back.w.toFixed(1)} vs ${front.w.toFixed(1)}px)`);
    assert.match(back.filter,/blur\(/,`${w}x${h} back row is softened`);assert.equal(front.filter,'',`${w}x${h} front row stays sharp`);
    (await findLayoutDefects(p,'.proto-main-tableau',{minFontSize:0,parts:'.proto-tableau-stage, .proto-tableau-actions'})).forEach(d=>problems.push(`${w}x${h}: ${d}`));
    // The playable front card still takes a tap through the tilt.
    const energyBefore=await p.locator('.proto-actor-energy').getAttribute('aria-label');
    const playable=p.locator('.proto-tableau-stage button:not([disabled])').first();
    if(await playable.count()){await playable.click();await p.waitForFunction(b=>document.querySelector('.proto-actor-energy')?.getAttribute('aria-label')!==b,energyBefore,{timeout:5000}).catch(()=>problems.push(`${w}x${h}: tapping the tilted front card did not play it`));}
    if(process.env.SHOTS)await p.locator('.proto-tableau-field').screenshot({path:`${process.env.SHOTS}/tableau-tilt-${w}x${h}.png`});
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.getByRole('button',{name:'Flat camera view'}).click();await p.waitForTimeout(450);
    assert.equal(await stage.evaluate(el=>getComputedStyle(el).transform),'none',`${w}x${h} Flat restores the 2D tableau`);
    assert.equal(await p.locator('.proto-tableau-stage [style*="blur"]').count(),0,`${w}x${h} Flat removes depth of field`);
    await p.close();
  }
  assert.deepEqual(problems,[],'tableau tilt defects:\n'+problems.join('\n'));
  console.log('Tableau battle camera: leans back, back rows smaller and softened, front row sharp and playable, contained, Flat restores 2D.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
