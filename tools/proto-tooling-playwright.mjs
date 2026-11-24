import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
try {
 for(const [width,height,touch] of [[1440,1000,false],[390,844,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5178/tooling.html');const editor=page.getByRole('complementary',{name:'Developer tile editor'});await editor.waitFor({timeout:120000});
  if(await page.getByRole('button',{name:'Kin',exact:true}).count())throw Error('Legacy Kin editor exposed');
  await editor.getByLabel('Choose tile',{exact:true}).selectOption('curious-sapling');
  await editor.getByLabel('Title',{exact:true}).fill('Proto tooling verification');
  await editor.getByRole('tab',{name:'Travel',exact:true}).click();
  await editor.getByLabel('STA per orthogonal cell override',{exact:true}).fill('2.5');
  await editor.getByLabel('Travel cards per cell override',{exact:true}).fill('13');
  const download=page.waitForEvent('download');await editor.getByRole('button',{name:'Export tile JSON',exact:true}).click();const file=await download;
  const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));const tile=data.tiles.find(t=>t.id==='curious-sapling');if(tile.title!=='Proto tooling verification'||tile.traversalDifficulty!==2.5||tile.travelCards!==13||tile.tableau)throw Error('Wrong Proto authored data exported');
  await editor.getByRole('button',{name:'Apply tiles to playtest',exact:true}).click();
  await editor.getByRole('tab',{name:'Resources',exact:true}).click();await editor.getByText(/Woods use these resource-density/).waitFor();
  await editor.getByLabel('Gathering deal size',{exact:true}).fill('17');await editor.getByLabel('Resource density',{exact:true}).fill('0.5');
  await editor.locator('[data-proto-deal-summary]').filter({hasText:'17 tableau cards'}).filter({hasText:'9 resource cards'}).waitFor();
  await page.screenshot({path:'artifacts/proto-generated-deal-'+width+'.png',fullPage:true});
  await editor.getByRole('button',{name:'Update tile / move',exact:true}).click();
  await editor.getByRole('button',{name:'Apply tiles to playtest',exact:true}).click();
  await editor.getByRole('tab',{name:'Tableaus',exact:true}).click();
  await editor.getByLabel('Selected terrain travel layout',{exact:true}).selectOption('berry-cluster');
  await editor.getByRole('button',{name:'Apply layouts to playtest',exact:true}).click();
  await editor.getByRole('button',{name:'Test',exact:true}).click();
  for(const id of ['c3-front','c2','c3-back','c4','c5','c6']){const b=editor.getByRole('button',{name:new RegExp('Card '+id+',')});if(touch)await b.tap();else await b.click();}
  await editor.getByText('Layout cleared.',{exact:true}).waitFor();
  await editor.getByRole('tab',{name:'Tiles',exact:true}).click();await editor.getByRole('tab',{name:'Identity',exact:true}).click();
  await page.screenshot({path:`artifacts/proto-tooling-${width}.png`,fullPage:true});
  const map=await page.locator('.proto-map').first().boundingBox(),panel=await editor.boundingBox();if(!map||!panel||map.width<100||map.height<100)throw Error('Missing real Proto map preview');
  const overlaps=map.x<panel.x+panel.width&&map.x+map.width>panel.x+3&&map.y<panel.y+panel.height&&map.y+map.height>panel.y+3;if(overlaps)throw Error('Map and workspace overlap');
  await editor.getByRole('button',{name:'Close · playtest applied data',exact:true}).click();await editor.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Edit tiles',exact:true}).click();await page.getByLabel('Choose tile',{exact:true}).selectOption('curious-sapling');await page.getByRole('tab',{name:'Identity',exact:true}).click();if(await page.getByLabel('Title',{exact:true}).inputValue()!=='Proto tooling verification')throw Error('Applied session changes lost');
  results.push({width,errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),tileCount:data.tiles.length,map:{width:map.width,height:map.height}});if(errors.length)throw Error(errors.join('\n'));
  await context.close();
 }
 console.log(JSON.stringify(results));
}finally{await browser.close();}
