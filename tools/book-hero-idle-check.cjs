const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1280,height:850}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.addInitScript(()=>addEventListener('book:platformer-ready',e=>window.platformer=e.detail));
 await p.goto((process.env.BOOK_TEST_URL??'http://127.0.0.1:5178')+'/book.html?page=22',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('canvas').dataset.platformer==='22');await p.waitForTimeout(1600);
 const canvas=p.locator('canvas');assert.equal(await canvas.getAttribute('data-hero-clip'),'breath');assert(!requests.some(url=>/suite-v1\/(idle|sit)\.png/.test(url)));
 async function advanceIdle(seconds){await p.evaluate(seconds=>{const s=platformer,j=s.journey,c={moving:false,x:j.x,y:j.y,ledge:s.ledges.find(p=>p.id===j.surface),finished:j.completed};for(let i=0;i<seconds*60;i++)s.idle.update(1/60,c);},seconds);await p.waitForTimeout(100);}
 async function stand(){await p.evaluate(()=>platformer.idle.requestMove());await advanceIdle(6);await p.evaluate(()=>platformer.idle.movementStarted());await p.waitForTimeout(100);}
 async function tapHero(){const q=await p.evaluate(()=>{const {journey:j,camera:c}=platformer,v=c.position.clone().set(j.x-12,1100-j.y+35,26).project(c);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}});await p.mouse.click(q.x,q.y);}
 for(const [name,action] of [['sit','sit-down'],['roll','roll'],['spin','spin'],['salute','salute']]){
  await stand();await tapHero();await p.waitForFunction(action=>platformer.idle.action===action,action);await advanceIdle(name==='sit'?1:.9);
  await p.screenshot({path:'output/hero-idle-v2/'+name+'-in-book.png'});
 }
 await stand();await p.evaluate(()=>{const s=platformer;s.journey.navigate('a-gap');for(let i=0;i<10000&&s.journey.travelling;i++)s.journey.update(1/60);s.idle.reset();const l=s.ledges.find(p=>p.id==='a-gap');if(l.width<220)throw Error('Chase fixture too short');for(let n=0;n<4;n++){s.idle.cycleIdle(l);s.idle.requestMove();for(let i=0;i<600&&!s.idle.canNavigate;i++)s.idle.update(1/60,{moving:false,x:s.journey.x,y:s.journey.y,ledge:l});s.idle.movementStarted();}});
 await p.waitForTimeout(1500);await tapHero();await p.waitForFunction(()=>platformer.idle.action==='butterfly');await advanceIdle(.8);assert.equal(await canvas.getAttribute('data-butterfly'),'true');await p.screenshot({path:'output/hero-idle-v2/butterfly-in-book.png'});
 const interrupt=await p.evaluate(()=>{const s=platformer,before=s.journey.x+s.idle.offsetX;s.navigate(s.ledges.find(p=>p.id==='a-gap'),s.journey.x+20);return Math.abs(before-s.journey.x);});assert(interrupt<.01);
 await p.evaluate(()=>{const s=platformer;for(let i=0;i<10000&&s.journey.travelling;i++)s.journey.update(1/60);s.idle.reset();});await advanceIdle(90);
 await p.waitForFunction(()=>document.querySelector('canvas').dataset.idleAction==='sleep');assert.equal(await canvas.getAttribute('data-hero-clip'),'sleep');await p.screenshot({path:'output/hero-idle-v2/sleep-in-book.png'});
 const wake=await p.evaluate(()=>{const s=platformer,before=s.journey.x;s.navigate(s.ledges.find(p=>p.id==='a-drop'));return{action:s.idle.action,x:s.journey.x,before,moving:s.journey.travelling};});assert.equal(wake.action,'wake-eyes');assert.equal(wake.x,wake.before);assert.equal(wake.moving,false);
 await advanceIdle(3);await p.waitForFunction(()=>platformer.journey.travelling);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({openEyeBreathing:true,legacyWinksExcluded:true,directTapCycle:true,butterfly:true,rootContinuous:true,sleep:true,wakeBeforeMove:true,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
