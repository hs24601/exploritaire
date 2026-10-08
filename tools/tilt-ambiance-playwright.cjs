const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Tilted ("immersion") camera ambiance: lamp halos, sun or moon rays, fireflies
// at dusk and night, pond fizz and dust motes by day, and HD-2D light washes
// across lit pixel art. None of it shows in the flat camera, none of it takes
// pointer input, the low tier (?fx=low) drops the particles and prop shadows,
// edge-prop shadows and dawn mist never fall across a tile's label, and world
// particles and light shafts move with the table when it pans.
const setHour=(p,h)=>p.locator('input[type=range]').first().evaluate((el,v)=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,String(v));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},h);
// Pixels in `before` at least 40 levels darker than in `after`: a shadow, not light flicker.
const darkened=(p,before,after)=>p.evaluate(async([a,b])=>{const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+src;});
  const [ia,ib]=await Promise.all([load(a),load(b)]);const c=document.createElement('canvas');c.width=ia.width;c.height=ia.height;const x=c.getContext('2d');
  x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;x.clearRect(0,0,c.width,c.height);x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;
  let n=0;for(let k=0;k<da.length;k+=4){const la=da[k]+da[k+1]+da[k+2],lb=db[k]+db[k+1]+db[k+2];if(lb-la>120)n++;}return n;},[before.toString('base64'),after.toString('base64')]);
const counts=p=>p.evaluate(()=>{const c={};document.querySelectorAll('[data-atmosphere]').forEach(e=>{c[e.dataset.atmosphere]=(c[e.dataset.atmosphere]||0)+1;});c.edgeShadow=document.querySelectorAll('[data-shadow-owner="biome-edge"]').length;
  c.interactive=[...document.querySelectorAll('.proto-table-air *, .proto-shafts *, [data-board-piece="biome-edge"]')].filter(e=>getComputedStyle(e).pointerEvents!=='none').length;return c;});
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const fx of ['','low']){
    const tag=`${w}x${h}${fx?' fx='+fx:''}`;
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5178/proto.html'+(fx?'?fx='+fx:''));
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await setHour(p,22);await p.waitForTimeout(300);
    const flat=await counts(p);if(Object.keys(flat).some(k=>!['edgeShadow','interactive'].includes(k)&&flat[k]))problems.push(`${tag}: ambiance in the flat camera ${JSON.stringify(flat)}`);
    await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1200);
    const night=await counts(p);
    if(!(night.halo>=1))problems.push(`${tag}: no light halo at night`);
    if(!(night.firefly>0))problems.push(`${tag}: no fireflies at night`);
    if(!(night.ray>0))problems.push(`${tag}: no moonbeams at night`);
    if(night.interactive)problems.push(`${tag}: ${night.interactive} ambiance elements take pointer input`);
    if(fx==='low'){if(night.fizz||night.mote||night.edgeShadow)problems.push(`${tag}: low tier still draws particles or prop shadows ${JSON.stringify(night)}`);const tiles=await p.locator('button[data-biome-id]:not(.cursor-not-allowed)').count();if(night.firefly>3*tiles)problems.push(`${tag}: low tier draws ${night.firefly} fireflies over ${tiles} biomes`);}
    else if(!(night.fizz>0&&night.edgeShadow>0))problems.push(`${tag}: high tier missing pond fizz or prop shadows ${JSON.stringify(night)}`);
    await setHour(p,9);await p.waitForTimeout(400);
    const day=await counts(p);
    if(day.firefly)problems.push(`${tag}: fireflies by day`);
    if(!(day.ray>0))problems.push(`${tag}: no sun rays by day`);
    if(!fx&&!(day.mote>0))problems.push(`${tag}: no dust motes by day`);
    // Taps pass through the air above a tile.
    const tile=await p.locator('button[data-biome-id="woods-alpha"]').boundingBox();
    const hit=await p.evaluate(([x,y])=>{const el=document.elementFromPoint(x,y);if(!el)return 'nothing';if(el.closest('.proto-table-air,.proto-shafts'))return 'ambiance';if(el.closest('.proto-map-toolbar'))return 'toolbar';return el.closest('[data-biome-id]')?.getAttribute('data-biome-id')??el.closest('[data-biome-popup]')?.getAttribute('data-biome-popup')??el.className;},[tile.x+tile.width/2,tile.y+tile.height*0.7]);
    // Pieces or the toolbar may sit over the tile on small screens; the ambiance never does.
    if(hit==='ambiance')problems.push(`${tag}: the ambiance layer catches a tap on Small Woods`);
    // Dawn mist hangs behind the tiles, never over a label.
    await setHour(p,6.5);await p.waitForTimeout(400);
    if(!((await counts(p)).mist>0))problems.push(`${tag}: no mist at dawn`);
    for(let sample=0;sample<6;sample++){
      const hits=await p.evaluate(()=>{const labels=[...document.querySelectorAll('[data-biome-id] .board-object-label__text')].map(e=>e.getBoundingClientRect());const out=[];
        document.querySelectorAll('.proto-mist').forEach(m=>{const r=m.getBoundingClientRect();if(!r.width)return;const ix=r.width*0.15,iy=r.height*0.15;const a={l:r.left+ix,r:r.right-ix,t:r.top+iy,b:r.bottom-iy};
          if(labels.some(l=>a.l<l.right&&a.r>l.left&&a.t<l.bottom&&a.b>l.top))out.push(Math.round(r.left)+','+Math.round(r.top));});return out;});
      if(hits.length){problems.push(`${tag}: mist over a tile label at ${hits.join(' ')}`);break;}
      await p.waitForTimeout(500);
    }
    // World particles and light shafts are pinned to the table: a pan slides
    // them exactly as far as the lamp halos, which follow the pieces.
    await setHour(p,9);await p.waitForTimeout(300);
    // Table-plane x of each billboard's foot (table px through the live camera)
    // and screen x of each shaft's middle; both slide by the camera's pan.
    const lefts=()=>p.evaluate(()=>{const cam=getComputedStyle(document.querySelector('.proto-map-viewport'));const cx=parseFloat(cam.getPropertyValue('--camera-x')),cs=parseFloat(cam.getPropertyValue('--camera-scale'));
      const px=e=>cx+parseFloat(e.style.left)*cs;return {halo:[...document.querySelectorAll('[data-atmosphere="halo"]')].map(px),mote:[...document.querySelectorAll('[data-atmosphere="mote"]')].map(px),ray:[...document.querySelectorAll('[data-atmosphere="ray"]')].map(e=>e.getBoundingClientRect().left+e.getBoundingClientRect().width/2)};});
    const was=await lefts();
    const area=await p.locator('.proto-map-viewport').boundingBox();
    // Mid-pan, on every frame, the lantern's halo keeps the lantern's pace (the
    // ambiance used to catch up only at React's 50-80 ms camera syncs).
    const halfway=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>{const halo=document.querySelector('[data-atmosphere="halo"]')?.getBoundingClientRect();const lamp=document.querySelector('[data-board-piece="lamp"]')?.getBoundingClientRect();r(halo&&lamp?halo.left-(lamp.left+lamp.width/2):null);})));
    const sx=area.x+area.width*0.82,sy=area.y+area.height*0.88;const gap=await halfway();await p.mouse.move(sx,sy);await p.mouse.down();
    let worstLag=0;for(let step=1;step<=8;step++){await p.mouse.move(sx-15*step,sy);const g=await halfway();if(gap!=null&&g!=null)worstLag=Math.max(worstLag,Math.abs(g-gap));}
    await p.mouse.up();await p.waitForTimeout(300);
    if(worstLag>1.5)problems.push(`${tag}: the lantern halo trails the lantern by up to ${worstLag.toFixed(1)}px mid-pan`);
    const now=await lefts();const shift=now.halo[0]-was.halo[0];
    if(!(Math.abs(shift)>40))problems.push(`${tag}: the pan did not move the table (${shift})`);
    else for(const kind of fx?['ray']:['mote','ray']){const before=kind==='ray'?was.ray.filter(x=>x+shift>area.x&&x+shift<area.x+area.width):was[kind];if(!before.length){if(!fx)problems.push(`${tag}: no ${kind}s in view to follow`);continue;}
      const followed=before.filter(x=>now[kind].some(y=>Math.abs(y-x-shift)<2)).length;
      if(followed<before.length*0.8)problems.push(`${tag}: only ${followed}/${before.length} ${kind}s moved with the pan`);}
    // Dusk: long shadows, none across a label.
    await setHour(p,17.5);await p.waitForTimeout(400);
    for(const id of ['pond','woods-alpha']){
      const label=p.locator(`button[data-biome-id="${id}"] .board-object-label__text`);
      const box=await label.boundingBox();if(!box||box.y<0||box.y+box.height>h)continue;
      const hideAir=await p.addStyleTag({content:'.proto-table-air,.proto-shafts{visibility:hidden!important}'});await p.waitForTimeout(100);
      const before=await p.screenshot({clip:box});
      const hide=await p.addStyleTag({content:'.proto-sprite-shadow{visibility:hidden!important}'});await p.waitForTimeout(150);
      const after=await p.screenshot({clip:box});
      await hide.evaluate(el=>el.remove());await hideAir.evaluate(el=>el.remove());
      const n=await darkened(p,before,after);
      if(n>4)problems.push(`${tag}: a shadow falls across the ${id} label (${n} darkened pixels)`);
    }
    await p.close();
  }
  assert.deepEqual(problems,[],'ambiance defects:\n'+problems.join('\n'));
  console.log('Tilt ambiance: halos, moonbeams and fireflies at night, sun rays and motes by day, pond fizz and prop shadows on the high tier only, nothing in flat, nothing takes input, tiles stay tappable, no shadow or mist across a label, motes and shafts pan with the table; at desktop sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
