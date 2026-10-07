const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Tilted pixel art stays sharp as the camera zooms in. The browser rasterizes
// 3D layers at their layout size and stretches them with the zoom, so without
// oversampling the Hero and the scenery went soft. Shrinks the zoomed-in Hero
// back to its opening size and compares edge detail: sharp art keeps it,
// stretched art loses it.
const detail=(p,png,size)=>p.evaluate(async([src,size])=>{const i=new Image();await new Promise(r=>{i.onload=r;i.src='data:image/png;base64,'+src;});
  const c=document.createElement('canvas');c.width=size?size.width:i.width;c.height=size?size.height:i.height;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(i,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data;
  const L=k=>d[k]*0.3+d[k+1]*0.59+d[k+2]*0.11;let sum=0,n=0;
  for(let y=1;y<c.height;y++)for(let xx=1;xx<c.width;xx++){const k=(y*c.width+xx)*4;sum+=Math.abs(L(k)-L(k-4))+Math.abs(L(k)-L(k-c.width*4));n++;}
  return {value:sum/n,width:c.width,height:c.height};},[png.toString('base64'),size]);
(async()=>{const b=await chromium.launch({headless:true});const problems=[];const report=[];try{
  for(const [w,h,dpr] of [[1912,914,1],[390,844,3]]){
    const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});await p.goto('http://localhost:5179/proto.html');
    if(w<900)await p.getByRole('button',{name:'Table',exact:true}).click();
    await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(1000);
    const hero=p.locator('[data-board-piece="actor"]').first();
    const shot=async()=>{const box=await hero.boundingBox();const pad=box.width*0.2;return {box,png:await p.screenshot({clip:{x:box.x+pad,y:box.y+pad,width:box.width-pad*2,height:box.height-pad*2}})};};
    const base=await shot();const reference=await detail(p,base.png);const before=reference.value;
    const box=base.box;await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
    for(let i=0;i<4;i++){await p.mouse.wheel(0,-240);await p.waitForTimeout(250);}
    await p.waitForTimeout(1500);
    const zoomed=await shot();const after=(await detail(p,zoomed.png,{width:reference.width,height:reference.height})).value;const ratio=after/before;
    report.push(`${w}x${h}@${dpr}x: ${base.box.width.toFixed(0)}px→${zoomed.box.width.toFixed(0)}px, detail ${before.toFixed(1)}→${after.toFixed(1)}`);
    if(zoomed.box.width<base.box.width*1.3)problems.push(`${w}x${h}: zoom did not enlarge the Hero (${base.box.width}→${zoomed.box.width})`);
    else if(ratio<0.85)problems.push(`${w}x${h}@${dpr}x: Hero art blurs when zoomed in (detail ${before.toFixed(1)} → ${after.toFixed(1)})`);
    await p.close();
  }
  assert.deepEqual(problems,[],'standee sharpness defects:\n'+problems.join('\n'));
  console.log('Tilted Hero stays sharp zoomed in: '+report.join('; ')+'.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
