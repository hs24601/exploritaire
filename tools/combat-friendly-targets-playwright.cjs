const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true});try {
fs.mkdirSync('artifacts/combat-friendly-targets',{recursive:true});
for (const [width,height,touch] of [[1280,720,false],[1912,914,true]]) {
 const p=await browser.newPage({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'reduce'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');
 await p.getByRole('checkbox',{name:'maxAP',exact:true}).check();
 const foundation=p.locator('[data-battle-target="mochi"]');
 const hp=()=>p.locator('[data-battle-slot="mochi"] [data-bar="hp"]').getAttribute('aria-valuenow').then(Number);
 await p.getByRole('button',{name:'Nip',exact:true}).click();
 await foundation.focus();
 await p.waitForFunction(()=>document.querySelector('[data-battle-target="mochi"]').dataset.preview==='focus');
 assert.equal(await p.locator('[data-battle-slot="mochi"] .battle-bar__preview').count(),1);
 assert.equal(await p.locator('[data-battle-slot="hero"] .battle-bar__preview').count(),0);
 for (const id of ['hero','mochi']) assert.deepEqual(await findLayoutDefects(p,'[data-battle-actor="'+id+'"]',{parts:'.battle-field__pile, .battle-field__actor-card'}),[]);
 await p.locator('[data-battle-slot="mochi"]').screenshot({path:'artifacts/combat-friendly-targets/'+width+'-foundation-3x.png'});
 await p.keyboard.press('Enter');assert.equal(await hp(),9);
 await p.getByRole('button',{name:'Nip',exact:true}).click();
 const scene=p.locator('[data-scene-target="mochi"]');
 await p.waitForFunction(()=>document.querySelector('[data-scene-target="mochi"]')?.dataset.targetable==='true');
 const from=await p.locator('.ability-card-popover .ability-card').boundingBox();const to=await scene.boundingBox();
 const a={x:from.x+from.width/2,y:from.y+from.height/2},b={x:to.x+to.width/2,y:to.y+to.height/2};
 const cdp=touch?await p.context().newCDPSession(p):null;
 if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[b]});}
 else {await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:8});}
 await p.waitForFunction(()=>JSON.parse(document.querySelector('.combat-demo__arena').dataset.actors).find(u=>u.id==='mochi')?.targeting==='focused');
 const actors=JSON.parse(await p.locator('.combat-demo__arena').getAttribute('data-actors'));
 assert.equal(actors.find(u=>u.id==='mochi').marker.content[0].meter.preview,8);
 await p.screenshot({path:'artifacts/combat-friendly-targets/'+width+'-scene.png'});
 await p.locator('[data-battle-slot="mochi"]').screenshot({path:'artifacts/combat-friendly-targets/'+width+'-foundation-3x.png'});
 if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();
 await p.waitForFunction(()=>document.querySelector('[data-battle-slot="mochi"] [data-bar="hp"]').getAttribute('aria-valuenow')==='8');
 await p.getByRole('button',{name:'Nip',exact:true}).click();await p.keyboard.press('Escape');
 assert.equal(await foundation.getAttribute('data-preview'),null);
 assert.deepEqual(errors,[]);await p.close();console.log(width+' '+(touch?'touch':'mouse')+' passed');
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
