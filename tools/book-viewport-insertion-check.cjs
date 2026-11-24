const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const errors=[];
 async function check(viewport,target,position,kinds){
  const context=await b.newContext({viewport,reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.goto('http://localhost:5183/book.html?page=01&Edit=true');await p.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true',null,{timeout:90000});
  await p.evaluate(({target,position})=>dispatchEvent(new CustomEvent('book:camera-play',{detail:[{name:'Authoring crop',shot:{position,target,fov:38},durationMs:0,holdMs:0,easing:'cut'}]})),{target,position});
  await p.waitForFunction(x=>Math.abs(Number(document.querySelector('canvas').dataset.cameraTarget?.split(',')[0])-x)<.01,target[0]);
  for(const [kind,label]of kinds){const before=await p.locator('#book-stage > canvas').getAttribute('data-camera-target');await p.getByRole('button',{name:label,exact:true}).click();await p.waitForTimeout(350);
   const doc=await p.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1'))),item=doc.pages.find(p=>p.page===1).controls.at(-1);assert.equal(item.kind,kind);assert(Math.abs(item.x-target[0])<1.6,JSON.stringify(item));assert.equal(await p.locator('#book-stage > canvas').getAttribute('data-camera-target'),before);
   const result=await p.evaluate(()=>({safe:JSON.parse(document.querySelector('canvas').dataset.safeFrame),points:document.querySelector('#book-page-selection polygon').getAttribute('points').split(' ').map(s=>s.split(',').map(Number))}));for(const[x,y]of result.points){assert(x>=result.safe.x-1&&x<=result.safe.x+result.safe.width+1,JSON.stringify(result));assert(y>=result.safe.y-1&&y<=result.safe.y+result.safe.height+1,JSON.stringify(result));}
  }
  await p.screenshot({path:`output/book/viewport-insertion-${viewport.width}.png`});
  const count=await p.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')).pages.find(p=>p.page===1).controls.length);
  await p.evaluate(()=>dispatchEvent(new CustomEvent('book:camera-play',{detail:[{name:'Off paper',shot:{position:[50,5,50],target:[50,.2,48],fov:38},durationMs:0,holdMs:0,easing:'cut'}]})));await p.waitForFunction(()=>document.querySelector('canvas').dataset.cameraTarget?.startsWith('50.00000'));
  await p.getByRole('button',{name:'+ Paint region',exact:true}).click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')).pages.find(p=>p.page===1).controls.length),count);assert((await p.locator('#book-page-editor .book-page-body>output').textContent()).includes('No usable page area'));
  await context.close();
 }
 await check({width:1440,height:1000},[-3,.154,-2],[-3,3,-1.999],[['text','+ Text box'],['prop','+ Popup prop'],['paint-region','+ Paint region']]);
 await check({width:390,height:844},[3,.154,1],[3,4,1.001],[['text','+ Text box'],['paint-region','+ Paint region']]);
 assert.deepEqual(errors,[]);console.log('PASS text, props and paint regions spawn inside the current desktop/mobile view; camera unchanged; off-page view does not create lost controls');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
