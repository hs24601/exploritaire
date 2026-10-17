const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html';
const OUT = 'artifacts/volumetric';
fs.mkdirSync(OUT, { recursive: true });
const setHour = (p, h) => p.locator('input[type=range]').first().evaluate((el,v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(v));
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
},h);
const frames = p => p.evaluate(() => new Promise(resolve => {
  const gaps=[];let last=performance.now(),start=last;
  const tick=now=>{gaps.push(now-last);last=now;if(now-start<1500)requestAnimationFrame(tick);else{
    gaps.sort((a,b)=>a-b);resolve({median:gaps[Math.floor(gaps.length/2)],p95:gaps[Math.floor(gaps.length*.95)],frames:gaps.length});
  }};requestAnimationFrame(tick);
}));
const zoomShot=async(p,clip,path)=>{
  const png=await p.screenshot({clip});
  const enlarged=await p.evaluate(async data=>{
    const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width*3;canvas.height=img.height*3;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL().split(',')[1];
  },png.toString('base64'));
  fs.writeFileSync(path,Buffer.from(enlarged,'base64'));
};
(async()=>{
  const b=await chromium.launch({headless:true});const report=[];
  try {
    for(const [w,h] of [[1912,914],[1280,720]]) {
      const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(URL+'?fx=high');
      assert.equal(await p.locator('.proto-volumetrics').getAttribute('data-active'),'false','flat keeps a hidden warm volume');
      assert.equal(await p.locator('.proto-volumetrics').evaluate(el=>getComputedStyle(el).opacity),'0');
      await p.getByRole('button',{name:'Tilt camera view'}).click();
      const volume=p.locator('.proto-volumetrics');await volume.waitFor();await p.waitForTimeout(900);
      if(w===1912){
        const rendered=await p.evaluate(async()=>{
          const {createAtmosphereRenderer}=await import('/src/proto/components/atmosphereRenderer.ts');
          const {getTableLighting}=await import('/src/proto/protoLighting.ts');
          const canvas=document.createElement('canvas');const renderer=createAtmosphereRenderer(canvas);
          const input={width:640,height:480,scale:0.5,camera:{x:-68,y:0,scale:1.7,yaw:0},tilt:{angle:38,perspective:800},frame:getTableLighting(17),lights:[],time:1000,guards:[],scene:{patches:[{x:40,y:0,width:100,height:100,terrain:'woods'}],canopies:[]}};
          const gl=canvas.getContext('webgl');const read=()=>{const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
          input.scene.canopies=[{id:'test-tree',x:40,y:0,width:100,height:100,sprite:'/assets/biomes/small_woods_pines.png',trimmed:true,castsShadow:false}];
          renderer.draw(input);await new Promise(r=>setTimeout(r,250));renderer.draw(input);const clear=read();const clearImage=canvas.toDataURL().split(',')[1];
          input.scene.canopies[0].castsShadow=true;renderer.draw(input);const shaded=read();
          let visible=0,changed=0,outside=0;
          for(let i=0;i<clear.length;i+=4){if(clear[i+3]>0)visible++;if(clear[i]-shaded[i]>1||clear[i+1]-shaded[i+1]>1){changed++;if(clear[i+3]>8)outside++;}}
          const image=canvas.toDataURL().split(',')[1];renderer.dispose();return {visible,changed,outside,image,clearImage};
        });
        fs.writeFileSync(`${OUT}/shader.png`,Buffer.from(rendered.image,'base64'));
        fs.writeFileSync(`${OUT}/shader-clear.png`,Buffer.from(rendered.clearImage,'base64'));
        console.log(`Shader pixels: ${rendered.visible} visible, ${rendered.changed} occluded, ${rendered.outside} beyond the cutout.`);
        assert.ok(rendered.visible>1000,'shader emits visible pixels');
        assert.ok(rendered.changed>20,'canopy attenuates lighting with the sprite mask held constant');
        assert.ok(rendered.outside>10,'canopy shadow reaches open air beyond the sprite');
      }
      assert.equal(await volume.getAttribute('data-renderer'),'webgl','shader compiled and linked');
      assert.ok(Number(await volume.getAttribute('data-canopies'))>5,'scenery supplies a canopy atlas');
      assert.equal(await volume.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
      assert.ok(await volume.evaluate(el=>el.width*el.height < el.clientWidth*el.clientHeight*0.1),'bounded resolution');
      for(const [hour,tag] of [[6.5,'dawn'],[9,'day'],[17.5,'dusk'],[22,'night']]){
        await setHour(p,hour);await p.waitForTimeout(350);
        await p.screenshot({path:`${OUT}/${w}-${tag}.png`});
      }
      const defects=await findLayoutDefects(p,'.proto-map-toolbar',{parts:'button'});
      assert.deepEqual(defects,[],'camera controls remain usable');
      const box=await p.locator('.proto-map-viewport').boundingBox();
      // Mouse and touch camera interaction passes through the entire atmospheric layer.
      await p.mouse.move(box.x+box.width*.8,box.y+box.height*.75);await p.mouse.down({button:'right'});
      await p.mouse.move(box.x+box.width*.8+55,box.y+box.height*.75+10,{steps:5});await p.mouse.up({button:'right'});
      // The time slider retains focus after hour changes; camera keys correctly
      // ignore focused controls. Return focus to the table before testing E.
      await p.evaluate(()=>document.activeElement?.blur());
      await p.keyboard.press('e');
      await p.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-yaw'))>40);
      const yaw=await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-yaw')));
      assert.ok(yaw>40,'volume does not block camera spin');
      const session=await p.context().newCDPSession(p);
      const cameraX=()=>p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.proto-map-viewport')).getPropertyValue('--camera-x')));
      const was=await cameraX(),sx=box.x+box.width*.7,sy=box.y+box.height*.8;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:sx,y:sy},{id:2,x:sx+50,y:sy}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:sx+50,y:sy},{id:2,x:sx+100,y:sy}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150);
      assert.ok(Math.abs(await cameraX()-was)>20,'touch pan passes through atmospheric surface');
      await p.screenshot({path:`${OUT}/${w}-spin.png`});
      const rect=await volume.boundingBox();await zoomShot(p,{x:rect.x+rect.width*.35,y:rect.y+rect.height*.25,width:rect.width*.35,height:rect.height*.45},`${OUT}/${w}-detail-3x.png`);
      report.push({viewport:[w,h],renderer:'webgl',resolution:await volume.getAttribute('data-resolution'),timing:await frames(p)});
      assert.deepEqual(errors,[]);
      if(w===1280){await volume.evaluate(el=>el.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());await p.waitForTimeout(400);assert.equal(await p.locator('.proto-volumetrics').getAttribute('data-renderer'),'canvas','context loss switches to Canvas');}
      await p.close();
    }
    for(const [query,reduced] of [['?fx=low',false],['?fx=high&atmosphere=canvas',false],['?fx=high',true]]){
      const p=await b.newPage({viewport:{width:1280,height:720},reducedMotion:reduced?'reduce':'no-preference'});
      await p.goto(URL+query);await p.getByRole('button',{name:'Tilt camera view'}).click();await p.waitForTimeout(900);
      if(query.includes('low')){assert.equal(await p.locator('.proto-volumetrics').count(),0);assert.ok(await p.locator('[data-atmosphere="ray"]').count()>0);}
      else{assert.equal(await p.locator('.proto-volumetrics').getAttribute('data-renderer'),query.includes('canvas')?'canvas':'webgl');}
      await p.screenshot({path:`${OUT}/${query.includes('low')?'low':query.includes('canvas')?'fallback':'reduced'}.png`});
      await p.close();
    }
    for(const mode of ['off','on']){
      const p=await b.newPage({viewport:{width:1912,height:914}});await p.goto(URL+'?fx=high'+(mode==='off'?'&atmosphere=off':''));
      await p.getByRole('button',{name:'Tilt camera view'}).click();await setHour(p,17.5);await p.waitForTimeout(3500);
      await p.screenshot({path:`${OUT}/compare-${mode}.png`});
      report.push({comparison:mode,hour:17.5,timing:await frames(p)});await p.close();
    }
    fs.writeFileSync(`${OUT}/performance.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    console.log('Volume: GPU, Canvas fallback, low tier, reduced motion, desktop layouts, time changes, camera input and bounded buffers verified.');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
