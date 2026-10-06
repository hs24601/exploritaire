// Flat camera: the Hero sprite shows as its cardboard pop-up seen from above:
// face foreshortened, a corrugated edge with liners along its upper outline,
// a round base, contained near its cell, and the token if the art is missing.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.goto('http://localhost:5179/proto.html');if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    const actor=p.locator('[data-board-piece="actor"].proto-sprite-topdown');await actor.waitFor({timeout:5000});
    const face=actor.locator('.proto-sprite-topdown__face');await face.waitFor();
    assert.match(await face.evaluate(el=>getComputedStyle(el).backgroundImage),/hero\.png/,`${w}x${h} the face shows the Hero art`);
    const scale=await face.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).d);
    assert.ok(scale>0.4&&scale<0.8,`${w}x${h} the face is foreshortened from above (${scale})`);
    assert.equal(await actor.locator('.proto-sprite-topdown__edge').count(),5,`${w}x${h} thick board edge`);
    assert.equal(await actor.locator('.proto-sprite-topdown__edge--liner').count(),2,`${w}x${h} liners on both faces of the board`);
    assert.equal(await actor.locator('.board-object-label').count(),0,`${w}x${h} no token label`);
    // The piece stays around its own cell: within one cell of the cell center.
    const cell=(await p.locator('.table-grid-origin').boundingBox()).width;
    const piece=await actor.boundingBox();const ref=await actor.getAttribute('data-grid-reference');
    const [col,row]=ref.split(':')[1].split(',').map(Number);const origin=await p.locator('.table-grid-origin').boundingBox();
    const cx=origin.x+cell/2+col*cell,cy=origin.y+cell/2+row*cell;
    assert.ok(Math.abs(piece.x+piece.width/2-cx)<2&&piece.y+piece.height>cy&&piece.y+piece.height<cy+cell*0.6,`${w}x${h} the piece stands in its cell`);
    await p.close();
  }
  const p=await b.newPage({viewport:{width:1280,height:720}});await p.route('**/assets/actors/hero.png',r=>r.fulfill({status:404}));
  await p.goto('http://localhost:5179/proto.html');await p.waitForTimeout(800);
  assert.equal(await p.locator('.proto-sprite-topdown').count(),0,'missing art falls back to the token');
  assert.equal(await p.locator('[data-board-piece="actor"] .board-object-label').count(),1,'the token shows the label');
  console.log('Top-down Hero: foreshortened face, corrugated edge with two liners, stands in its cell at desktop and phone sizes, token fallback.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
