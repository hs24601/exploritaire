const {chromium}=require('playwright');const assert=require('node:assert/strict');
// Supplies tray: slim left column of icon + count tokens, details on tap, stow and restore.
(async()=>{const b=await chromium.launch({headless:true});try{
  const p=await b.newPage({viewport:{width:1600,height:900}});await p.goto('http://localhost:5178/proto.html');
  const supply=p.locator('.supply-tray');const quest=p.locator('.quest-tray');await supply.waitFor();
  const [s,q,map]=await Promise.all([supply.boundingBox(),quest.boundingBox(),p.locator('.proto-map').boundingBox()]);
  assert.ok(s.width<100,`slim width ${s.width}`);assert.ok(Math.abs(s.height-q.height)<2,`heights ${s.height} vs ${q.height}`);
  assert.ok(s.x+s.width<=map.x,'supplies sit left of the table');
  assert.equal(await p.locator('.supply-row').count(),3);assert.equal(await p.locator('.supply-row').first().innerText().then(t=>/Wood/.test(t)),false,'rows show no label');
  await p.locator('[data-supply="wood"]').click();const details=p.getByRole('dialog',{name:'Wood'});await details.waitFor();
  assert.match(await details.innerText(),/Make lumber/);const d=await details.boundingBox();assert.ok(d.x>=s.x+s.width-1,'details open beside the tray');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-details.png'});
  await p.keyboard.press('Escape');await details.waitFor({state:'detached'});
  await p.locator('[data-supply="berries"]').click();await p.locator('.proto-map').click({position:{x:400,y:400}});await p.getByRole('dialog').waitFor({state:'detached'});
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-desktop.png'});
  await supply.getByRole('button',{name:'Stow tray'}).click();await p.waitForTimeout(300);
  assert.ok((await supply.boundingBox()).x+s.width<=0,'stowed off the left edge');assert.equal(await supply.getAttribute('inert'),'');
  assert.ok((await p.locator('.proto-map').boundingBox()).width>map.width+40,'table reclaims the column');
  await p.getByRole('button',{name:'Show supplies tray'}).click();await p.waitForTimeout(300);assert.equal(await supply.getAttribute('data-open'),'true');
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Supplies',exact:true}).click();
  assert.ok(await supply.isVisible());assert.ok(!(await p.locator('.proto-map').isVisible()));
  await p.locator('[data-supply="herbs"]').click();const md=await p.getByRole('dialog').boundingBox();assert.ok(md.x>=0&&md.x+md.width<=390,'details fit the phone');
  if(process.env.SHOTS)await p.screenshot({path:process.env.SHOTS+'/supply-mobile.png'});
  await p.keyboard.press('Escape');
  await supply.getByRole('button',{name:'Stow tray'}).click();await p.waitForTimeout(300);
  assert.equal(await p.getByRole('button',{name:'Table',exact:true}).getAttribute('aria-pressed'),'true');
  console.log('Slim supplies tray shows icon and count, opens details on tap, stows and restores on desktop and mobile.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
