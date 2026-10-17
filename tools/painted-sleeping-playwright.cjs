const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto(process.env.PROTO_URL);await page.keyboard.press('Escape');await page.keyboard.press('Space');
const hero=page.locator('[data-actor-id="hero"]');await hero.locator('img').waitFor();assert.match(await hero.locator('img').getAttribute('src'),/hero-sleeping-topdown-bobtail-v2.png/);assert.equal(await hero.locator('img').evaluate(e=>getComputedStyle(e).imageRendering),'auto');
await page.getByRole('button',{name:'Game settings',exact:true}).click();await page.getByLabel('Art style',{exact:true}).selectOption('pixel');assert.match(await hero.locator('img').getAttribute('src'),/actors\/hero-sleeping-topdown.png/);await page.getByLabel('Art style',{exact:true}).selectOption('paint');await page.keyboard.press('Escape');await page.screenshot({path:'artifacts/art-style/sleeping-overhead.png'});console.log('PASS overhead sleeping selection and smooth sampling');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
