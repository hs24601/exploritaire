const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const URL=process.env.PROTO_URL||'http://localhost:5178/proto.html';
async function enter(page,touch){
  const a=await page.locator('[data-board-piece="actor"]').boundingBox(),t=await page.locator('button[data-biome-id="woods-alpha"]').boundingBox();
  if(touch){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});
    for(let i=1;i<=15;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(t.x+t.width/2-a.x-a.width/2)*i/15,y:a.y+a.height/2+(t.y+t.height/2-a.y-a.height/2)*i/15}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(t.x+t.width/2,t.y+t.height/2,{steps:15});await page.mouse.up();
  }
  await page.locator('.proto-actor-energy').waitFor({timeout:15000});
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height] of [[1912,914],[1280,720]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true,deviceScaleFactor:3});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(URL);await enter(page,width===1280);
      assert.equal(await page.getByRole('button',{name:'Leave Tableau',exact:true}).count(),0);
      const exit=page.getByRole('button',{name:'Exit tableau · Hero',exact:true});
      assert.ok(await exit.isVisible());
      assert.equal(await page.getByRole('button',{name:'Everyone exit tableau',exact:true}).count(),0);
      const controls=await page.locator('.proto-main-tableau > .proto-solve-controls').boundingBox();
      const scene=await page.locator('.proto-tableau-scene').boundingBox();
      assert.ok(controls.y+controls.height<=scene.y,'Solver is above the play area');
      for(const mode of ['flat','immersive']){
        if(mode==='immersive')await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
        await page.waitForTimeout(800);
        assert.deepEqual(await findLayoutDefects(page,'.proto-main-tableau',{parts:'.proto-solve-controls, .proto-solve-controls button, .proto-solve-controls label, .proto-tableau-scene'}),[]);
        assert.deepEqual(await findLayoutDefects(page,'.proto-main-foundations',{parts:'.proto-table-summary, .proto-foundation-board, .proto-foundation-exit--everyone'}),[]);
        const dimensions=await page.locator('.proto-tableau-stage').evaluate(stage=>{
          const cards=[...stage.querySelectorAll('button.playing-card')].slice(0,2);
          const a=cards[0].getBoundingClientRect(),b=cards[1].getBoundingClientRect();
          return {ratio:a.height/a.width,peek:b.y-a.y,step:parseFloat(getComputedStyle(stage.closest('.proto-tableau-card-area')).getPropertyValue('--classic-stack-step')),transform:getComputedStyle(stage).transform};
        });
        assert.ok(Math.abs(dimensions.ratio-74/56)<.02,'Cards stay upright at their authored aspect ratio');
        assert.ok(Math.abs(dimensions.peek-dimensions.step)<1,'Original peek spacing survives');
        const headers=await page.locator('.proto-tableau-stage').evaluate(stage=>[...stage.querySelectorAll('button.playing-card')].flatMap(card=>{
          const box=card.getBoundingClientRect(),header=card.querySelector(':scope > div'),next=card.nextElementSibling;
          if(!header)return [];
          const children=[...header.children].map(el=>el.getBoundingClientRect());
          const front=next?.classList.contains('playing-card')?next.getBoundingClientRect():null;
          return children.flatMap((r,i)=>[
            ...(r.left<box.left||r.right>box.right?[`${card.textContent}: header escapes card`]:[]),
            ...(front&&r.bottom>front.top+1?[`${card.textContent}: exposed header covered`]:[]),
            ...(i&&r.left<children[i-1].right-.5?[`${card.textContent}: rank and icon overlap`]:[]),
          ]);
        }));
        assert.deepEqual(headers,[],'Rank and icon must remain fully exposed and separate');
        if(mode==='immersive'){
          assert.equal(dimensions.transform,'none');
          assert.ok(await page.locator('.proto-tableau-fixture').isVisible());
          const lightLayers = await page.locator('.proto-tableau-scenery').evaluate(el => {
            const glow = el.querySelector('.proto-tableau-fixture');
            const rays = el.querySelector('.proto-tableau-scenery__rays');
            const layer = el.querySelector('.proto-tableau-scenery__layer');
            return { glowBehind: !!(glow.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING), raysBehind: !!(rays.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING), transparent: getComputedStyle(layer).backgroundColor, border: getComputedStyle(glow).borderTopWidth, blur: getComputedStyle(glow).filter };
          });
          assert.ok(lightLayers.glowBehind && lightLayers.raysBehind, 'Glow and shafts paint behind sprite cut-outs');
          assert.equal(lightLayers.transparent, 'rgba(0, 0, 0, 0)');
          assert.equal(lightLayers.border, '0px');
          assert.equal(lightLayers.blur, 'blur(9px)');
          assert.equal(await page.locator('.proto-tableau-stage .border-dashed').count(), 0, 'Tableau columns have no dashed placeholders');
          assert.equal(await page.locator('.proto-tableau-scenery__layer').count(),3);
          const scene=page.locator('.proto-tableau-scene'),r=await scene.boundingBox();
          await page.mouse.move(r.x+10,r.y+25);
          assert.notEqual(await scene.evaluate(el=>el.style.getPropertyValue('--scene-pan-x')),'0px');
        }
        await page.locator('.proto-tableau-field').screenshot({path:`artifacts/tableau-${width}-${mode}-3x.png`});
      }
      const card=page.locator('.proto-tableau-stage .playing-card').first();
      const brightness=()=>card.evaluate(el=>getComputedStyle(el).getPropertyValue('--surface-brightness'));
      const day=await brightness();
      await page.locator('.proto-lighting-rail input[type="range"]').fill('0');await page.waitForTimeout(300);
      assert.notEqual(await brightness(),day,'Cards respond to shared time lighting');
      await page.locator('.proto-tableau-field').screenshot({path:`artifacts/tableau-${width}-night-3x.png`});
      await page.getByLabel('Divine Intervention',{exact:true}).check();
      await page.getByRole('button',{name:'Best Move',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.proto-foundation-count-token').textContent.includes('1'));
      if(width===1280)await exit.tap();else {await exit.focus();await page.keyboard.press('Enter');}
      await page.locator('.proto-actor-energy').waitFor({state:'detached'});
      assert.ok(await page.getByRole('button',{name:'Auto-Solve',exact:true}).isDisabled());
      assert.ok(await page.getByRole('button',{name:'Best Move',exact:true}).isDisabled());
      assert.equal(await page.locator('.proto-foundation-count-token').textContent(),'▤0');
      assert.equal(await page.locator('.supply-row[data-supply="wood"]').getAttribute('data-count'),'1','Exit deposits the collected wood');
      assert.deepEqual(errors,[]);await page.close();
    }
    const reduced=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
    await reduced.goto(URL);await enter(reduced,false);await reduced.getByRole('button',{name:'Tilt camera view',exact:true}).click();
    assert.equal(await reduced.locator('.proto-tableau-scenery__motes i').count(),0);
    await reduced.close();
    console.log('Desktop layout, upright full-size stacks and peek, scene/light response, mouse/touch/keyboard play and exit, deposit, solver staffing and reduced motion passed.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
