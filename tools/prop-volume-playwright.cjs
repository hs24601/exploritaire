const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
const directory=process.env.PROTO_ARTIFACT_DIR||'artifacts/prop-volume';fs.mkdirSync(directory,{recursive:true});
async function stats(page){return page.locator('[data-prop-volume]').evaluateAll(canvases=>canvases.map(canvas=>{
  const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,count=0,hash=0;
  for(let i=0;i<data.length/4;i++)if(data[i*4+3]){const x=i%canvas.width,y=Math.floor(i/canvas.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;hash=(hash*31+data[i*4]+data[i*4+1]+data[i*4+2])|0;}
  return {yaw:Number(canvas.dataset.volumeYaw),elevation:Number(canvas.dataset.volumeElevation),width:right-left+1,count,hash,clipped:left===0||right===canvas.width-1||top===0||bottom===canvas.height-1};
}));}
async function placement(page){return page.locator('[data-scenery-volume]').evaluateAll(els=>els.map(el=>{
  const d=el.dataset,parse=value=>{const m=value.match(/50%\s*([+-])\s*([-\d.]+)px/);return Number(m[2])*(m[1]==='-'?-1:1);};
  const x=parse(el.style.left),y=parse(el.style.top),scale=Number(el.style.getPropertyValue('--scenery-fit-scale')||1),w=Number(d.sceneryWidth)*scale;
  const assertInside=Math.abs(x-Number(d.ownerX))+w/2<=Number(d.ownerWidth)/2+.01&&Math.abs(y-Number(d.ownerY))+w/2<=Number(d.ownerHeight)/2+.01;
  return {id:d.biomePopup||`${d.biomeEdge}/${d.edge}/${d.sceneryX}/${d.sceneryY}`,x,y,w,height:el.style.height,inside:assertInside};
}).sort((a,b)=>a.id.localeCompare(b.id)));}
(async()=>{const browser=await chromium.launch({headless:true});try{
  for(const [width,height] of [[1280,720],[1912,914]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:3});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(URL);await page.waitForTimeout(2000);await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1800);
    const initial=await placement(page);assert.ok(initial.length>=5,'Mountain solids visible at home');assert.ok(initial.every(p=>p.inside),'Whole solid footprints contained');
    assert.ok(await page.locator('[data-biome-popup="hero-den"] [data-prop-volume]').count()>0,'Den uses voxel art');
    const main=await page.locator('[data-biome-popup] [data-prop-volume]').evaluateAll(els=>els.map(el=>({width:Number(el.dataset.volumeGroundWidth),depth:Number(el.dataset.volumeGroundDepth),owner:Number(el.closest('[data-biome-popup]').dataset.ownerWidth)})));
    assert.ok(main.every(p=>p.width>=Math.min(48,p.owner)*.85&&p.depth>=Math.min(48,p.owner)*.75),'Main voxels occupy most of the tile in both ground axes');
    const observations=[];
    for(let step=0;step<=8;step++){
      if(step){const turn=page.getByRole('button',{name:'Turn table right',exact:true});if(step%2)await turn.click();else await turn.tap();await page.waitForTimeout(650);}
      const data=await stats(page);assert.ok(data.length>=5);assert.ok(data.every(s=>s.count>1000&&!s.clipped),'Every heading has complete solid ink');
      observations.push(data);assert.deepEqual(await placement(page),initial,'Orbit leaves physical anchors and dimensions fixed');
      if([0,1,2,4,6].includes(step))await page.screenshot({path:`${directory}/${width}-orbit-${step*45}-3x.png`});
    }
    for(let i=0;i<observations[0].length;i++){
      const widths=observations.map(row=>row[i].width);assert.ok(Math.min(...widths)/Math.max(...widths)>.3,'Side views never become slivers');
      assert.equal(observations[0][i].hash,observations[8][i].hash,'Full orbit returns identical art');assert.notEqual(observations[0][i].hash,observations[2][i].hash,'Sides depict different surfaces');
    }
    assert.ok(await page.locator('[data-volume-shadow]').count()>0);
    await page.getByRole('button',{name:'Reset View',exact:true}).click();await page.waitForTimeout(650);
    assert.ok(await page.getByRole('button',{name:'Flat camera view',exact:true}).count(),'Reset retains immersion');
    // Low camera descent: use the existing mouse wheel input over the table.
    const view=await page.locator('.proto-map-viewport').boundingBox();await page.mouse.move(view.x+view.width*.8,view.y+view.height*.8);
    for(let step=0;step<40;step++){await page.mouse.wheel(0,-160);await page.waitForTimeout(25);}await page.waitForTimeout(1200);
    const low=await stats(page);assert.ok(low.length>=5&&low.every(s=>s.elevation<30),'Solid views follow camera descent');await page.screenshot({path:`${directory}/${width}-low-3x.png`});
    await page.getByRole('button',{name:'Reset View',exact:true}).tap();await page.waitForTimeout(600);
    assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-readouts,.proto-map-fps,.proto-map-zoom,.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
    await page.getByRole('button',{name:'Flat camera view',exact:true}).tap();await page.waitForTimeout(750);assert.equal(await page.locator('[data-prop-volume]').count(),0);assert.equal(await page.locator('[data-volume-shadow]').count(),0);
    // Mouse entry into the food tile uses its dedicated berry bush solid.
    const from=await page.locator('[data-cell-grip="actor-hero"]').boundingBox(),to=await page.locator('[data-biome-id="day-one-berries"]').boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();await page.locator('[data-route-line]').waitFor({state:'detached',timeout:15000});
    if(await page.getByRole('button',{name:'Tilt camera view',exact:true}).count())await page.getByRole('button',{name:'Tilt camera view',exact:true}).tap();await page.waitForTimeout(1400);
    assert.ok(await page.locator('[data-biome-popup="day-one-berries"] [data-prop-volume]').count()>0,'Berry bushes use the shared solid renderer');
    const trees=[];
    for(let i=0;i<4;i++){trees.push(await stats(page));await page.screenshot({path:`${directory}/${width}-trees-${i*90}-3x.png`});await page.getByRole('button',{name:'Turn table right',exact:true}).tap();await page.waitForTimeout(500);await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(500);}
    assert.ok(trees.every(row=>row.every(s=>s.count>100&&!s.clipped)),'All tree views retain foliage');
    assert.deepEqual(errors,[]);fs.writeFileSync(`${directory}/${width}-metrics.json`,JSON.stringify({observations,trees},null,2));console.log(`PASS ${width}: solid mountains/trees, full orbit, fixed footprints, mouse/touch turns, low camera, shadows, top-down restore and layout.`);await context.close();
  }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
