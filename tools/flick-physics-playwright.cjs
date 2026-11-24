const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { findLayoutDefects } = require('./lib/layout-check.cjs');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    for (const [width,height] of [[1280,720],[1912,914],[390,844],[844,390]]) {
      if(process.argv.length>2&&!process.argv.slice(2).includes(String(width)))continue;
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:3,reducedMotion:'reduce',hasTouch:width<900});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:5178/proto.html');
      await page.getByRole('button',{name:'Game settings',exact:true}).click();
      const toggle=page.getByRole('checkbox',{name:'Flick physics',exact:true});
      assert(await toggle.isChecked());
      assert(await toggle.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'settings checkbox must receive input above adjacent fields');
      assert.deepEqual(await findLayoutDefects(page,'#art-settings-panel',{parts:'.art-settings__toggle',minFontSize:16}),[]);
      await toggle.locator('..').screenshot({path:`artifacts/flick-settings-${width}-3x.png`});
      await toggle.uncheck();
      await page.reload();
      await page.getByRole('button',{name:'Game settings',exact:true}).click();
      assert.equal(await toggle.isChecked(),false);
      await toggle.check();
      await page.getByRole('button',{name:'Game settings',exact:true}).click();
      const tree=page.getByRole('complementary',{name:'Tutorial scene tree'});
      await tree.getByRole('button',{name:/Scenes/}).click();
      await tree.getByRole('button',{name:/Start leaving the den/}).click();
      await tree.getByRole('button',{name:'Close scene tree'}).click();
      await page.waitForTimeout(600);
      const source=page.locator('.travel-tableau [data-travel-card]:not(:disabled)').filter({has:page.locator('.proto-card-center-rank',{hasText:/^3$/})}).first();
      await source.waitFor();
      await page.waitForFunction(()=>document.querySelector('.travel-tableau [data-travel-card]:not(:disabled)')?.closest('[data-arrival-face]')?.getAttribute('data-arrival-face')==='up');
      const receiver=page.locator('[data-map-actor-card="hero"]');
      const a=await source.boundingBox(),b=await receiver.boundingBox();
      assert(a&&b);
      // Release just short of the receiver, with the final stroke aimed at its centre.
      const end={x:b.x+b.width/2,y:b.y+b.height/2};
      const dx=end.x-(a.x+a.width/2),dy=end.y-(a.y+a.height/2),len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
      const release={x:end.x-ux*(Math.max(b.width,b.height)/2+30),y:end.y-uy*(Math.max(b.width,b.height)/2+30)};
      const before=await source.getAttribute('data-travel-card');
      const client=await page.context().newCDPSession(page),touch=width<900;
      let timestamp=Date.now()/1000;
      const input=async(type,x,y)=>{
        timestamp+=.02;
        if(touch)return client.send('Input.dispatchTouchEvent',{type,timestamp,touchPoints:type==='touchEnd'?[]:[{id:1,x,y}]});
        return client.send('Input.dispatchMouseEvent',{type,timestamp,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1});
      };
      const move=(x,y)=>input(touch?'touchMove':'mouseMoved',x,y);
      const launch=async()=>{
        timestamp=Date.now()/1000;
        if(!touch)await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
        await input(touch?'touchStart':'mousePressed',a.x+a.width/2,a.y+a.height/2);
        await move(release.x-ux*50,release.y-uy*50);
        timestamp+=.11;
        await move(release.x-ux*25,release.y-uy*25);
        await move(release.x,release.y);
        await input(touch?'touchEnd':'mouseReleased',release.x,release.y);
      };
      if(width===1280){
        await page.evaluate(async()=>{(await import('/src/proto/flickPhysics.ts')).setFlickPhysics(false);});
        await launch();await page.waitForTimeout(300);
        assert.equal(await source.getAttribute('data-travel-card'),before,'disabled flick must leave card unplayed');
        assert.equal(await page.locator('body > button[aria-hidden="true"]').count(),0);
        await page.evaluate(async()=>{(await import('/src/proto/flickPhysics.ts')).setFlickPhysics(true);});
      }
      await launch();
      await page.waitForFunction(id=>!document.querySelector(`[data-travel-card="${id}"]`),before,{timeout:5000});
      await page.screenshot({path:`artifacts/flick-landed-${width}.png`});
      assert.deepEqual(errors,[]);
      console.log(`${width}x${height}: persisted toggle, layout and legal inertial landing passed`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});




