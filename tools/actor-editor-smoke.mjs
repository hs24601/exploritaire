import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5201/proto.html?actorEditor&entity=felis',{waitUntil:'networkidle'});
 const names=['Hero','Banks','Mochi','Cir','Dem'];
 assert.deepEqual(await page.locator('nav button b').allTextContents(),names);
 assert.equal(await page.getByRole('textbox',{name:'Name',exact:true}).inputValue(),'Hero');
 assert.equal(await page.getByRole('button',{name:'Permanently delete actor',exact:true}).count(),0);
 for(const name of names) {
  await page.locator('nav button').filter({has:page.locator('b').filter({hasText:new RegExp('^'+name+'$')})}).click();
  await page.waitForTimeout(700);
  assert.equal(await page.getByRole('textbox',{name:'Name',exact:true}).inputValue(),name);
  assert.equal(await page.getByRole('alert').count(),0,name+' preview');
  assert.ok(await page.locator('.ae-thumbnails button').count()>0,name+' assets');
 }
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export JSON',exact:true}).click();
 const download=await downloadPromise;
 const catalog=JSON.parse(await fs.readFile(await download.path(),'utf8'));
 assert.deepEqual(catalog.map(actor=>actor.name),names);
 await page.reload({waitUntil:'networkidle'});
 assert.deepEqual(await page.locator('nav button b').allTextContents(),names);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth),false);
 assert.deepEqual(errors,[]);
 console.log('Passed: exactly Hero, Banks, Mochi, Cir and Dem; legacy links fall back to Hero; no delete control; five previews/assets; exact JSON export; reload; mobile fit.');
} finally {await browser.close();}
