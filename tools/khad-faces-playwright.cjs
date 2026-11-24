const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5179/proto.html?khad-combat');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-khad-face]')?.dataset.khadFace??'null')?.count===8);
  fs.mkdirSync('artifacts/khad-faces',{recursive:true});
  await page.waitForTimeout(500);await page.screenshot({path:'artifacts/khad-faces/eight.png'});
  await page.getByRole('button',{name:'Smooth 3D',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-khad-face]')?.dataset.khadFace==='null');
  await page.screenshot({path:'artifacts/khad-faces/smooth.png'});
  await page.getByRole('button',{name:'Sprite faces',exact:true}).click();
  for(const n of [4,16,8]){await page.getByRole('combobox',{name:'Orbit faces'}).selectOption(String(n));await page.waitForFunction(n=>JSON.parse(document.querySelector('[data-khad-face]').dataset.khadFace)?.count===n,n);}
  const arena=page.locator('.combat-demo__arena'),bounds=await arena.boundingBox();
  const faces=new Set();
  await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.45);await page.mouse.down();
  for(let i=0;i<12;i++){await page.mouse.move(bounds.x+bounds.width*.55-i*25,bounds.y+bounds.height*.45);await page.waitForTimeout(50);faces.add(JSON.parse(await page.locator('[data-khad-face]').getAttribute('data-khad-face')).sector);}
  await page.mouse.up();assert.ok(faces.size>1,'orbit switches discrete faces');
  await page.getByRole('button',{name:'Thorn Whip · 12 damage',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-khad-face]').dataset.khadFace)?.whipWorldSpace===true);
  await page.getByRole('button',{name:'Pause · Space',exact:true}).click();
  const clock=await page.locator('[data-combat-time]').getAttribute('data-combat-time');await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-combat-time]').getAttribute('data-combat-time'),clock);
  await page.getByRole('button',{name:'Resume · Space',exact:true}).click();
  await page.waitForTimeout(750);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/khad-faces/mobile.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForSelector('[data-khad-face]');
  await page.getByRole('button',{name:'Thorn Whip · 12 damage',exact:true}).click();
  assert.equal(JSON.parse(await page.locator('[data-khad-face]').getAttribute('data-khad-face')).whipWorldSpace,false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({errors,orbitSectors:[...faces],pause:'passed',modes:'passed',reducedMotion:'passed'}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
