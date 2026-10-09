const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// The table opens at 09:00, and dragging the time slider moves the hour steadily
// with the pointer, even on a slow CPU: no backward jumps, and the slider never
// shifts sideways as the clock text changes (Night, Twilight, Day).
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1280,720]])for(const rate of [1,4]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5178/proto.html');await p.waitForTimeout(800);
    const clock=p.locator('.proto-lighting-rail__clock');
    assert.match(await clock.textContent(),/09:00/,`${w}x${h} the table opens at 09:00`);
    (await findLayoutDefects(p,'.proto-lighting-rail',{parts:'.proto-lighting-rail > *'})).forEach(d=>problems.push(`${w}x${h} lighting rail: ${d}`));
    const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
    const s=p.locator('[aria-label="Table time of day"]');const r=await s.boundingBox();
    await p.evaluate(()=>{window.__ev=[];const i=document.querySelector('[aria-label="Table time of day"]');i.addEventListener('input',()=>window.__ev.push([+i.value,i.getBoundingClientRect().x]));});
    await p.mouse.move(r.x+5,r.y+r.height/2);await p.mouse.down();
    for(let k=1;k<=40;k++){await p.mouse.move(r.x+5+k*(r.width-10)/40,r.y+r.height/2);await p.waitForTimeout(16);}await p.mouse.up();
    const ev=await p.evaluate(()=>window.__ev);const values=ev.map(e=>e[0]);
    const back=values.slice(1).filter((v,i)=>v<values[i]-0.01);
    if(back.length)problems.push(`${w}x${h} ${rate}x CPU: hour jumped backward ${back.length} time(s): ${values.map(v=>v.toFixed(1)).join(',')}`);
    if(new Set(ev.map(e=>Math.round(e[1]))).size>1)problems.push(`${w}x${h} ${rate}x CPU: slider moved sideways while dragging`);
    if(values.at(-1)<23)problems.push(`${w}x${h} ${rate}x CPU: drag ended at ${values.at(-1)}`);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    await p.waitForFunction(()=>/23:/.test(document.querySelector('.proto-lighting-rail__clock').textContent),null,{timeout:5000}).catch(()=>problems.push(`${w}x${h} ${rate}x CPU: the table never caught up with the slider`));
    await p.close();
  }
  assert.deepEqual(problems,[],'time slider defects:\n'+problems.join('\n'));
  console.log('Time slider: opens at 09:00, drags steadily forward with no backward jumps or sideways shift at normal and 4x slower CPU, the table catches up, the rail fits.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
