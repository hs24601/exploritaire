const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Manual tableau-to-foundation plays fly at the auto-solve speed, and the next
// eligible card can be clicked while the previous one is still in the air: both
// plays land, in order, and the second click is never swallowed.
const inFlight=p=>p.evaluate(()=>!!document.querySelector('[style*="z-index: 30000"]'));
const energy=p=>p.locator('.proto-actor-energy').first().getAttribute('aria-label').then(t=>+t.match(/energy (\d+)/)[1]);
const highlighted=p=>p.locator('.proto-tableau-stage button.playing-card[data-highlight="true"]:not(:disabled)');
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1280,720],[390,844]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(400);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const a=await p.locator('[data-board-piece="actor"]').boundingBox(),t=await p.locator('button[data-biome-id="woods-alpha"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await p.mouse.up();
    await p.locator('.proto-actor-energy').waitFor({state:'attached',timeout:15000});if(w<900)await p.getByRole('button',{name:'Tableau',exact:true}).click();
    await p.getByLabel('Guidance',{exact:true}).check();await p.waitForTimeout(800);
    const start=await energy(p);
    // One play on its own: how long the flight takes.
    await highlighted(p).first().click();const t0=Date.now();
    await p.waitForFunction(e=>+document.querySelector('.proto-actor-energy').getAttribute('aria-label').match(/energy (\d+)/)[1]<e,start,{timeout:5000});
    const single=Date.now()-t0;if(single>600)problems.push(`${w}x${h}: a manual play took ${single}ms to land (auto-solve pace is a few hundred ms)`);
    // Two plays back to back: the second click comes while the first card flies.
    const before=await energy(p);
    await highlighted(p).first().click();await p.waitForTimeout(30);
    if(!await inFlight(p))problems.push(`${w}x${h}: the first card was not in flight at the second click`);
    const flying=await p.locator('[data-highlight="true"]').count();
    if(!flying){problems.push(`${w}x${h}: no next card offered while the first was in flight`);await p.close();continue;}
    // Click straight away at the card's spot, as a player would, without waiting for the flight.
    const next=await highlighted(p).first().boundingBox();await p.mouse.click(next.x+next.width/2,next.y+next.height/2);
    await p.waitForFunction(e=>+document.querySelector('.proto-actor-energy').getAttribute('aria-label').match(/energy (\d+)/)[1]<=e-2,before,{timeout:5000}).catch(()=>{});
    const spent=before-await energy(p);if(spent!==2)problems.push(`${w}x${h}: back-to-back clicks played ${spent} card(s), expected 2`);
    console.log(`${w}x${h}: single play landed in ${single}ms; back-to-back clicks played ${spent}`);
    await p.close();
  }
  assert.deepEqual(problems,[],'card flight defects:\n'+problems.join('\n'));
  console.log('Card flights: manual plays fly at auto-solve speed, and the next card can be played mid-flight.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
