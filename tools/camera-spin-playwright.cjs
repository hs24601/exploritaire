const {chromium}=require('playwright');const assert=require('node:assert/strict');
// The table camera spins about the view centre (Q/E, the ↺ ↻ buttons, a
// right- or middle-button drag, a two-finger twist). At 0, 45, 90 and 180
// degrees, flat and tilted: the Hero stands upright facing the camera on its
// own square, tile labels read upright left to right with no edge scenery over
// them, a grab on the Hero's square picks it up, a drop lands on the cell
// aimed at, the hover readout names the cell under the pointer, and a drag or
// WASD pans the table the way the screen says. Double-click and Reset View
// turn it back to 0. Desktop sizes (touch twist included).
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const yawOf=p=>p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-yaw'))||0);
const centre=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
const rect=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},sel);
// Pixels whose brightness changes by more than 60 levels between two shots.
const changed=(p,a,b)=>p.evaluate(async([a,b])=>{const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
  const [ia,ib]=await Promise.all([load(a),load(b)]);const c=document.createElement('canvas');c.width=ia.width;c.height=ia.height;const x=c.getContext('2d');
  x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;x.clearRect(0,0,c.width,c.height);x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;
  let n=0;for(let k=0;k<da.length;k+=4)if(Math.abs(da[k]+da[k+1]+da[k+2]-db[k]-db[k+1]-db[k+2])>180)n++;return n;},[a.toString('base64'),b.toString('base64')]);
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const view of ['flat','tilt']){
    const p=await b.newPage({viewport:{width:w,height:h}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(URL);
    if(view==='tilt'){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);}
    let angle=0;
    for(const target of [0,45,90,180]){
      const tag=`${w}x${h} ${view} ${target}°`;
      // A tap on the Hero opens its card; close it so keys reach the table.
      await p.keyboard.press('Escape');await p.mouse.click(5,5);
      while(angle<target){await p.keyboard.press('e');angle+=45;await p.waitForTimeout(450);}
      await p.waitForTimeout(250);
      const yaw=await yawOf(p);if(Math.abs(yaw-target)>0.5){problems.push(`${tag}: the camera is at ${yaw}°, not ${target}°`);continue;}
      // The Hero stands on its own square, upright and facing the camera.
      const grip=await rect(p,'[data-cell-grip^="actor-"]');const hero=await rect(p,'[data-board-piece="actor"]');
      const square=centre(grip);
      if(view==='tilt'){
        const foot={x:hero.x+hero.width/2,y:hero.y+hero.height};
        if(hero.width<hero.height*0.6)problems.push(`${tag}: the Hero is turned edge-on (${Math.round(hero.width)}x${Math.round(hero.height)})`);
        if(Math.abs(foot.x-square.x)>grip.width*0.3||Math.abs(foot.y-square.y)>grip.height*0.45)problems.push(`${tag}: the Hero's foot is off its square`);
      }else{
        const board=await rect(p,'[data-board-piece="actor"] .proto-sprite-topdown__board');
        if(!board||board.width<board.height*3)problems.push(`${tag}: the Hero's board doesn't face the camera`);
      }
      // Labels read upright, left to right.
      const reading=await p.evaluate(()=>{const ink=document.querySelector('[data-biome-id="pond"] .board-object-label__text > span');const text=ink.firstChild;const at=i=>{const r=document.createRange();r.setStart(text,i);r.setEnd(text,i+1);const b=r.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,h:b.height};};
        const first=at(0),last=at(text.length-1);return {dx:last.x-first.x,dy:last.y-first.y,h:first.h};});
      if(!(reading.dx>reading.h&&Math.abs(reading.dy)<reading.h*0.3))problems.push(`${tag}: POND doesn't read left to right (${Math.round(reading.dx)},${Math.round(reading.dy)})`);
      // No edge scenery or pop-up covers a label (tilted).
      if(view==='tilt')for(const id of ['pond','woods-alpha']){
        const box=await rect(p,`[data-biome-id="${id}"] .board-object-label__text > span`);if(!box||box.y<0||box.y+box.height>h)continue;
        const clip={x:box.x+1,y:box.y+1,width:box.width-2,height:box.height-2};
        const calm=await p.addStyleTag({content:'.proto-table-air,.proto-shafts,.proto-sprite-shadow{visibility:hidden!important}*{animation-play-state:paused!important}'});await p.waitForTimeout(80);
        const shown=await p.screenshot({clip});const hide=await p.addStyleTag({content:'.proto-biome-edge,[data-board-piece="biome-popup"]{visibility:hidden!important}'});await p.waitForTimeout(80);
        const hidden=await p.screenshot({clip});await hide.evaluate(e=>e.remove());await calm.evaluate(e=>e.remove());
        const n=await changed(p,shown,hidden);if(n>6)problems.push(`${tag}: scenery covers the ${id} label (${n} px)`);
      }
      // Hover names the cell under the pointer: True Center's own square.
      const origin=centre(await rect(p,'.table-grid-origin'));
      await p.mouse.move(origin.x,origin.y);await p.waitForTimeout(60);
      const hover=await p.locator('.table-grid-reference').getAttribute('data-grid-reference');
      if(hover!=='table:0,0')problems.push(`${tag}: hovering True Center reads ${hover}`);
      // Grab the Hero by its square (off the art) and drop it on a free cell
      // beside it. The cell's screen spot comes from rendered
      // landmarks (True Center, the Hero's square, the pond), not the
      // pointer mapping under test.
      const startCell=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');
      const [hc,hr]=startCell.split(':')[1].split(',').map(Number);
      const pond=centre(await rect(p,'button[data-biome-id="pond"]'));
      const [pc,pr]=(await p.locator('button[data-biome-id="pond"]').getAttribute('data-grid-reference')).split(':')[1].split(',').map(Number);
      // Screen steps per column (ex) and per row (ey), solved from the three landmarks.
      const H={x:square.x-origin.x,y:square.y-origin.y},P={x:pond.x-origin.x,y:pond.y-origin.y},det=hc*pr-pc*hr;
      const ex={x:(pr*H.x-hr*P.x)/det,y:(pr*H.y-hr*P.y)/det},ey={x:(hc*P.x-pc*H.x)/det,y:(hc*P.y-pc*H.y)/det};
      const at=(c,r)=>({x:origin.x+c*ex.x+r*ey.x,y:origin.y+c*ex.y+r*ey.y});
      const free=await p.evaluate(spots=>spots.findIndex(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.closest('.proto-map-viewport')&&!e.closest('[data-biome-id],[data-biome-popup],[data-board-piece],[data-cell-grip]');}),
        [[hc+1,hr],[hc-1,hr],[hc+1,hr+1],[hc-1,hr+1]].map(([c,r])=>{const s=at(c,r);return [s.x,s.y];}));
      const goal=[[hc+1,hr],[hc-1,hr],[hc+1,hr+1],[hc-1,hr+1]][free];
      const drag=async(from,to)=>{await p.mouse.move(from.x,from.y);await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(from.x+(to.x-from.x)*i/12,from.y+(to.y-from.y)*i/12);await p.waitForTimeout(12);}await p.mouse.up();await p.waitForTimeout(1400);};
      const press={x:square.x+grip.width*0.2,y:square.y+grip.height*0.2};
      if(!goal)problems.push(`${tag}: no free cell beside the Hero to drop on`);
      else{
        const before=await rect(p,'.table-grid-origin');
        await drag(press,at(...goal));
        const moved=await p.locator('[data-board-piece="actor"]').getAttribute('data-grid-reference');
        const after=await rect(p,'.table-grid-origin');
        if(Math.abs(after.x-before.x)>1||Math.abs(after.y-before.y)>1)problems.push(`${tag}: grabbing the Hero's square panned the camera`);
        if(moved!==`table:${goal[0]},${goal[1]}`)problems.push(`${tag}: the Hero dropped on table:${goal[0]},${goal[1]} landed on ${moved}`);
      }
      // A drag on empty table moves the table with the pointer.
      const area=await rect(p,'.proto-map-viewport');const sx=area.x+area.width*0.85,sy=area.y+area.height*0.88;
      const o1=centre(await rect(p,'.table-grid-origin'));
      await p.mouse.move(sx,sy);await p.mouse.down();await p.mouse.move(sx-90,sy-30,{steps:8});await p.mouse.up();await p.waitForTimeout(150);
      const o2=centre(await rect(p,'.table-grid-origin'));const along=((o2.x-o1.x)*-90+(o2.y-o1.y)*-30)/(90*90+30*30),across=((o2.x-o1.x)*30+(o2.y-o1.y)*-90)/(90*90+30*30);
      if(along<0.6||along>1.6||Math.abs(across)>0.25)problems.push(`${tag}: the table didn't follow the pointer (along ${along.toFixed(2)}, across ${across.toFixed(2)})`);
      // Holding W glides the view toward the far side: the table slides down the screen.
      await p.keyboard.down('w');await p.waitForTimeout(300);await p.keyboard.up('w');await p.waitForTimeout(100);
      const o3=centre(await rect(p,'.table-grid-origin'));
      if(!(o3.y-o2.y>40&&Math.abs(o3.x-o2.x)<(o3.y-o2.y)*0.3))problems.push(`${tag}: W didn't glide the view forward (${Math.round(o3.x-o2.x)},${Math.round(o3.y-o2.y)})`);
      await p.getByRole('button',{name:'True Center'}).click();await p.waitForTimeout(150);
    }
    // A right-button drag spins the camera without opening a context menu.
    const area=await rect(p,'.proto-map-viewport');const rx=area.x+area.width*0.8,ry=area.y+area.height*0.85;
    const spun=await yawOf(p);
    await p.mouse.move(rx,ry);await p.mouse.down({button:'right'});await p.mouse.move(rx+100,ry,{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(200);
    const turned=await yawOf(p)-spun;if(Math.abs(turned-40)>4)problems.push(`${w}x${h} ${view}: a 100px right-drag turned the camera ${turned.toFixed(1)}°`);
    if(await p.locator('[role="menu"]').count())problems.push(`${w}x${h} ${view}: a right-drag spin opened a context menu`);
    // Double-clicking a turn button straightens the camera; so does Reset View.
    await p.getByRole('button',{name:'Turn table right'}).dblclick();await p.waitForTimeout(700);
    if(Math.abs((await yawOf(p))%360)>0.5)problems.push(`${w}x${h} ${view}: double-click left the camera at ${await yawOf(p)}°`);
    await p.keyboard.press('q');await p.waitForTimeout(450);await p.getByRole('button',{name:'Reset View'}).click();await p.waitForTimeout(700);
    if(Math.abs((await yawOf(p))%360)>0.5)problems.push(`${w}x${h} ${view}: Reset View left the camera at ${await yawOf(p)}°`);
    if(errors.length)problems.push(`${w}x${h} ${view}: page errors ${errors.join('; ')}`);
    await p.close();
  }
  // Touch: a two-finger twist spins the camera with the fingers.
  const p=await b.newPage({viewport:{width:1280,height:720},hasTouch:true});await p.goto(URL);
  const cdp=await p.context().newCDPSession(p);const area=await rect(p,'.proto-map-viewport');const c={x:area.x+area.width*0.8,y:area.y+area.height*0.3};
  const fingers=(type,deg)=>{const r=deg*Math.PI/180,d=70;return cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:c.x-d*Math.cos(r),y:c.y-d*Math.sin(r),id:1},{x:c.x+d*Math.cos(r),y:c.y+d*Math.sin(r),id:2}]});};
  await fingers('touchStart',0);for(let i=1;i<=8;i++){await fingers('touchMove',i*4);await p.waitForTimeout(16);}await fingers('touchEnd',0);await p.waitForTimeout(150);
  const twist=await yawOf(p);if(Math.abs(twist-32)>3)problems.push(`touch: a 32° twist turned the camera ${twist.toFixed(1)}°`);
  await p.close();
  assert.deepEqual(problems,[],'camera spin defects:\n'+problems.join('\n'));
  console.log('Camera spin: at 0/45/90/180°, flat and tilted, the Hero stands upright facing the camera on its square, labels read left to right with no scenery over them, grab-on-square and drops land on the aimed cell, hover maps right, drags and WASD pan with the screen; right-drag and touch twist spin, double-click and Reset View straighten; 1912x914 and 1280x720.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
