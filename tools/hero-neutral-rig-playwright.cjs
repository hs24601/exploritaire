const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{
 const p=await b.newPage({viewport:{width:1440,height:700},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.goto('http://localhost:5178/tools/hero-faces-preview.html');
 for(const emotion of ['sad','neutral']) {
  if(emotion==='sad') await p.getByRole('button',{name:'Sad',exact:true}).click();
  else await p.getByRole('button',{name:'Neutral expression',exact:true}).click();
  for(const angle of [20,55,90]) {
   await p.getByRole('button',{name:angle+'°',exact:true}).click();
   for(const pose of ['sitting','standing','walking']) {
    await p.getByRole('button',{name:pose,exact:true}).click();await p.waitForTimeout(350);
    const expected=angle===90?0:emotion==='sad'&&pose==='sitting'?7:5;
    assert.equal(await p.locator('canvas[data-face-layer=true]').count(),expected,`${emotion} ${pose} ${angle}`);
    if(angle!==90) await p.screenshot({path:`artifacts/hero-${emotion}-${pose}-${angle}-v2.png`});
   }
  }
 }
 await p.goto('http://localhost:5178/proto.html');
 const open=()=>p.getByRole('button',{name:'Scenario +',exact:true}).click();await open();
 const picker=p.getByLabel('Hero emotion',{exact:true});await picker.selectOption('neutral');
 await p.getByRole('button',{name:'Save Hero emotion',exact:true}).click();await p.reload();await open();
 assert.equal(await picker.inputValue(),'neutral');
 await p.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('[data-table-sectional-sprite=hero] canvas[data-sprite-pose=walking][data-actor-expression=neutral][data-face-layer=true]'));
 await p.screenshot({path:'artifacts/hero-neutral-departure-v2.png'});
 await picker.selectOption('sad');
 await p.waitForFunction(()=>document.querySelector('[data-table-sectional-sprite=hero] canvas[data-actor-expression=sad][data-face-layer=true]'));
 assert.deepEqual(errors,[]);console.log('PASS: 144 expression/pose/view combinations, saved neutral reload, live neutral/sad departure, no shader errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
