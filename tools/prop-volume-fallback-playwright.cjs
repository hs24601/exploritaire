const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
(async()=>{const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true,deviceScaleFactor:3}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${URL}?propRenderer=canvas`);await page.waitForTimeout(1500);await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1800);
  for(let step=0;step<4;step++){
    const samples=await page.locator('[data-prop-volume]').evaluateAll(canvases=>canvases.map(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;
      for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;
      return {engine:canvas.dataset.volumeEngine,count,yaw:Number(canvas.dataset.volumeYaw)};
    }));
    assert.ok(samples.length>=5&&samples.every(s=>s.engine==='canvas'&&s.count>1000),'Fallback paints full solid mountains');
    assert.ok(samples.every(s=>Math.abs(((s.yaw-step*90)%360+360)%360)<2));
    if(step===1)await page.screenshot({path:'artifacts/prop-volume/canvas-side-3x.png'});
    await page.getByRole('button',{name:'Turn table right',exact:true}).tap();await page.waitForTimeout(550);await page.getByRole('button',{name:'Turn table right',exact:true}).click();await page.waitForTimeout(550);
  }
  assert.deepEqual(errors,[]);
  if(process.env.TAILNET_PROTO_URL){await page.goto(process.env.TAILNET_PROTO_URL);assert.ok(await page.getByRole('button',{name:'Tilt camera view',exact:true}).count());}
  console.log('PASS Canvas fallback: full solid views at 0/90/180/270, mouse/touch turns, no browser errors. Proto URL loads.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
