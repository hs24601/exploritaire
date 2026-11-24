const {chromium}=require('playwright');const assert=require('node:assert/strict');
// A grab on an occupied grid square takes the piece, not the camera: pressing
// near the corner of the Hero's square (off the art) and dragging moves the
// Hero and leaves the table where it was, even where scenery in front of the
// square covers it in the tilted view. A grab on an empty square still pans.
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[390,844]])for(const view of ['flat','tilt']){
    const tag=`${w}x${h} ${view}`;
    const p=await b.newPage({viewport:{width:w,height:h},hasTouch:w<900});await p.goto('http://localhost:5178/proto.html');
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    if(view==='tilt'){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    const hero=p.locator('[data-board-piece="actor"]').first();
    const startCell=await hero.getAttribute('data-grid-reference');
    const grip=await p.locator('[data-cell-grip]').first().boundingBox();
    // Near the square's front-left corner, clear of the sprite. Tilted, the
    // pond's reeds stand in front of this spot: the square still decides.
    const at={x:grip.x+grip.width*0.18,y:grip.y+grip.height*0.82};
    const tile=()=>p.evaluate(()=>{const r=document.querySelector('button[data-biome-id="woods-alpha"]').getBoundingClientRect();return {x:r.x,y:r.y};});
    const tileBefore=await tile();
    // Phones drag with a finger, desktop with the mouse.
    const cdp=w<900?await p.context().newCDPSession(p):null;
    const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
    if(cdp)await touch('touchStart',at.x,at.y);else{await p.mouse.move(at.x,at.y);await p.mouse.down();}
    for(let i=1;i<=10;i++){if(cdp)await touch('touchMove',at.x+i*9,at.y+i*4);else await p.mouse.move(at.x+i*9,at.y+i*4);await p.waitForTimeout(16);}
    const dragging=await p.locator('[data-board-piece="actor"].opacity-45, .proto-sprite-standee.opacity-45, .proto-sprite-topdown.opacity-45').count();
    const tileMid=await tile();
    if(cdp)await touch('touchEnd',0,0);else await p.mouse.up();await p.waitForTimeout(1600);
    if(Math.abs(tileMid.x-tileBefore.x)>1||Math.abs(tileMid.y-tileBefore.y)>1)problems.push(`${tag}: grabbing the Hero's square panned the camera`);
    if(!dragging)problems.push(`${tag}: grabbing the Hero's square did not pick up the Hero`);
    const endCell=await hero.getAttribute('data-grid-reference');
    if(endCell===startCell)problems.push(`${tag}: the Hero did not move (still ${endCell})`);
    // An empty square still pans.
    const area=await p.evaluate(()=>{const r=document.querySelector('.proto-map-viewport').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
    const ex=area.x+area.width*0.85,ey=area.y+area.height*0.9;
    if(cdp){await touch('touchStart',ex,ey);for(let i=1;i<=6;i++){await touch('touchMove',ex-i*13,ey-i*2);await p.waitForTimeout(16);}await touch('touchEnd',0,0);}
    else{await p.mouse.move(ex,ey);await p.mouse.down();await p.mouse.move(ex-80,ey-10,{steps:6});await p.mouse.up();}
    await p.waitForTimeout(200);
    const tileAfter=await tile();if(Math.abs(tileAfter.x-tileMid.x)<20)problems.push(`${tag}: dragging an empty square no longer pans`);
    await p.close();
  }
  assert.deepEqual(problems,[],'cell grab defects:\n'+problems.join('\n'));
  console.log('Grabbing an occupied square drags the Hero, not the camera; empty squares still pan; flat and tilted, mouse on desktop and touch on a phone.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
