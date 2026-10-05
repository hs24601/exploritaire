// Hero details card: the Hero sprite loads as the portrait, drawn pixel-sharp
// and contained by the art frame at desktop and phone sizes.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(500);
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.locator('[data-board-piece="actor"]').click();const viewer=p.locator('.details-card-viewer');await viewer.waitFor();
    const img=p.locator('.details-card__art img.details-card__sprite');await img.waitFor();
    await p.waitForFunction(()=>{const i=document.querySelector('.details-card__sprite');return i&&i.complete;});
    const info=await img.evaluate(i=>({src:i.getAttribute('src'),alt:i.alt,natural:i.naturalWidth,rendering:getComputedStyle(i).imageRendering}));
    assert.match(info.src,/assets\/actors\/hero\.png$/);assert.equal(info.alt,'Hero portrait');assert.ok(info.natural>0,`${w}x${h} sprite loaded`);assert.equal(info.rendering,'pixelated');
    const art=await p.locator('.details-card__art').boundingBox(),box=await img.boundingBox();
    assert.ok(box.x>=art.x-.5&&box.y>=art.y-.5&&box.x+box.width<=art.x+art.width+.5&&box.y+box.height<=art.y+art.height+.5,`${w}x${h} sprite stays inside the art frame`);
    // Overflow clips at the padding edge: a clamped descriptor must have no room below its last line for the next one to peek into.
    const desc=await p.locator('.details-card__descriptor').evaluate(el=>({inner:el.clientHeight,lines:parseFloat(getComputedStyle(el).lineHeight)*parseInt(getComputedStyle(el).webkitLineClamp||'0',10)}));
    if(desc.lines>0)assert.ok(desc.inner<=desc.lines+0.5,`${w}x${h} descriptor leaves ${(desc.inner-desc.lines).toFixed(1)}px for a clipped line to peek`);
    (await findLayoutDefects(p,'.details-card-viewer',{parts:'.details-card__header, .details-card__art, .details-card__descriptor, .details-card__trays, .details-card__close'})).forEach(d=>problems.push(`${w}x${h}: ${d}`));
    if(process.env.SHOTS)await viewer.screenshot({path:`${process.env.SHOTS}/hero-card-${w}x${h}.png`});
    await p.close();
  }
  assert.deepEqual(problems,[],'layout defects:\n'+problems.join('\n'));
  console.log('Hero details card: sprite portrait loads, stays pixel-sharp and fits the art frame at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
