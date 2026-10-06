// Flat camera: the Hero pop-up seen from straight above is just its thick
// corrugated board edge across a round base, centered on its cell and still
// casting its shadow; the token returns if the art is missing.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.goto('http://localhost:5179/proto.html');if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const actor=p.locator('[data-board-piece="actor"].proto-sprite-topdown');await actor.waitFor({timeout:5000});
    const board=actor.locator('.proto-sprite-topdown__board');await board.waitFor();
    const edge=await board.boundingBox(),disc=await actor.locator('.proto-sprite-topdown__base').boundingBox();
    assert.ok(edge.width>edge.height*5,`${w}x${h} straight down, only the board's thin edge shows (${edge.width.toFixed(0)}x${edge.height.toFixed(0)})`);
    assert.match(await board.evaluate(el=>getComputedStyle(el).backgroundImage),/repeating-linear-gradient/,`${w}x${h} the edge shows corrugated fluting`);
    assert.ok(Math.abs(edge.x+edge.width/2-(disc.x+disc.width/2))<1&&Math.abs(edge.y+edge.height/2-(disc.y+disc.height/2))<1,`${w}x${h} the board stands across the middle of its base`);
    assert.ok(Math.abs(disc.width-disc.height)<1,`${w}x${h} the base is round from above`);
    assert.ok(await p.locator('.proto-sprite-shadow[data-shadow-owner="actor"]').count()>0,`${w}x${h} the pop-up still casts its shadow`);
    assert.equal(await actor.locator('.board-object-label').count(),0,`${w}x${h} no token label`);
    // The piece stays around its own cell: within one cell of the cell center.
    const cell=(await p.locator('.table-grid-origin').boundingBox()).width;
    const piece=await actor.boundingBox();const ref=await actor.getAttribute('data-grid-reference');
    const [col,row]=ref.split(':')[1].split(',').map(Number);const origin=await p.locator('.table-grid-origin').boundingBox();
    const cx=origin.x+cell/2+col*cell,cy=origin.y+cell/2+row*cell;
    assert.ok(Math.abs(piece.x+piece.width/2-cx)<2&&Math.abs(piece.y+piece.height/2-cy)<2,`${w}x${h} the piece is centered on its cell`);
    await p.close();
  }
  const p=await b.newPage({viewport:{width:1280,height:720}});await p.route('**/assets/actors/hero.png',r=>r.fulfill({status:404}));
  await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(800);
  assert.equal(await p.locator('.proto-sprite-topdown[data-board-piece="actor"]').count(),0,'missing art falls back to the token');
  assert.equal(await p.locator('[data-board-piece="actor"] .board-object-label').count(),1,'the token shows the label');
  console.log('Top-down Hero: straight-down view shows only the corrugated board edge on a round base, centered on its cell, shadow kept, token fallback, at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
