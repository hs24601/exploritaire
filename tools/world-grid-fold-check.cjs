const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const timer=setTimeout(()=>browser.close(),150000);try{
 const page=await browser.newPage({viewport:{width:1432,height:734}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|THREE|WebGL/i.test(m.text()))errors.push(m.text());});
 const read=()=>page.evaluate(()=>({battle:__castle1111.woods.foundations,hero:__castle1111.hero,platform:__castle1111.platform,camera:__castle1111.camera}));
 const click=async card=>{const p=await page.evaluate(async point=>{const THREE=await import('/node_modules/.vite/deps/three.js'),s=__castle1111.camera,c=new THREE.PerspectiveCamera(s.fov,s.aspect,.12,9000);c.position.fromArray(s.position);c.up.fromArray(s.up);c.lookAt(new THREE.Vector3(...s.target));c.updateMatrixWorld();const p=new THREE.Vector3(point[0],point[1]+.065,point[2]).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},card.center);await page.mouse.click(p.x,p.y);};
 await page.goto('http://127.0.0.1:5178/portals.html?combat&quality=low',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__castle1111?.mode==='play'&&__castle1111.woods?.foundations.grid.visible,null,{timeout:90000});
 await page.keyboard.press('o');const initial=await read(),cards=initial.battle.grid.cards;
 let chosen;const legal=(a,b)=>Math.abs(a-b)===1||Math.abs(a-b)===12;
 const choices=cards.filter(c=>c.pickable&&cards.some(n=>Math.abs(n.index%18-c.index%18)<=1&&Math.abs(Math.floor(n.index/18)-Math.floor(c.index/18))<=1&&n.index!==c.index&&legal(c.rank,n.rank))).sort((a,b)=>Math.hypot(a.center[0]-initial.hero.x,a.center[2]-initial.hero.z)-Math.hypot(b.center[0]-initial.hero.x,b.center[2]-initial.hero.z));
 for(const card of choices.slice(0,5)){await click(card);if((await read()).battle.grid.phase==='play'){chosen=card;break;}}
 assert(chosen,'select foundation through real canvas');
 await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='in',null,{timeout:7000});
 await page.screenshot({path:'output/world-grid-fold-in.png'});
 await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='folded',null,{timeout:5000});
 let settled=await read();assert.equal(settled.battle.grid.fold.faces,9);assert.equal(settled.battle.grid.fold.backfill,12);assert.equal(settled.battle.grid.cards.length,21);
 await page.screenshot({path:'output/world-grid-folded.png'});
 const hero={x:settled.hero.x,z:settled.hero.z},receipt=settled.battle.grid.cards.find(c=>c.active&&legal(c.rank,settled.battle.heroRank));assert(receipt);
 await click(receipt);await page.waitForFunction(rank=>__castle1111.woods.foundations.heroRank===rank,receipt.rank,{timeout:2500});
 await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='folded');
 settled=await read();assert.equal(settled.hero.x,hero.x);assert.equal(settled.hero.z,hero.z);
 await page.keyboard.press('o');assert(!(await read()).camera.overhead);
 await page.getByRole('button',{name:'Move',exact:true}).click();await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='field');assert((await read()).camera.overhead);
 await page.screenshot({path:'output/world-grid-unfolded.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='folded');assert.equal((await read()).battle.turn,'party');
 await page.getByRole('button',{name:'Move',exact:true}).click();await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='field');
 const opened=await read();let destination;
 for(const card of opened.battle.grid.cards.filter(c=>c.pickable&&c.index!==chosen.index).sort((a,b)=>Math.hypot(a.center[0]-hero.x,a.center[2]-hero.z)-Math.hypot(b.center[0]-hero.x,b.center[2]-hero.z)).slice(0,5)){await click(card);if((await read()).battle.grid.phase==='play'){destination=card;break;}}
 assert(destination,'Move chooses existing floor card');const moving=await read();assert.equal(moving.battle.turn,'enemy');assert.equal(moving.battle.heroRank,destination.rank);
 await page.waitForFunction(()=>__castle1111.woods.foundations.grid.fold.state==='folded'&&__castle1111.platform.grounded,null,{timeout:7000});
 const landed=await read();assert(Math.hypot(landed.hero.x-hero.x,landed.hero.z-hero.z)>.5);
 const move=await page.getByRole('button',{name:'Move',exact:true}).boundingBox(),auto=await page.locator('.world-rail-auto').boundingBox();assert(move.x+move.width<=auto.x);
 await page.setViewportSize({width:1280,height:720});assert.deepEqual(await findLayoutDefects(page,'.world-woods-rail-preview:not([hidden])',{parts:'.world-rail-preview-foundation,.world-rail-controls'}),[]);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:3,mobile:false});await page.screenshot({path:'output/world-grid-folded-3x.png',clip:{x:350,y:130,width:600,height:470}});
 await page.goto('http://127.0.0.1:5178/3xgrid.html');await page.locator('.card.pickable').first().waitFor();assert.equal(await page.locator('.card').count(),52);await page.locator('.card.pickable').nth(7).click();assert(await page.locator('.card[data-peek]').count()>0);
 assert.deepEqual(errors,[]);console.log('PASS: real Hero landing, animated fold, 9 faces + 12 backfill heads, ordinary receipt leaves Hero, Move OTT/unfold/cancel/new foundation/immediate enemy turn, button order, 1280 layout and standalone 3xgrid.');
}finally{clearTimeout(timer);await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
