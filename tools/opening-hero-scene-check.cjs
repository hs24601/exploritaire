const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
for(const width of [1912,1280]){
 const page=await browser.newPage({viewport:{width,height:width===1912?914:720},reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:5178/proto.html');await page.getByRole('button',{name:'Scenario +',exact:true}).click();
 await page.getByLabel('Hero emotion',{exact:true}).selectOption('happy');await page.getByRole('button',{name:'Save Hero emotion',exact:true}).click();await page.reload();
 await page.getByRole('button',{name:'Scenario +',exact:true}).click();assert.equal(await page.getByLabel('Hero emotion',{exact:true}).inputValue(),'happy');
 await page.getByLabel('Hero emotion',{exact:true}).selectOption('joyful');await page.getByRole('button',{name:'Save Hero emotion',exact:true}).click();
 await page.getByRole('button',{name:'Visit nearby bush',exact:true}).click();await page.waitForFunction(()=>document.querySelector('canvas[data-actor-expression=joyful]'),null,{timeout:60000});
 await page.screenshot({path:`artifacts/opening-hero-scene-${width}.png`});assert.deepEqual(errors,[]);console.log(`PASS ${width}: Happy persistence, Joyful scene/travel`);await page.close();
}
const page=await browser.newPage({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('exploritaire.callouts.v1',JSON.stringify({'day01.opening':{text:'Legacy happy override.',marks:[],emoji:{actor:'hero',emotion:'happy'}}})));
await page.goto('http://localhost:5178/proto.html');await page.locator('[data-callout-id="day01.opening"] [data-hero-emoji=joyful]').waitFor({timeout:60000});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.callouts.v1'))['day01.opening'].emoji.emotion),'happy');
console.log('PASS legacy Happy callout displays preserved Joyful without modifying v1 data');await page.close();
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
