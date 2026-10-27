const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
const URL = process.env.PROTO_URL || 'http://localhost:5178/proto.html?fx=low&atmosphere=off';
const OUTPUT = process.env.LABEL_OUTPUT || 'artifacts/camera-tile-labels';
require('node:fs').mkdirSync(OUTPUT, { recursive: true });
async function projection(page) {
  return page.evaluate(async () => {
    const { captureCameraShot } = await import((await (await fetch('/src/proto/components/CameraChoreographyTools.tsx')).text()).match(/from ["']([^"']*cameraDirector[^"']*)["']/)[1]);
    const shot = captureCameraShot(), view = document.querySelector('.proto-map-viewport').getBoundingClientRect();
    const yaw = shot.yaw * Math.PI / 180, pitch = (shot.tilted ? shot.pitch : 0) * Math.PI / 180;
    const p = Math.max(600, view.height * 1.6), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const aimY = shot.tilted ? (shot.framing ?? 0) * view.height : 0;
    const project = (anchor, local) => {
      const angle = local.facing * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const world = { x: anchor.x + local.x * c + local.y * s, y: anchor.y - local.x * s + local.y * c };
      const x = (world.x - shot.x) * shot.scale, y = (world.y - shot.y) * shot.scale;
      const rx = x * cy - y * sy, ry = x * sy + y * cy, d = p - ry * Math.sin(pitch);
      return { x: view.left + view.width / 2 + rx * p / d, y: view.top + view.height / 2 + ry * Math.cos(pitch) * p / d + aimY };
    };
    return [...document.querySelectorAll('[data-label-owner][data-label-shown]')].flatMap(owner => {
      const title = owner.querySelector('.proto-tile-title'), style = getComputedStyle(owner);
      if (shot.tilted && !owner.closest('[data-physical-world]')) return [{ error: 'Immersive ink escaped the physical depth scene' }];
      if (!title || getComputedStyle(title).visibility === 'hidden') return [{ error: 'visible pin has hidden ink' }];
      const anchor = {x:parseFloat(style.left), y:parseFloat(style.top)};
      return [...title.children].map(line => {
        const s = getComputedStyle(line), x = parseFloat(s.left), y = parseFloat(s.top), width = parseFloat(s.width) / Number(title.dataset.labelRaster || 1), height = parseFloat(s.height) / Number(title.dataset.labelRaster || 1);
        const corners = [-1, 1].flatMap(side => [0, height].map(dy => project(anchor,{x:x + side * width/2, y:y + dy, facing:Number(title.dataset.labelYaw)})));
        const expected = {left:Math.min(...corners.map(p=>p.x)), right:Math.max(...corners.map(p=>p.x)), top:Math.min(...corners.map(p=>p.y)), bottom:Math.max(...corners.map(p=>p.y))};
        const actual = line.getBoundingClientRect();
        return { title: title.getAttribute('aria-label'), text:line.textContent, error:Math.max(...Object.keys(expected).map(k=>Math.abs(expected[k]-actual[k]))), height:actual.height, width:actual.width };
      });
    });
  });
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    for(const [width,height] of [[1912,914],[1280,720]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,hasTouch:true,reducedMotion:'reduce'}), page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      assert.equal((await page.goto(URL)).status(),200);
      await page.locator('[data-den-title][data-label-pinned]').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(600);
      assert.equal(await page.locator('[data-label-pinned]').count(),2,'Only the two tutorial landmarks are pinned');
      assert.equal(await page.locator('.proto-projected-title').count(),0,'Tile labels must never become flat HUD copies');
      if(process.argv.includes('--controls')){
        const open=async()=>{
          await page.evaluate(()=>window.dispatchEvent(new Event('proto-camera-tools-open')));
          await page.getByLabel('Saved camera sequences',{exact:true}).selectOption('story.day01.opening');
          await page.locator('.camera-label-pins summary').click();
        };
        await open();
        assert.equal(await page.locator('.camera-label-pins input:checked').count(),2);
        assert.deepEqual(await findLayoutDefects(page,'.camera-label-pins',{parts:'summary, label',minFontSize:16}),[]);
        await page.locator('.camera-label-pins').screenshot({path:`${OUTPUT}/${width}-pin-controls-3x.png`});
        await page.locator('.camera-label-pins label').filter({hasText:"Hero's Den"}).getByRole('checkbox').click();
        await page.getByRole('button',{name:'Save sequence',exact:true}).click();
        await page.waitForTimeout(150);
        assert.equal(await page.locator('[data-label-pinned]').count(),1,'Saved scene selection updates immediately');
        await page.reload(); await page.locator('[data-den-title]').waitFor(); await page.waitForTimeout(200);
        assert.equal(await page.locator('[data-label-pinned]').count(),1,'Scene label selections survive reload');
        await open();
        assert.equal(await page.locator('.camera-label-pins input:checked').count(),1);
        await page.getByRole('button',{name:'Reset first pass',exact:true}).click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('[data-label-pinned]').count(),2,'Reset restores the source scene pins');
        await page.getByLabel('Saved camera sequences',{exact:true}).selectOption('story.day01.opening');
        await page.getByLabel('Pin tile label',{exact:true}).selectOption('woods-danger');
        await page.getByRole('button',{name:'Save sequence',exact:true}).click();
        await page.waitForTimeout(150);
        assert.equal(await page.locator('.camera-label-pins input:checked').count(),3);
        assert.equal(await page.locator('[data-biome-title="woods-danger"]').count(),0,'A pin never names concealed terrain');
        await page.getByRole('button',{name:'Reset first pass',exact:true}).click();
        assert.deepEqual(errors,[]);
        console.log('PASS',width,'label authoring layout, save, reload, reset and discovery gates');
        await context.close();continue;
      }
      // Dismiss dialogue through its normal reveal/advance actions.
      for(let i=0;i<4;i++){const bubble=page.locator('.proto-callout');if(await bubble.count())await bubble.first().click();}
      await page.waitForTimeout(500);
      await page.screenshot({path:`${OUTPUT}/${width}-opening-3x.png`});
      const setShot=async(yaw,pitch,scale=5,tilted=true)=>{
        await page.evaluate(async({yaw,pitch,scale,tilted})=>{
          const d=await import((await (await fetch('/src/proto/components/CameraChoreographyTools.tsx')).text()).match(/from ["']([^"']*cameraDirector[^"']*)["']/)[1]);
          d.playCameraSteps([{id:'label-check',name:'Label check',shot:{x:0,y:72,scale,yaw,pitch,tilted,framing:tilted?.15:0},durationMs:0,holdMs:20000,easing:'cut'}]);
        },{yaw,pitch,scale,tilted});
        await page.waitForTimeout(300);
      };
      const localInk = () => page.locator('[data-label-owner] .proto-tile-title').evaluateAll(titles => titles.map(title => ({ name: title.getAttribute('aria-label'), rotate: getComputedStyle(title).rotate, lines: [...title.children].map(line => [line.textContent, line.style.cssText]) })));
      const sectorInk = new Map();
      for(const yaw of [0,20,44,45,90,134,135,180,224,225,270,314,315]){
        await setShot(yaw,60);
        const facing = ((Math.round(yaw/90)%4+4)%4)*90, ink = await localInk();
        assert.ok(ink.every(title => Math.abs(parseFloat(title.rotate)) === facing),'Text snaps only to the nearest cardinal edge');
        if (sectorInk.has(facing)) assert.deepEqual(ink,sectorInk.get(facing),'Local layout stays fixed within each sector');
        else sectorInk.set(facing,ink);
        const labels=await projection(page);
        assert.ok(labels.length>=2,'Pinned labels retain their complete fitted lines');
        assert.ok(labels.every(l=>typeof l.error==='number'&&l.error<2),JSON.stringify({yaw,labels}));
      }
      await setShot(229.6,33.6,6.407);
      await page.screenshot({path:`${OUTPUT}/${width}-tile-aligned-3x.png`});
      await setShot(186.4,82,9.935);
      assert.deepEqual(await localInk(),sectorInk.get(180),'Zoom and tilt preserve the selected quarter-turn layout');
      await page.screenshot({path:`${OUTPUT}/${width}-foreshortened-3x.png`});
      const low=await projection(page);
      assert.ok(low.every(l=>l.error<2),JSON.stringify(low));
      await setShot(0,0,3,false);
      const flat=await projection(page);
      assert.ok(flat.every(l=>l.error<2),JSON.stringify(flat));
      await page.screenshot({path:`${OUTPUT}/${width}-overhead-3x.png`});
      assert.deepEqual(await findLayoutDefects(page,'.proto-map-toolbar',{parts:'button'}),[]);
      if (process.argv.includes('--surface')) { assert.deepEqual(errors,[]); console.log('PASS',width,'quarter-turn snapping, stable sectors, perspective and tile axes'); await context.close(); continue; }
      // Scene pins survive camera release, while hover/focus still reveal other tiles.
      await page.evaluate(async()=>{const d=await import((await (await fetch('/src/proto/components/CameraChoreographyTools.tsx')).text()).match(/from ["']([^"']*cameraDirector[^"']*)["']/)[1]);d.stopCameraPlayback();});
      const mountain=page.locator('[data-biome-id][data-tile-type="impassable-mountain"]').first();
      await page.mouse.move(0,0); await mountain.hover();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-label-owner="region"][data-label-shown]').count(),1);
      await page.mouse.move(0,0);
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-label-owner="region"][data-label-shown]').count(),0);
      await page.keyboard.press('Tab');await mountain.focus();
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-label-owner="region"][data-label-shown]').count(),1,'Keyboard focus uses the same label');
      await mountain.evaluate(el=>el.blur());await page.mouse.move(0,0);
      // Saved choreography selections are reviewable and persist across reload.
      await page.evaluate(()=>window.dispatchEvent(new Event('proto-camera-tools-open')));
      await page.getByLabel('Saved camera sequences',{exact:true}).selectOption('story.day01.opening');
      await page.locator('.camera-label-pins summary').click();
      assert.equal(await page.locator('.camera-label-pins input:checked').count(),2);
      assert.deepEqual(await findLayoutDefects(page,'.camera-label-pins',{parts:'summary, label',minFontSize:16}),[]);
      await page.locator('.camera-label-pins').screenshot({path:`${OUTPUT}/${width}-pin-controls-3x.png`});
      await page.getByRole('button',{name:'Close camera choreography',exact:true}).click();
      await page.getByRole('button',{name:'Cinematic review',exact:true}).click();
      await page.getByLabel('Opening-day cinematics',{exact:true}).uncheck();
      await page.getByRole('button',{name:'Close cinematic review',exact:true}).click();
      assert.equal(await page.locator('[data-label-pinned]').count(),0,'Disabling the owning scene clears its pins');
      // Touch taps still reveal the physical label, without changing the tile.
      const bush=page.locator('[data-board-piece="tile"]').filter({has:page.locator('[data-sparse-bush]')});
      const sparseId=await page.locator('[data-biome-title]').evaluateAll(els=>els.find(el=>el.querySelector('[aria-label="Manaberry Patch (sparse)"]'))?.dataset.biomeTitle);
      await page.locator(`[data-biome-id="${sparseId}"]`).tap();
      assert.equal(await page.locator(`[data-biome-title="${sparseId}"][data-label-shown]`).count(),1,'Tile activation uses the surface label');
      await page.getByLabel('Day scenario',{exact:true}).selectOption('sandbox');
      assert.equal(await page.locator('[data-label-pinned]').count(),0,'Sandbox has no tutorial pins');
      await page.getByLabel('Day scenario',{exact:true}).selectOption('day01');
      await page.getByRole('button',{name:'Cinematic review',exact:true}).click();
      await page.getByLabel('Opening-day cinematics',{exact:true}).check();
      await page.getByRole('button',{name:'Close cinematic review',exact:true}).click();
      assert.equal(await page.locator('[data-label-pinned]').count(),2,'Restarting the tutorial restores its own pins');
      await page.getByRole('button',{name:'Visit nearby bush',exact:true}).click();
      assert.equal(await page.locator('[data-label-pinned]').count(),2,'Pins remain during the first trip');
      await page.getByRole('button',{name:'Auto-Solve',exact:true}).first().click();
      await page.getByRole('button',{name:'Visit denser patch',exact:true}).waitFor({timeout:45000});
      await page.waitForTimeout(200);
      assert.equal(await page.locator('[data-label-pinned]').count(),0,'Completing this tutorial section releases the labels');
      assert.deepEqual(errors,[]);
      console.log('PASS',width,'surface projection at eight headings, physical tilt/zoom, hover/focus/tap, scene controls, trip and section release');
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
