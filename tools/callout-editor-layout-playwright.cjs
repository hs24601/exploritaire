const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{const b=await chromium.launch({headless:true});try{for(const [width,height] of [[1912,914],[1280,720],[390,844],[844,390]]){
const p=await b.newPage({viewport:{width,height},deviceScaleFactor:3,reducedMotion:'reduce'});await p.goto((process.env.CALLOUT_PREVIEW_URL||'http://localhost:5186')+'/tools/callout-editor-preview.html',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Edit callout',exact:true}).click();
assert.deepEqual(await findLayoutDefects(p,'.callout-editor',{parts:'header, fieldset, textarea, .callout-effects, small, h3, .callout-editor-preview, footer'}),[]);
const t=p.getByLabel('Callout text');await t.focus();await t.press('Control+Home');for(let i=0;i<10;i++)await t.press('ArrowRight');for(let i=0;i<5;i++)await t.press('Shift+ArrowRight');
for(const effect of ['Emphasis','Shake','Wave','Glow','Whisper','Rainbow']){await p.getByRole('button',{name:effect,exact:true}).click();const fx=p.locator('.callout-editor-preview .callout-fx');assert.equal(await fx.innerText(),'light');assert.equal(await fx.evaluate(el=>getComputedStyle(el).animationName),'none');}
await p.getByLabel('Effect color',{exact:true}).fill('#33aaff');
await p.getByLabel('Effect potency',{exact:true}).fill('1.65');
assert.equal(await p.locator('.callout-editor-preview .callout-fx').evaluate(el=>el.style.getPropertyValue('--fx-color')),'#33aaff');
assert.equal(await p.locator('.callout-editor-preview .callout-fx').evaluate(el=>el.style.getPropertyValue('--fx-potency')),'1.65');
await p.getByRole('button',{name:'Save callout',exact:true}).click();await p.reload();await p.getByRole('button',{name:'Edit callout',exact:true}).click();
await t.focus();await t.press('Control+Home');for(let i=0;i<10;i++)await t.press('ArrowRight');for(let i=0;i<5;i++)await t.press('Shift+ArrowRight');
assert.equal(await p.getByLabel('Effect color',{exact:true}).inputValue(),'#33aaff');assert.equal(await p.getByLabel('Effect potency',{exact:true}).inputValue(),'1.65');
await p.getByRole('button',{name:'Clear effect',exact:true}).click();assert.equal(await p.locator('.callout-editor-preview .callout-fx').count(),0);
await p.locator('.callout-editor').screenshot({path:`artifacts/callout-editor-${width}-3x.png`});await p.close();console.log('PASS layout, selected word effects, clear, reduced motion',width,height);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
