const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
(async()=>{const browser=await chromium.launch();fs.mkdirSync('artifacts/relief-coverage',{recursive:true});try{
  for(const width of [1280,1912])for(const renderer of ['webgl','canvas']){
    const page=await browser.newPage({viewport:{width,height:width===1280?720:914},deviceScaleFactor:3,hasTouch:true,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(URL+'?fx=low&atmosphere=off&propRenderer='+renderer);
    await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(1200);
    const centerDen=async()=>{
      const map=await page.locator('.proto-map-viewport').boundingBox(),target=await page.locator('[data-biome-popup="hero-den"]').boundingBox();
      const from={x:map.x+map.width*.1,y:map.y+map.height*.15};
      await page.mouse.move(from.x,from.y);await page.mouse.down();
      await page.mouse.move(from.x+map.x+map.width/2-target.x-target.width/2,from.y+map.y+map.height/2-target.y-target.height/2,{steps:12});
      await page.mouse.up();await page.waitForTimeout(400);
    };
    for(const zoom of ['normal','close','front']){
      if(zoom==='close'){
        await centerDen();
        const target=await page.locator('[data-biome-popup="hero-den"]').boundingBox();
        await page.mouse.move(target.x+target.width/2,target.y+target.height/2);
        for(let i=0;i<12;i++){await page.mouse.wheel(0,-1700);await page.waitForTimeout(100);}
        await page.waitForTimeout(800);
      }
      if(zoom==='front'){
        for(let i=0;i<4;i++){const turn=page.getByRole('button',{name:'Turn table right',exact:true});if(i%2)await turn.tap();else await turn.click();await page.waitForTimeout(200);}
      }
      if(zoom!=='normal')await centerDen();
      const den=page.locator('[data-biome-popup="hero-den"] [data-prop-volume]').first();
      const berry=page.locator('[data-biome-popup="day-one-berries"] [data-prop-volume]').first();
      assert.equal(Number(await den.getAttribute('data-volume-height-scale')),.5);
      assert.equal(Number(await berry.getAttribute('data-volume-height-scale')),.3);
      const samples=await page.locator('[data-environment-prop] [data-prop-volume]').evaluateAll(canvases=>canvases.flatMap(el=>{
        const box=el.getBoundingClientRect(),ctx=el.getContext('2d'),data=ctx.getImageData(0,0,el.width,el.height).data;
        const points=[];
        for(let y=4;y<el.height-4;y+=7)for(let x=4;x<el.width-4;x+=7){
          if([-3,0,3].every(dy=>[-3,0,3].every(dx=>data[((y+dy)*el.width+x+dx)*4+3]===255)))
            points.push({x:box.x+(x+.5)/el.width*box.width,y:box.y+(y+.5)/el.height*box.height});
        }
        return points;
      }));
      assert.ok(samples.length>100,'Sample actual opaque relief interiors');
      const before=(await page.screenshot()).toString('base64');
      const hide=await page.addStyleTag({content:'.proto-table-floor {background:#ff00ff !important;background-image:none !important}.proto-neutral-ground {visibility:hidden !important}[data-board-piece="tile"] {background:#00ffff !important}.proto-table-horizon,.proto-ground-light {visibility:hidden !important}'});
      await page.waitForTimeout(200);
      const after=(await page.screenshot()).toString('base64');
      await hide.evaluate(el=>el.remove());
      const diff=await page.evaluate(async({before,after,samples})=>{
        const read=async source=>{const image=new Image();image.src='data:image/png;base64,'+source;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return{width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};};
        const a=await read(before),b=await read(after),dpr=devicePixelRatio;let changed=0,count=0;
        for(const p of samples){const x=Math.floor(p.x*dpr),y=Math.floor(p.y*dpr);if(x<0||y<0||x>=a.width||y>=a.height)continue;const i=(y*a.width+x)*4;count++;if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>3))changed++;}
        return{changed,count};
      },{before,after,samples});
      await page.screenshot({path:`artifacts/relief-coverage/${width}-${renderer}-${zoom}-3x.png`});
      assert.ok(diff.count>100,zoom+' samples '+JSON.stringify(diff));assert.equal(diff.changed,0,'Ground/grid/horizon cannot show through opaque relief pixels: '+JSON.stringify(diff));
    }
    assert.deepEqual(await findLayoutDefects(page,'.proto-map-footer',{parts:'.proto-map-toolbar,.proto-map-camera-button,.table-grid-reference'}),[]);
    assert.deepEqual(errors,[]);console.log('PASS opaque relief coverage and reduced heights',width,renderer);await page.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
