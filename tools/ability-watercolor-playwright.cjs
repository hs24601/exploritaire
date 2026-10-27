const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const out=`artifacts/ability-watercolor-${process.env.ABILITY_ART_VERSION||'v1'}`;fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const [width,height,touch] of [[1280,720,false],[1912,914,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,deviceScaleFactor:3});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('exploritaire.artStyle','paint'));
  await page.goto('http://127.0.0.1:5197/proto.html?combatdemo');
  const bite=page.getByRole('button',{name:'Bite',exact:true});if(touch)await bite.tap();else await bite.click();
  await page.locator('.ability-card [data-ability-art="Bite"] img').evaluate(async image=>image.decode());
  const parts='.trading-card__header,.trading-card__header h2,.trading-card__badge,.trading-card__body,.trading-card__description,.trading-card__footer';
  assert.deepEqual(await findLayoutDefects(page,'.ability-card',{parts}),[]);
  await page.locator('.ability-card').screenshot({path:`${out}/bite-${width}-compact-3x.png`});
  if(touch)await page.locator('.ability-card').tap();else await page.locator('.ability-card').click();
  await page.locator('.details-card-viewer--jumbo [data-ability-art="Bite"] img').evaluate(async image=>image.decode());
  await page.locator('.details-card-viewer--jumbo').screenshot({path:`${out}/bite-${width}-jumbo-3x.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:1100},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:5197/proto.html');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {TradingCard}=await import('/src/proto/components/TradingCard.tsx');
  const {AbilityArtwork}=await import('/src/proto/components/AbilityArtwork.tsx');
  const {availableMovesFor}=await import('/src/proto/rules/battleAbilities.ts');
  const {ABILITY_CARD_ART}=await import('/src/proto/art/abilityCardArt.ts');
  const {setArtStyle}=await import('/src/proto/artStyle.ts');setArtStyle('paint');
  const moves=[...availableMovesFor('hero'),...availableMovesFor('mochi')];
  if(moves.some(move=>!ABILITY_CARD_ART[move.name])||moves.length!==Object.keys(ABILITY_CARD_ART).length)throw Error('Incomplete ability artwork catalogue');
  document.getElementById('root').style.display='none';
  const fixture=document.createElement('div');fixture.id='ability-art-gallery';fixture.style.cssText='position:relative;display:grid;grid-template-columns:repeat(3,210px);gap:18px;width:max-content;padding:24px;background:#102a27;';document.body.append(fixture);
  ReactDOM.createRoot(fixture).render(React.createElement(React.Fragment,null,...moves.map(move=>React.createElement('div',{key:move.name,className:'ability-card',style:{position:'relative',width:210,height:294}},React.createElement(TradingCard,{id:'review-'+move.name,title:move.name,badge:move.cost+' AP',badgeLabel:'Action point cost',art:React.createElement(AbilityArtwork,{name:move.name,fallback:null}),description:move.description,footer:move.retrieval?'Retrieve a card':'Drag to target'})))));
 });
 await page.waitForFunction(()=>document.querySelectorAll('#ability-art-gallery img').length===9&&[...document.querySelectorAll('#ability-art-gallery img')].every(image=>image.complete&&image.naturalWidth));
 await page.locator('#ability-art-gallery').screenshot({path:out+'/all-nine-cards-2x.png'});
 console.log('All nine action paintings decode; combat compact/jumbo art and desktop layouts pass with mouse/touch.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
