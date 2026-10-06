const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Small Woods shows pixel-art pines as a cardboard pop-up: standing at the back
// of the tile when tilted, a thin board edge seen from above when flat. Neither
// covers the tile's label, and tapping the trees opens the woods like the tile.
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720],[390,844],[844,390]])for(const tilt of [false,true]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    if(tilt){await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(900);}
    const pop=p.locator('[data-biome-popup="woods-alpha"]');await pop.waitFor();
    const art=pop.locator(tilt?'.proto-sprite-standee__art':'.proto-sprite-topdown__board');await art.waitFor({timeout:5000});
    const a=await art.boundingBox();const tile=await p.locator('button[data-biome-id="woods-alpha"]').boundingBox();
    const text=await p.locator('button[data-biome-id="woods-alpha"] > *').first().evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
    const tag=`${w}x${h} ${tilt?'tilt':'flat'}`;
    if(tilt){if(a.height<tile.height*0.8)problems.push(`${tag}: pines too small (${a.height}px)`);if(a.y+a.height<tile.y||a.y+a.height>tile.y+tile.height*0.5)problems.push(`${tag}: pines don't stand on the back of the tile`);}
    else{if(a.height>tile.height*0.09)problems.push(`${tag}: board edge ${a.height}px thick`);if(a.x<tile.x-1||a.x+a.width>tile.x+tile.width+1)problems.push(`${tag}: board edge leaves the tile`);}
    if(overlap(a,text)>0)problems.push(`${tag}: pop-up covers the Small Woods label (art bottom ${(a.y+a.height).toFixed(1)}, text top ${text.y.toFixed(1)})`);
    if(w>=900){await p.mouse.click(a.x+a.width/2,a.y+a.height*(tilt?0.4:0.5));await p.locator('.proto-tableau-field:not(.hidden)').first().waitFor({timeout:3000}).catch(()=>problems.push(`${tag}: tapping the pines did not open Small Woods`));}
    await p.close();
  }
  assert.deepEqual(problems,[],'biome pop-up defects:\n'+problems.join('\n'));
  console.log('Small Woods pines: stand at the back of the tile tilted, a thin board edge flat, label clear, tapping opens the woods, at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
