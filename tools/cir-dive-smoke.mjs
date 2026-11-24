import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/cir-dive-v1';fs.mkdirSync(`${out}/frames`,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5214','--strictPort'],{windowsHide:true});
let browser;
try {
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timeout);resolve();}});server.on('exit',code=>{clearTimeout(timeout);reject(Error(`Vite exited ${code}`));});});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5214/proto.html?cirsbx');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Pose 5: Meteor',exact:true}).click();
  const stage=page.locator('.cir-dive-lab__stage');assert.equal(await stage.getAttribute('data-frame'),'4');
  const before=await page.locator('.cir-dive-lab__flight').getAttribute('style');await page.waitForTimeout(200);
  assert.equal(await page.locator('.cir-dive-lab__flight').getAttribute('style'),before,'Pause freezes path and pose');
  await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
  await page.getByRole('button',{name:'Replay dive'}).click();await page.waitForTimeout(430);
  assert.notEqual(await page.locator('.cir-dive-lab__flight').getAttribute('style'),before,'Replay advances');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const seek=async value=>{
    await page.getByRole('slider',{name:'Dive progress'}).evaluate((el,value)=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));
      el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    },value);
  };
  for(let i=0;i<48;i++){await seek(i*2200/48);await stage.screenshot({path:`${out}/frames/${String(i).padStart(2,'0')}.png`});}
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Pose 5: Meteor'}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile fits');
  await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  assert.equal(await stage.getAttribute('data-frame'),'4');
  assert.equal(await stage.getAttribute('data-playing'),'false');
  assert.equal(await page.getByRole('button',{name:'Play',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Pose 2: Fold'}).click();assert.equal(await stage.getAttribute('data-frame'),'1','Reduced-motion manual pose review works');
  await page.getByRole('checkbox',{name:'Night forest'}).uncheck();assert.equal(await page.locator('.cir-dive-lab__sky').count(),0);
  assert.deepEqual(errors,[]);console.log('Passed: authored poses, playback, pause/replay, seek, mobile fit, reduced-motion still/manual poses, background toggle, no page errors.');
} finally {if(browser)await browser.close();server.kill();}
