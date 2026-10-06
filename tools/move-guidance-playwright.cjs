// Guidance sits right of Divine Intervention, starts off, and only when checked
// highlights the playable tableau cards; the solver controls fit at every size.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const SHOTS=process.env.SHOTS;
(async()=>{const b=await chromium.launch({headless:true});try{
  for(const [w,h] of [[1912,914],[1280,720],[844,390],[390,844]]){
    const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(400);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('[data-biome-id="woods-alpha"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
    await p.locator('.proto-actor-energy').waitFor({state:'attached',timeout:15000});if(w<900)await p.getByRole('button',{name:'Tableau',exact:true}).click();
    const guidance=p.getByLabel('Guidance',{exact:true});await guidance.waitFor({timeout:10000});
    const divine=p.getByLabel('Divine Intervention');
    assert.equal(await guidance.isChecked(),false,`${w}x${h} Guidance starts off`);
    // What the player sees: the gold outline, plus the teal class it pairs with.
    const highlighted=()=>p.locator('.proto-tableau-stage button.playing-card').evaluateAll(list=>list.filter(el=>{const c=getComputedStyle(el);return c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0||el.className.includes('border-[#8ef2d4]/70');}).length);
    await p.waitForTimeout(700);
    assert.equal(await highlighted(),0,`${w}x${h} no tableau card is highlighted with Guidance off`);
    await guidance.check();await p.waitForTimeout(200);
    const lit=await highlighted();assert.ok(lit>0,`${w}x${h} Guidance highlights the playable cards`);
    const [g,d]=[await guidance.locator('xpath=..').boundingBox(),await divine.locator('xpath=..').boundingBox()];
    assert.ok(g.x>=d.x+d.width-1&&Math.abs(g.y-d.y)<4||g.y>=d.y+d.height-1,`${w}x${h} Guidance follows Divine Intervention`);
    if(g.y<d.y+d.height-1)assert.ok(g.x>d.x,`${w}x${h} Guidance is right of Divine Intervention`);
    const defects=await findLayoutDefects(p,'.proto-solve-controls',{parts:'button, label, [role="status"]',minFontSize:16});
    assert.deepEqual(defects,[],`${w}x${h} solver controls layout`);
    if(SHOTS)await p.locator('.proto-solve-controls').screenshot({path:`${SHOTS}/guidance-${w}x${h}.png`});
    console.log(`${w}x${h}: ${lit} card(s) highlighted with Guidance on, none off; ${g.y<d.y+d.height-1?'same row':'wrapped below'}`);
    await guidance.uncheck();assert.equal(await highlighted(),0,`${w}x${h} unchecking clears the highlights`);
    await p.context().close();
  }
  console.log('Move guidance: off by default, highlights playable cards only when on, controls fit at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
