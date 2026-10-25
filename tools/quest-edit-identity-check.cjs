const {chromium}=require('playwright');const assert=require('node:assert/strict');(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{for(const reducedMotion of ['no-preference','reduce']){const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion});await p.route('**/__quest-cards/save',async route=>{const request=route.request().postDataJSON();assert.equal(request.id,'tutorial:day01.tutorial:navigate-den');await route.fulfill({json:{[request.id]:request.draft}});});await p.goto('http://127.0.0.1:5178/proto.html');await p.waitForSelector('.proto-callout-next',{timeout:60000});await p.waitForTimeout(1000); for(let i=0;i<8 && await p.locator('.proto-callout-next').count();i++){await p.locator('.proto-callout-next').click();await p.waitForTimeout(300);}await p.waitForSelector('.proto-map[data-opening-cards="complete"]',{timeout:30000});await p.waitForTimeout(1000);assert.equal(await p.locator('[data-map-actor-card="hero"]').isVisible(),false,'Hero stays hidden before pickup');await p.screenshot({path:`artifacts/opening-quest-${reducedMotion}.png`});console.log(await p.locator('[data-found-quest="navigate-den"]').boundingBox());await p.locator('[data-found-quest="navigate-den"]').click({timeout:5000});
await p.locator('.card-jumbo .quest-card').waitFor();
await p.waitForSelector('.card-jumbo__face[data-quest-transit]');
assert.equal(await p.locator('.card-jumbo__face[data-quest-shimmer]').count(),0,'No shimmer during arrival');
await p.waitForSelector('.card-jumbo__face[data-quest-shimmer]');
assert.equal(await p.locator('.card-jumbo__face[data-quest-transit]').count(),0,'Shimmer starts after travel');
await p.locator('.card-jumbo [aria-label="Edit quest card"]').click();
console.log(await p.locator('.callout-editor').last().innerText());await p.locator('.callout-editor textarea').last().fill('Edited in jumbo: guide Hero to the berry patch.');
await p.locator('.callout-editor').last().getByRole('button',{name:'Save to disk'}).click();
await p.locator('.callout-editor').waitFor({state:'hidden'});
await p.waitForFunction(()=>document.querySelector('.card-jumbo .quest-card')?.innerText.includes('Edited in jumbo'));assert.match(await p.locator('.card-jumbo .quest-card').innerText(),/Edited in jumbo/);
assert.equal(await p.locator('[data-map-actor-card="hero"]').isVisible(),false,'Hero stays hidden while reading jumbo');
assert.equal(await p.locator('[data-found-quest="navigate-den"][data-picking-up]').count(),0,'First click does not dock');
await p.screenshot({path:`artifacts/opening-quest-jumbo-${reducedMotion}.png`});
await p.locator('.card-jumbo__close').click();
await p.locator('.card-jumbo').waitFor({state:'hidden'});
assert.equal(await p.locator('[data-found-quest="navigate-den"]').isVisible(),true,'Closing jumbo retains the ground quest');
await p.locator('[data-found-quest="navigate-den"]').focus();
await p.keyboard.press('Enter');
await p.locator('.card-jumbo .quest-card').click();await p.waitForFunction(()=>!document.querySelector('.proto-map')?.hasAttribute('data-opening-quest'));await p.waitForTimeout(1000);assert.equal(await p.locator('[data-found-quest="navigate-den"]').count(),0);assert.equal(await p.locator('[data-map-actor-card="hero"]').isVisible(),true);assert.equal(await p.locator('.actor-drag-preview:not(.tableau-drag-preview)').isVisible(),true);assert.match(await p.locator('.quest-subtask-deck__active .quest-card').innerText(),/Edited in jumbo/);console.log('jumbo edit retained in dock',reducedMotion);await p.screenshot({path:`artifacts/opening-quest-docked-${reducedMotion}.png`});await p.locator('.quest-subtask-deck__active .quest-card').click();
await p.waitForSelector('.quest-subtask-deck__active[data-quest-shimmer]');
assert.equal(await p.locator('.quest-subtask-deck[data-map-jumbo="true"]').count(),1,'Dock expansion lands in jumbo with shimmer');
await p.locator('.quest-subtask-deck__active .quest-card').click();
await p.waitForFunction(()=>!document.querySelector('.quest-subtask-deck__active')?.hasAttribute('data-quest-transit'));
assert.equal(await p.locator('.quest-subtask-deck[data-map-jumbo="true"]').count(),0);
console.log('dock spin and jumbo shimmer passed',reducedMotion);
await p.close();}}finally{await b.close()}})();


