const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const out='artifacts/tactical-combat';
(async()=>{const b=await chromium.launch({headless:true});try{for(const [width,height] of [[1280,720],[1912,914],[390,844],[844,390]]){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:3});await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');await p.getByRole('button',{name:'Bite',exact:true}).click();
 const parts='.trading-card__header,.trading-card__header h2,.trading-card__badge,.trading-card__body,.trading-card__description,.trading-card__footer';
 assert.deepEqual(await findLayoutDefects(p,'.ability-card',{parts}),[]);
 await p.locator('.ability-card').screenshot({path:out+'/'+width+'-compact-3x.png'});
 await p.locator('.ability-card').click();await p.locator('.details-card-viewer--jumbo').waitFor();
 assert.deepEqual(await findLayoutDefects(p,'.details-card-viewer--jumbo',{parts:'.trading-card__header,.trading-card__header h2,.trading-card__body,.trading-card__full-description,.trading-card__full-description h3,.trading-card__full-description p,.trading-card__footer'}),[]);
 await p.locator('.details-card-viewer--jumbo').screenshot({path:out+'/'+width+'-jumbo-3x.png'});console.log(width,height,'ability layout passed');await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
