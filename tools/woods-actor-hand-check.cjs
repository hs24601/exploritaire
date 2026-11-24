const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='http://127.0.0.1:5178';
const harness=`<canvas id="combat-camera"></canvas><style>body{margin:0;background:#1b292c}</style><script type="module">
import '/src/book/book.css';
import * as THREE from '/node_modules/.vite/deps/three.js';
import {createWoodsHandBoard} from '/src/book/woodsHandBoardOverlay.ts';
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.12,9000),hero=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.MeshBasicMaterial());
const enemy=new THREE.Group();enemy.position.set(0,0,-4);const scene=new THREE.Scene();scene.add(hero,enemy);
window.testCamera=camera;window.combat=createWoodsHandBoard({canvas:document.querySelector('canvas'),camera,hero,khadroot:{root:enemy,attack(){},hurt(){},defeat(){},reset(){}},reduced:true,enabled:()=>true,paused:()=>false});
function frame(){camera.aspect=innerWidth/innerHeight;combat.camera();combat.update(performance.now()/1000);requestAnimationFrame(frame)}frame();
</script>`;
(async()=>{
 const timeout=setTimeout(()=>{console.error('Browser check exceeded 90 seconds');process.exit(1)},90000);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  fs.mkdirSync('artifacts/woods-actor-hand',{recursive:true});
  for(const [width,height] of [[1280,720],[1912,914],[884,797],[797,884],[412,915]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width<1100,reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/assets/**',route=>route.abort());
   await page.route('**/__actor-hand-check',route=>route.fulfill({contentType:'text/html',body:harness}));
   await page.goto(origin+'/__actor-hand-check',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('.woods-hb:not([hidden])').waitFor();
   assert.equal(await page.locator('.woods-hb-board').isVisible(),false);
   const original=await page.evaluate(()=>testCamera.position.toArray());
   const canvas=page.locator('canvas');
   await page.mouse.move(10,150);await page.mouse.down();await page.mouse.move(70,170,{steps:4});await page.mouse.up();
   // Wheel input takes manual control without moving or activating an actor.
   await canvas.dispatchEvent('wheel',{deltaY:-120});
   await page.waitForTimeout(50);
   assert.equal(await page.evaluate(()=>combat.diagnostics.cameraMode),'manual');
   assert.notDeepEqual(await page.evaluate(()=>testCamera.position.toArray()),original);
   await page.getByRole('button',{name:'Camera mode: Manual. Resume cinematic',exact:true}).click();
   assert.equal(await page.evaluate(()=>combat.diagnostics.cameraMode),'cinematic');
   assert.equal(await page.locator('.woods-hb-fan-toggle').count(),0);
   await page.getByRole('button',{name:'Choose Hero abilities',exact:true}).hover();
   assert.equal(await page.getByRole('button',{name:'Choose Hero abilities',exact:true}).evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
   await page.getByRole('button',{name:'Choose Hero abilities',exact:true})[width<1100?'tap':'click']();
   assert.equal(await page.locator('.woods-hb-board').isVisible(),true);
   assert.equal(await page.evaluate(()=>combat.state.energy.hero.current),3);
   const middleArt=page.locator('.woods-hb-fan-card').nth(1).locator('.woods-hb-holo-art');
   await page.mouse.move(0,0);await page.waitForTimeout(200);
   assert.equal(await middleArt.evaluate(n=>getComputedStyle(n).transform),'none');
   if(width>=1100){await page.locator('.woods-hb-fan-card').nth(1).hover();await page.waitForTimeout(200);assert.ok(await middleArt.evaluate(n=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(n).transform).a-1.2)<.001));}
   await page.mouse.move(0,0);
   assert.deepEqual(await page.locator('.woods-hb-fan-card .woods-hb-holo-title').allTextContents(),['Fira','Meteo','Dig']); await page.screenshot({path:'artifacts/woods-actor-hand/hand-'+width+'x'+height+'.png'});
   await page.getByRole('button',{name:/^Fira:/})[width<1100?'tap':'click']();
   assert.equal(await page.locator('.woods-hb-board').isVisible(),true);
   await page.getByRole('button',{name:'Choose Hero abilities',exact:true})[width<1100?'tap':'click']();
   assert.equal(await page.getByRole('button',{name:/^Meteo:/}).isDisabled(),true);
   assert.equal(await page.getByRole('button',{name:/^Dig:/}).isEnabled(),true);
   await page.getByRole('button',{name:/^Dig:/})[width<1100?'tap':'click']();
   const before=await page.evaluate(()=>combat.state.board.map(c=>c.map(card=>card.id)));
   await page.getByRole('button',{name:/Dig: top .*column 1$/})[width<1100?'tap':'click']();
   await page.getByRole('button',{name:/Dig: second-row .*column 2$/})[width<1100?'tap':'click']();
   const after=await page.evaluate(()=>({board:combat.state.board.map(c=>c.map(card=>card.id)),cooldown:combat.state.cooldowns.dig}));
   assert.equal(after.board[0].at(-1),before[1].at(-2));assert.equal(after.cooldown,3);
   assert.equal(await page.evaluate(()=>combat.state.energy.hero.current),0);
   await page.getByRole('button',{name:'End turn',exact:true})[width<1100?'tap':'click']();
   await page.waitForTimeout(150);
   await page.getByRole('button',{name:'Choose Mochi abilities',exact:true})[width<1100?'tap':'click']();
   assert.deepEqual(await page.locator('.woods-hb-fan-card .woods-hb-holo-title').allTextContents(),['Fast Swipes','Sticky Paws']);
   await page.getByRole('button',{name:/^Fast Swipes:/})[width<1100?'tap':'click']();
   await page.evaluate(()=>{const c=combat.state;c.khadroot.cast={spell:'Har Megiddo',phase:0,slots:[4,13],filled:[true,false],receipts:[{id:'enemy-four',rank:4}]};});
   // Re-render via a turn; retained receipt remains a legal theft choice.
   await page.getByRole('button',{name:'End turn',exact:true})[width<1100?'tap':'click']();
   await page.waitForTimeout(150);
   await page.getByRole('button',{name:'Choose Mochi abilities',exact:true})[width<1100?'tap':'click']();
   await page.getByRole('button',{name:/^Sticky Paws:/})[width<1100?'tap':'click']();
   await page.getByRole('button',{name:'Steal 4 from Har Megiddo',exact:true})[width<1100?'tap':'click']();
   assert.equal(await page.evaluate(()=>combat.state.hand.some(c=>c.id==='enemy-four')),true);
   await page.getByRole('button',{name:'Choose Hero abilities from HP plate',exact:true}).click();
   assert.equal(await page.locator('.woods-hb-fan').isVisible(),true);await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.evaluate(()=>{const c=combat.state;c.kin.hero.channel={ability:'meteo',live:[{id:'goal',rank:0}],goals:[2],met:[false],cleared:0,total:2};c.board[0][c.board[0].length-1]={id:'phase-two',rank:2};});
   await page.getByRole('button',{name:'Choose Hero abilities from HP plate',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.locator('.woods-hb-column').first().locator('button').last().click();
   assert.equal(await page.locator('[data-phase-key="hero-meteo-0"][data-filled].woods-hb-phase-fill').count(),1);
   assert.equal(await page.evaluate(()=>combat.diagnostics.cameraCue),'hero');
   const bounds=await page.locator('.woods-hb-active-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
   for(const r of bounds){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width&&r.y+r.h<=height);assert.ok(Math.abs(r.w/r.h-63/88)<.01);}
   assert.deepEqual(errors,[]);
   await page.screenshot({path:'artifacts/woods-actor-hand/'+width+'x'+height+'.png'});
   console.log(width+'x'+height+': actor hands, hidden supply, Dig, Sticky Paws and active card bounds passed');
   await page.close();
  }
 }finally{clearTimeout(timeout);await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
