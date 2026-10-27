const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
const setHour=(p,h)=>p.locator('input[type=range]').first().evaluate((el,value)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
},h);
const ink=p=>p.locator('.proto-dust').evaluate(el=>{
  const data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
  let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
  return {pixels,image:el.toDataURL(),visible:Number(el.dataset.visibleMotes),count:Number(el.dataset.dustMotes),ratio:el.width/el.clientWidth};
});
(async()=>{
  fs.mkdirSync('artifacts/immersive-perf',{recursive:true});
  const b=await chromium.launch({headless:true,executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'});
  try{
    for(const [width,height] of [[1912,914],[1280,720]]){
      const p=await b.newPage({viewport:{width,height},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(URL+'?fx=high');await p.getByRole('button',{name:'Tilt camera view',exact:true}).click();await p.waitForTimeout(1200);
      const day=await ink(p);assert.ok(day.pixels>10&&day.visible>0&&day.count>0,'dust paints visible pixels');
      assert.ok(day.ratio<=0.51,'bounded dust surface');assert.equal(await p.locator('[data-atmosphere="mote"]').count(),0,'no individual animated dust layers');
      assert.equal(await p.locator('.proto-dust').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
      await p.waitForTimeout(400);assert.notEqual((await ink(p)).image,day.image,'dust animates');
      await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(200);
      const still=await ink(p);await p.waitForTimeout(300);assert.equal((await ink(p)).image,still.image,'reduced motion keeps dust steady');
      const area=await p.locator('.proto-map-viewport').boundingBox();
      const x=area.x+area.width*.8,y=area.y+area.height*.8;
      await p.mouse.move(x,y);await p.mouse.down({button:'right'});await p.mouse.move(x+60,y,{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(200);
      assert.notEqual((await ink(p)).image,still.image,'dust follows mouse pan even without animation');
      const beforeTouch=await ink(p),session=await p.context().newCDPSession(p);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y},{id:2,x:x+50,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x-50,y},{id:2,x,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(200);
      assert.notEqual((await ink(p)).image,beforeTouch.image,'dust follows touch pan');
      await p.evaluate(()=>document.activeElement?.blur());const beforeSpin=await ink(p);await p.keyboard.press('e');await p.waitForTimeout(400);
      assert.notEqual((await ink(p)).image,beforeSpin.image,'dust follows spin');
      assert.deepEqual(await findLayoutDefects(p,'.proto-map-toolbar',{parts:'button'}),[]);
      await p.emulateMedia({reducedMotion:'no-preference'});await setHour(p,17.5);await p.waitForTimeout(400);
      await p.screenshot({path:`artifacts/immersive-perf/${width}-dusk.png`});
      const shot=await p.screenshot({clip:{x:area.x+area.width*.3,y:area.y+area.height*.2,width:area.width*.4,height:area.height*.4}});
      const enlarged=await p.evaluate(async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width*3;c.height=image.height*3;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,c.width,c.height);return c.toDataURL().split(',')[1];},shot.toString('base64'));
      fs.writeFileSync(`artifacts/immersive-perf/${width}-dust-3x.png`,Buffer.from(enlarged,'base64'));
      await setHour(p,22);await p.waitForTimeout(300);assert.equal((await ink(p)).pixels,0,'no daylight dust at night');
      await p.getByRole('button',{name:'Flat camera view',exact:true}).click();await p.waitForTimeout(800);assert.equal(await p.locator('.proto-dust').count(),0,'flat unmounts dust');
      assert.deepEqual(errors,[]);await p.close();
    }
    const p=await b.newPage();await p.goto(URL+'?fx=low');await p.getByRole('button',{name:'Tilt camera view',exact:true}).click();await p.waitForTimeout(900);assert.equal((await ink(p)).count,0,'low tier drops dust');await p.close();
    console.log('Dust: bounded batched pixels, animation, reduced motion, night/flat/low, mouse and touch pan, spin, desktop layouts and runtime errors passed.');
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
