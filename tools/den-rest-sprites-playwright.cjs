const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {findLayoutDefects} = require('./lib/layout-check.cjs');
(async()=>{
  const browser = await chromium.launch();
  fs.mkdirSync('artifacts/den-rest-sprites',{recursive:true});
  try {
    for (const width of [1280,1912]) for (const touch of [false,true]) {
      const page = await browser.newPage({viewport:{width,height:width===1280?720:914},hasTouch:touch,deviceScaleFactor:3,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const origin=process.env.PROTO_URL || 'http://127.0.0.1:5178/proto.html';
      await page.goto(origin);
      const hero=page.locator('[data-board-piece="actor"][data-actor-id="hero"]');
      await hero.waitFor();
      assert.equal(await hero.getAttribute('data-den-rest-art'),'hero','Awake Day 1 Hero uses den artwork');
      assert.equal(await page.locator('[aria-label="Empty tableau"]').count(),1,'Den pose does not start bedtime gameplay');
      assert.equal(await page.locator('[data-den-roof]').count(),1,'Awake den pose retains rocky roof');
      await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
      await page.waitForTimeout(600);
      assert.ok((await hero.locator('.proto-sprite-standee__art').evaluate(el=>el.style.backgroundImage)).includes('hero-sleeping.png'));
      assert.equal(Number(await hero.getAttribute('data-actor-heading')),Math.PI);
      await page.screenshot({path:`artifacts/den-rest-sprites/day-one-${width}-${touch?'touch':'mouse'}-3x.png`});
      await page.goto(process.env.DEN_PREVIEW_URL || new URL('/tools/den-rest-preview.html',origin).href);
      await page.locator('[data-den-rest-art]').first().waitFor();
      for (const mode of ['tabletop','immersive']) {
        if(mode==='immersive') await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
        await page.waitForTimeout(600);
        assert.equal(await page.locator('.proto-map').getAttribute('data-camera-view'),mode);
        const dirt = await page.locator('[data-den-ground]').evaluate(async image => {
          await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]<240||pixels[i]<=pixels[i+1]||pixels[i+1]<=pixels[i+2])return false;
          return true;
        });
        assert.ok(dirt,'Opaque brown earth covers the full den ground in '+mode);
        for(const scene of ['mochi','pair','hero']) {
          const control=page.getByRole('button',{name:scene,exact:true});
          if(touch)await control.tap();else await control.click();
          await page.waitForTimeout(400);
          const art=scene==='pair'?'hero-mochi':scene;
          assert.equal(await page.locator('[data-den-rest-art]').first().getAttribute('data-den-rest-art'),art);
          if(mode==='tabletop')assert.equal(await page.locator('[data-board-piece="actor"] > img').count(),1,scene+' overhead silhouette');
          else assert.ok((await page.locator('[data-board-piece="actor"] .proto-sprite-standee__art').first().evaluate(el=>el.style.backgroundImage)).includes(art+'-sleeping.png'));
          assert.equal(await page.locator('[data-board-piece="actor"][data-shared-companion]').count(),scene==='pair'?1:0);
          if(scene==='pair') {
            await page.locator('[data-board-piece="actor"][data-actor-id="mochi"]').focus();await page.keyboard.press('Enter');
            assert.equal(await page.locator('#inspected').textContent(),'mochi');
          }
          const failed = await page.locator('[data-board-piece="actor"] img').evaluateAll(images=>images.filter(image=>!image.complete||image.naturalWidth===0).length);
          assert.equal(failed,0);
          if (mode === 'tabletop') for (let turn = 0; turn < 8; turn++) {
            const clearance = await page.evaluate(() => {
              const title = document.querySelector('[data-den-title] .proto-tile-title__line').getBoundingClientRect();
              return [...document.querySelectorAll('[data-board-piece="actor"] > img')].every(image => {
                const body = image.getBoundingClientRect();
                return title.top >= body.bottom + 1;
              });
            });
            assert.ok(clearance, scene + ' title clears sprites at turn ' + turn);
            const turnControl = page.getByRole('button',{name:'Turn table right',exact:true});
            if(touch)await turnControl.tap();else await turnControl.click();
            await page.waitForTimeout(150);
          }
          assert.deepEqual(await findLayoutDefects(page,'[data-den-title]',{parts:'.proto-tile-title__line',minFontSize:6}),[]);
          // Resolved foundation occupancy and bedtime state share the same den art.
          for(const name of ['Table','Awake','Foundation','Bedtime']) {
            const control=page.getByRole('button',{name,exact:true});
            if(touch)await control.tap();else await control.click();
            assert.equal(await page.locator('[data-den-rest-art]').first().getAttribute('data-den-rest-art'),art,scene+' after '+name);
            assert.equal(await page.locator('[data-board-piece="actor"]').first().getAttribute('data-grid-reference'),'table:0,2');
          }
          await page.screenshot({path:`artifacts/den-rest-sprites/${scene}-${mode}-${width}-${touch?'touch':'mouse'}-3x.png`});
        }
      }
      assert.deepEqual(errors,[]);
      await page.close();console.log('PASS den rest OTT/immersion',touch?'touch':'mouse');
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
