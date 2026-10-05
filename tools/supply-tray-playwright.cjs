const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Supplies tray: left column matching the quest tray, a row per resource, stow and restore.
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await b.newPage({viewport:{width:1600,height:900}});await p.goto('http://localhost:5179/proto.html');
  const supply=p.locator('.supply-tray');const quest=p.locator('.quest-tray');await supply.waitFor();
  const [s,q,map]=await Promise.all([supply.boundingBox(),quest.boundingBox(),p.locator('.proto-map').boundingBox()]);
  assert.ok(Math.abs(s.width-q.width)<2,`widths ${s.width} vs ${q.width}`);assert.ok(Math.abs(s.height-q.height)<2,`heights ${s.height} vs ${q.height}`);
  assert.ok(s.x+s.width<=map.x,'supplies sit left of the table');
  assert.equal(await p.locator('.supply-row').count(),3);assert.equal(await p.getByRole('button',{name:/Draw/}).count(),0);
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-desktop.png'});
  await supply.getByRole('button',{name:'Stow tray'}).click();await p.waitForTimeout(300);
  assert.ok((await supply.boundingBox()).x+s.width<=0,'stowed off the left edge');assert.equal(await supply.getAttribute('inert'),'');
  assert.ok((await p.locator('.proto-map').boundingBox()).width>map.width+100,'table reclaims the column');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-stowed.png'});
  await p.getByRole('button',{name:'Show supplies tray'}).click();await p.waitForTimeout(300);assert.equal(await supply.getAttribute('data-open'),'true');
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Supplies',exact:true}).click();
  assert.ok(await supply.isVisible());assert.ok(!(await p.locator('.proto-map').isVisible()));
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-mobile.png'});
  await supply.getByRole('button',{name:'Stow tray'}).click();await p.waitForTimeout(300);
  assert.equal(await p.getByRole('button',{name:'Table',exact:true}).getAttribute('aria-pressed'),'true');
  console.log('Supplies tray matches the quest tray, tracks resources, stows and restores on desktop and mobile.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
