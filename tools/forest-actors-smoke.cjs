const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Users/ericm/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(process.env.FOREST_LAB_URL||'http://127.0.0.1:5178/tools/live-paint-lab.html');await page.waitForFunction(()=>document.querySelector('canvas').dataset.ready==='true');
assert.equal(await page.locator('canvas').getAttribute('data-relief-props'),'hero,slime');fs.mkdirSync('output/forest-actors',{recursive:true});await page.screenshot({path:'output/forest-actors/start.png'});
await page.keyboard.down('d');await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.actorTransitions)>0,{timeout:10000});await page.keyboard.up('d');await page.screenshot({path:'output/forest-actors/transition.png'});
await page.waitForFunction(()=>document.querySelector('canvas').dataset.actorTransitions==='0');
await page.locator('#flight').click();await page.waitForTimeout(1300);await page.screenshot({path:'output/forest-actors/flight.png'});assert.deepEqual(errors,[]);console.log('PASS Hero/slime load, camera-dependent sprite transition, phase completion, flight, no WebGL errors');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
