const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{for(const width of [1674,1280]){
const p=await b.newPage({viewport:{width,height:width===1280?720:940}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:5178/proto.html');await p.getByRole('button',{name:'Scenario +',exact:true}).click();await p.waitForTimeout(2200);
const mood=await p.locator('[data-story-mood]').getAttribute('data-story-mood');
await p.getByRole('button',{name:'Visit nearby bush',exact:true}).click();await p.getByRole('button',{name:'Scenario −',exact:true}).click();await p.mouse.move(5,5);await p.waitForTimeout(4000);
assert.equal(await p.locator('[data-story-mood]').getAttribute('data-story-mood'),mood);
await p.locator('[data-biome-popup="hero-den"] .proto-sprite-standee__art').first().waitFor({state:'visible'});
await p.locator('[data-table-sectional-sprite="hero"] canvas[data-face-layer="true"]').waitFor({state:'visible'});
assert.deepEqual(errors,[]);
await p.screenshot({path:`artifacts/tableau-departure-${width}.png`});
await p.locator('.proto-map').screenshot({path:`artifacts/tableau-departure-map-${width}.png`});
console.log(`PASS ${width}: scene grade retained, den artwork and Hero canvas visible, no page errors`);await p.close();
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
