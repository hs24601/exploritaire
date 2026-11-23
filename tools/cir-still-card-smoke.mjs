import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5215','--strictPort'],{windowsHide:true});
let browser;
try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),20000);server.stdout.on('data',d=>{if(d.toString().includes('Local:')){clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error(`Vite exited ${code}`));});});
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('artifacts/cir-still-card-v4',{recursive:true});
  for(const [width,height] of [[1977,914],[390,844]]){
    await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5215/proto.html?combatsbx&scenario=1002');
    await page.locator('[data-battle-actor="hero"]').click();
    const card=page.locator('[data-skill="draft-cir"]');await card.waitFor();
    assert.equal(await page.locator('.ability-fan [data-skill]').count(),6);
    assert.equal(await page.locator('[data-skill="ux-ember"]').count(),0);
    assert.equal(await card.locator('.trading-card__header h2').textContent(),'Cir');
    assert.equal(await card.locator('.trading-card__description').textContent(),'TBD');
    assert.equal(await card.locator('.ability-fan__cost-value').textContent(),'0');
    const art=card.locator('.ability-keru-art__subject');await art.evaluate(img=>img.decode());
    assert.ok((await art.getAttribute('src')).endsWith('cir-phoenix-gather-still-v5.png'));
    const hero=page.locator('[data-foundation-focus="hero"]'),before=await hero.innerText();
    await card.click();assert.equal(await hero.innerText(),before);assert.equal(await page.locator('[data-skill-target]').count(),0);
    await page.getByRole('dialog',{name:'Cir jumbo card',exact:true}).waitFor();await page.keyboard.press('Escape');
    await page.screenshot({path:`artifacts/cir-still-card-v4/${width}.png`});
    await card.screenshot({path:`artifacts/cir-still-card-v4/card-${width}.png`});
    await page.keyboard.press('Escape');assert.equal(await page.locator('.ability-fan-overlay').count(),0);
  }
  await page.goto('http://127.0.0.1:5215/proto.html?combatsbx&scenario=1001');await page.locator('[data-battle-actor="hero"]').click();
  assert.equal(await page.locator('[data-skill="draft-cir"]').count(),0,'1002-only draft');assert.deepEqual(errors,[]);
  console.log('Passed: six-card S1002 hand, Cir title/TBD/0 AP, selected still loads, no Ember Step, no undefined cast/AP changes, desktop/mobile, Escape, scoped to 1002, no page errors.');
}finally{if(browser)await browser.close();server.kill();}
