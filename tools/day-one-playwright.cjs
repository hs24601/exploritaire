const {chromium}=require('playwright');
const assert=require('node:assert/strict');
let lastPage,browser; (async()=>{browser=await chromium.launch({headless:true});
for(const [width,height,touch] of (process.argv.includes('--smoke')?[[1440,900,false]]:[[390,844,true],[844,390,true],[1440,900,false]])){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});const page=await context.newPage();lastPage=page;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PROTO_URL||'http://localhost:5178/proto.html');await page.getByRole('button',{name:'Visit nearby bush',exact:true}).waitFor();
 const press=async l=>touch?l.tap():l.click();const panel=page.locator('.proto-day-panel');const openingStamina=(await panel.innerText()).match(/STA ([0-9.]+)/)[1];await page.screenshot({path:'artifacts/day01-'+width+'-opening.png'});
 assert.match(await panel.innerText(),/days are getting darker/);
 assert.equal(await page.locator('[data-sparse-bush="overhead"]').count(),1);
 await press(page.getByRole('button',{name:'Visit nearby bush',exact:true}));
 await press(page.getByRole('button',{name:'Auto-Solve',exact:true}).first());
 await page.waitForFunction(()=>[...document.querySelectorAll('.proto-day-panel button')].some(button=>button.textContent==='Visit denser patch'&&!button.disabled));
 assert.match(await panel.innerText(),/Mana 1/);await page.locator('.proto-callout').waitFor({state:'visible'});
 assert.match(await page.locator('.proto-callout').innerText(),/right outside my den/);
 assert.equal(await page.locator('[data-day-objective]').getAttribute('data-day-objective'),'day-one-berries');
 await page.screenshot({path:'artifacts/day01-'+width+'-sparse-callout.png'});
 console.log('PASS sparse bush reward and Hero callout',width);
 await press(page.getByRole('button',{name:'Visit denser patch',exact:true}));
 await press(page.locator('.travel-tableau').getByRole('button',{name:'Auto-Solve',exact:true}));
 await page.locator('.travel-tableau').waitFor({state:'detached',timeout:45000});
 await page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first().waitFor({timeout:10000});
 for(let i=0;i<6;i++){await press(page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first());await page.waitForTimeout(650);}
 assert.match(await panel.innerText(),/Mana 3/);assert.match(await panel.innerText(),/tomorrow’s light/);
 console.log('PASS dense patch adds exactly two berries',width);
 await press(page.getByRole('button',{name:'Return before dark',exact:true}));
 await press(page.locator('.travel-tableau').getByRole('button',{name:'Auto-Solve',exact:true}));
 await page.locator('.travel-tableau').waitFor({state:'detached',timeout:45000});
 await press(page.getByRole('button',{name:'Eat supper · 2 mana',exact:true}));assert.match(await panel.innerText(),/Mana 1/);assert.match(await panel.innerText(),/keep the last one/);
 await press(page.getByRole('button',{name:'Curl up · Zzz',exact:true}));await press(page.getByRole('button',{name:'Finish resting',exact:true}).first());assert.match(await panel.innerText(),/made it home/);
 await page.screenshot({path:'artifacts/day01-'+width+'-complete.png'});
 await press(page.getByRole('button',{name:'Begin Day 02',exact:true}));assert.match(await panel.innerText(),/Mana 1/);
 assert.match(await panel.innerText(),/Yesterday’s manaberry still lights my way/);
 assert.equal(await page.getByRole('button',{name:'Search darker woods',exact:true}).count(),0);
 if(!touch){
  await press(page.getByRole('button',{name:'Visit manaberry patch',exact:true}));
  await press(page.locator('.travel-tableau').getByRole('button',{name:'Auto-Solve',exact:true}));
  await page.locator('.travel-tableau').waitFor({state:'detached',timeout:45000});
  assert.match(await panel.innerText(),/Mana 1/);
  for(let i=0;i<3;i++){await press(page.locator('.proto-main-tableau .playing-card:not([data-buried]):not([data-gameplay-disabled="true"])').first());await page.waitForTimeout(650);}
  assert.match(await panel.innerText(),/Mana 2/);assert.match(await panel.innerText(),/Only one fresh manaberry/);
  assert.equal(await page.getByRole('button',{name:'Search darker woods',exact:true}).count(),1);
  console.log('PASS Day 02 preserves yesterday’s light and still requires the woods');
 }
 await page.getByLabel('Day scenario',{exact:true}).selectOption('sandbox');await page.getByLabel('Day scenario',{exact:true}).selectOption('day01');assert.ok((await panel.innerText()).includes('STA '+openingStamina));assert.match(await panel.innerText(),/Mana 0/);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),false);console.log('PASS',width,height,touch);await context.close();
}await browser.close();})().catch(async e=>{console.error(e);if(lastPage){console.log((await lastPage.locator('body').innerText()).slice(0,5000));await lastPage.screenshot({path:'artifacts/day01-failure.png'});}await browser?.close();process.exit(1)});
