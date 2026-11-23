const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>addEventListener('book:platformer-ready',e=>window.platformer=e.detail));
 await p.goto((process.env.BOOK_TEST_URL??'http://127.0.0.1:5178')+'/book.html?page=22',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('canvas').dataset.platformer==='22');await p.waitForTimeout(1800);
 const cdp=await p.context().newCDPSession(p),state=()=>p.evaluate(()=>({height:platformer.camera.top-platformer.camera.bottom,x:platformer.camera.position.x,y:platformer.camera.position.y,target:platformer.journey.target,actorX:platformer.journey.x}));
 const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4,force:1}))});
 const before=await state();await touch('touchStart',[[1,140,230]]);await touch('touchStart',[[1,140,230],[2,240,230]]);
 for(let i=1;i<=5;i++)await touch('touchMove',[[1,140-i*7,230],[2,240+i*7,230]]);
 await p.waitForTimeout(250);const zoomed=await state();assert(zoomed.height<before.height*.75,JSON.stringify({before,zoomed}));assert.equal(zoomed.target,null);assert.equal(zoomed.actorX,before.actorX);
 for(let i=1;i<=4;i++)await touch('touchMove',[[1,105+i*25,230+i*6],[2,275+i*25,230+i*6]]);
 await p.waitForTimeout(250);const panned=await state();assert(Math.abs(panned.x-zoomed.x)>5);assert(Math.abs(panned.y-zoomed.y)>5);assert(Math.abs(panned.height-zoomed.height)<.1);await touch('touchEnd',[]);
 await p.waitForTimeout(300);assert.equal((await state()).target,null);assert.equal((await state()).actorX,before.actorX);
 const tap=await p.evaluate(()=>{const {journey:j,camera:c}=platformer,v=c.position.clone().set(j.x-25,1100-j.y+0,4).project(c);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2+8};});
 assert(tap.x>0&&tap.x<390&&tap.y>70&&tap.y<750,JSON.stringify(tap));await touch('touchStart',[[1,tap.x,tap.y]]);await touch('touchEnd',[]);
 await p.waitForFunction(x=>Math.abs(platformer.journey.x-x)>5,before.actorX);await p.screenshot({path:'output/book/platformer-touch-zoom.png'});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pinchZoom:true,twoFingerPan:true,noAccidentalDestination:true,tapNavigationPreserved:true,beforeHeight:before.height,zoomedHeight:zoomed.height,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});



