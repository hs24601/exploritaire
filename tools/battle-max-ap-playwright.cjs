const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
fs.mkdirSync('artifacts/battle-max-ap',{recursive:true});
(async()=>{const b=await chromium.launch({headless:true});try{
 for(const [width,height,touch] of [[1912,914,false],[1280,720,false],[390,844,true]]){
  const p=await b.newPage({viewport:{width,height},hasTouch:touch});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:5178/proto.html?combatdemo');const toggle=p.getByRole('checkbox',{name:'maxAP',exact:true});await toggle.waitFor();
  assert.equal(await toggle.isChecked(),false);assert.equal(await p.locator('.battle-move:disabled').count(),0);
  if(touch)await p.getByText('maxAP',{exact:true}).tap();else{await toggle.focus();await p.keyboard.press('Enter');}
  assert.equal(await toggle.isChecked(),true);assert.equal(await p.locator('.battle-move:disabled').count(),0);assert.equal(await p.locator('.battle-moves > strong').allTextContents().then(a=>a.every(t=>t.includes('∞'))),true);
  for(let n=0;n<3;n++){await p.getByRole('button',{name:'Scratch',exact:true}).click();await p.locator('[data-battle-target="dark-slime"]').click();}
  assert.equal(await p.locator('[data-battle-slot="mochi"] .proto-foundation-count-token').textContent(),'▤0');
  await p.getByRole('button',{name:'Vice Grip',exact:true}).click();await p.getByRole('spinbutton',{name:'AP to commit to Vice Grip'}).fill('100');assert.equal(await p.getByRole('spinbutton',{name:'AP to commit to Vice Grip'}).getAttribute('max'),null);
  await toggle.uncheck();assert.equal(await p.locator('.ability-card-popover').count(),0);assert.equal(await p.locator('.battle-move:disabled').count(),0);assert.ok((await p.locator('.battle-moves > strong').allTextContents()).every(t=>t==='0 AP banked'));
  await toggle.check();await p.getByRole('button',{name:'Restart',exact:true}).click();assert.equal(await toggle.isChecked(),true);
  await p.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('hungry');assert.equal(await toggle.isChecked(),true);assert.equal(await p.locator('.battle-move:disabled').count(),0);
  await p.getByRole('button',{name:'Remove Mochi',exact:true}).click();await p.getByRole('button',{name:'Add Mochi',exact:true}).click();assert.equal(await p.locator('.battle-move:disabled').count(),0);
  await p.screenshot({path:'artifacts/battle-max-ap/'+width+'.png'});assert.deepEqual(errors,[]);console.log(width,'passed');await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
