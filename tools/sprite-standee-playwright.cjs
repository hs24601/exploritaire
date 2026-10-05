// Tilted camera, Hero sprite standee: the cut-out stands on its base with its
// padding trimmed, casts a silhouette shadow per light (never from its own
// candle), takes the night's light, and falls back to the token if the art
// can't load. The sprite is served from a fixture so the check doesn't depend
// on which art is committed.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');const {findLayoutDefects}=require('./lib/layout-check.cjs');
const FIXTURE=path.join(__dirname,'..','public','assets','actors','mochikin','pop_front_mochikin.png');
const setHours=(p,h)=>p.evaluate(h=>{const i=document.querySelector('[aria-label="Table time of day"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,String(h));i.dispatchEvent(new Event('input',{bubbles:true}));},h);
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.route('**/assets/actors/hero.png',r=>r.fulfill({path:FIXTURE,contentType:'image/png'}));
    await p.goto('http://localhost:5179/proto.html');if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.getByRole('button',{name:'Tilt camera view'}).click();
    const actor=p.locator('[data-board-piece="actor"].proto-sprite-standee');await actor.waitFor({timeout:5000});
    const art=actor.locator('.proto-sprite-standee__art');await art.waitFor();
    assert.match(await art.evaluate(el=>getComputedStyle(el).backgroundImage),/hero\.png/,`${w}x${h} the cut-out shows the Hero sprite`);
    assert.equal(await art.evaluate(el=>getComputedStyle(el).imageRendering),'pixelated');
    assert.equal(await actor.locator('.board-object-label').count(),0,`${w}x${h} the cut-out replaces the token label`);
    // Feet on the base: the standee's bottom edge meets the base's center.
    const base=await p.locator('.proto-standee-base').first().boundingBox(),hero=await actor.boundingBox();
    assert.ok(Math.abs(base.x+base.width/2-(hero.x+hero.width/2))<hero.width*0.15&&Math.abs(base.y+base.height/2-(hero.y+hero.height))<12,`${w}x${h} the cut-out stands on its base`);
    // Day: one shadow from the sun, falling away from it.
    await setHours(p,9);await p.waitForTimeout(200);
    assert.deepEqual(await p.locator('.proto-sprite-shadow').evaluateAll(list=>list.map(el=>el.dataset.shadowLight)),['sky'],`${w}x${h} daytime shadow comes from the sun`);
    const dayBrightness=await art.evaluate(el=>parseFloat(/brightness\(([\d.]+)\)/.exec(el.style.filter)[1]));
    // Night: the carried candle lights the Hero but casts no shadow from its own base.
    await setHours(p,23);await p.waitForTimeout(200);
    const night=await p.locator('.proto-sprite-shadow').evaluateAll(list=>list.map(el=>el.dataset.shadowLight));
    assert.ok(!night.some(id=>id.startsWith('actor-light')),`${w}x${h} no shadow from the Hero's own candle`);
    const nightBrightness=await art.evaluate(el=>parseFloat(/brightness\(([\d.]+)\)/.exec(el.style.filter)[1]));
    assert.ok(nightBrightness<dayBrightness,`${w}x${h} the Hero is darker at night (${nightBrightness} vs ${dayBrightness})`);
    (await findLayoutDefects(p,'.proto-map-toolbar',{parts:'.proto-map-toolbar button'})).forEach(d=>problems.push(`${w}x${h} toolbar: ${d}`));
    if(process.env.SHOTS){await setHours(p,17.5);await p.waitForTimeout(200);const a=await actor.boundingBox();await p.screenshot({path:`${process.env.SHOTS}/hero-standee-${w}x${h}.png`,clip:{x:Math.max(0,a.x-a.width),y:Math.max(0,a.y-a.height*0.6),width:Math.min(w,a.width*3),height:Math.min(h,a.height*2.6)}});}
    await p.close();
  }
  // Missing art falls back to the cardboard token instead of a broken image.
  const p=await b.newPage({viewport:{width:1280,height:720}});await p.route('**/assets/actors/hero.png',r=>r.fulfill({status:404,body:''}));
  await p.goto('http://localhost:5179/proto.html');await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(800);
  assert.equal(await p.locator('.proto-sprite-standee').count(),0,'missing sprite falls back to the token');
  assert.equal(await p.locator('[data-board-piece="actor"] .board-object-label').count(),1);
  assert.deepEqual(problems,[],'sprite standee defects:\n'+problems.join('\n'));
  console.log('Hero sprite standee: trimmed cut-out on its base, sun and lamp shadows (none from its own candle), darker at night, token fallback, toolbar fits.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
