const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/3xgrid.html');await page.locator('.card').first().waitFor();assert.equal(await page.locator('.card').count(),52);
 await page.evaluate(async()=>{
  const {mountGridTableau}=await import('/src/book/gridTableau.js');const host=document.createElement('div');document.body.append(host);const root=host.attachShadow({mode:'open'});root.innerHTML='<div id="stage" style="width:900px;height:600px"><div id="board"></div></div>';
  let paused=false;const calls=[],grid=mountGridTableau({stage:root.querySelector('#stage'),board:root.querySelector('#board'),seed:1234,singleClickPick:true,paused:()=>paused,onCard:(card,kind)=>calls.push(kind)});
  const check=(v,m)=>{if(!v)throw Error(m);},pick=i=>root.querySelector(`[data-id="${grid.state.field[i]}"]`).dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  pick(0);check(grid.state.phase==='pick','boundary cannot become foundation');paused=true;pick(18);check(grid.state.phase==='pick','pause blocks pick');paused=false;
  const original=[...grid.state.field];pick(18);check(grid.state.found[0]===original[18],'chosen foundation');check(Object.keys(grid.state.slots).length===8,'eight neighbors');
  const slot=grid.state.slots.A1;check(slot.top===original[9],'neighbor identity');const vertical=slot.v[0],side=slot.s[0];
  const force=()=>{for(const s of Object.values(grid.state.slots))grid.cards[s.top].rank=7;grid.setFoundationRank(7);grid.cards[slot.top].rank=8;};
  force();check(grid.autoStep(),'legal play');check(slot.top===vertical&&slot.turn==='s','vertical backfill first');force();check(grid.autoStep(),'second legal play');check(slot.top===side&&slot.turn==='v','alternate side backfill');
  for(const s of Object.values(grid.state.slots))grid.cards[s.top].rank=7;grid.setFoundationRank(7);const stock=grid.state.stock.length;check(grid.autoStep(true),'draw stock when stuck');check(grid.state.stock.length===stock-1&&calls.includes('stock'),'stock decrements');
  paused=true;check(!grid.autoStep(true),'paused auto blocks');grid.dispose();host.remove();
 });
 await page.locator('.card.pickable').nth(7).click();await page.waitForFunction(()=>!document.querySelector('#foundSlot').hidden);assert.equal(await page.locator('.card[data-peek]').count()>0,true);
 assert.deepEqual(errors,[]);console.log('PASS: shared standalone grid selection, alternating refill, stock and pause.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

