const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{
const p=await b.newPage({reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:5178/proto.html');await p.getByRole('button',{name:'Scenario +',exact:true}).click();
await p.getByLabel('Resolved Hero emotion').filter({hasText:'happy'}).waitFor();
await p.locator('[data-callout-id="day01.opening"] [data-hero-emoji=happy]').waitFor();
await p.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
await p.waitForFunction(()=>document.querySelector('[data-table-sectional-sprite=hero] canvas[data-actor-expression=happy][data-face-layer=false]'));
await p.getByLabel('Day scenario',{exact:true}).selectOption('day02');
await p.getByLabel('Resolved Hero emotion').filter({hasText:'sad'}).waitFor();
assert.deepEqual(errors,[]);console.log('PASS: Day 1 happy default, opening emoji, travel face, Day 2 sad preserved');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
