const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
(async()=>{
  fs.mkdirSync('artifacts/hero-bobtail-v3',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try {
    for(const [width,touch] of [[1280,false],[1912,true]]) {
      const page=await browser.newPage({viewport:{width,height:width===1280?720:914},hasTouch:touch,deviceScaleFactor:3});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:5197/proto.html');
      const settings=page.getByRole('button',{name:'Game settings'});if(touch)await settings.tap();else await settings.click();
      await page.getByRole('checkbox',{name:'Hero flame tail'}).uncheck();const toggle=page.getByRole('checkbox',{name:'Hero bobtail'});await toggle.uncheck();
      assert.equal(await page.locator('[data-rest-bobtail]').count(),0);
      await toggle.check();await page.locator('[data-rest-bobtail]').first().waitFor();
      assert.deepEqual(await findLayoutDefects(page,'.art-settings__panel',{parts:'label,select'}),[]);
      await page.locator('.art-settings__panel').screenshot({path:`artifacts/hero-bobtail-v3/settings-${width}-3x.png`});
      assert.deepEqual(errors,[]);await page.close();
    }
    const page=await browser.newPage();await page.goto('http://127.0.0.1:5197/proto.html');
    const result=await page.evaluate(async()=>{
      const THREE=await import('/node_modules/.vite/deps/three.js');
      const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
      const {HERO_DIRECTIONAL_SPRITE}=await import('/src/proto/directionalSprites.ts');
      const {HERO_SITTING_DIRECTIONAL_SPRITE}=await import('/src/proto/heroSittingSprite.ts');
      const {HERO_WALKING_DIRECTIONAL_SPRITE}=await import('/src/proto/heroWalkingSprite.ts');
      const {HERO_COMBAT_POSES}=await import('/src/proto/heroCombatSprites.ts');
      const {BATTLE_SPRITE_ASSETS}=await import('/src/proto/battleSpriteAssets.ts');
      const textures={},loader=new THREE.TextureLoader();
      for(const [key,path] of Object.entries(BATTLE_SPRITE_ASSETS)) {
        if(!key.startsWith('hero'))continue;
        const texture=await loader.loadAsync('/assets/'+path);texture.colorSpace=THREE.SRGBColorSpace;texture.userData.watercolor=true;textures[key]=texture;
      }
      const library=createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,{sitting:HERO_SITTING_DIRECTIONAL_SPRITE,walking:HERO_WALKING_DIRECTIONAL_SPRITE,...HERO_COMBAT_POSES});
      const actor=library.create(1),scene=new THREE.Scene();scene.add(actor.root);
      const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(240,240);
      const display=new THREE.OrthographicCamera(-.75,.75,1.25,-.25,.1,100);display.position.set(0,0,10);
      const eye=new THREE.PerspectiveCamera();
      const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1680;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#19352f';ctx.fillRect(0,0,canvas.width,canvas.height);
      const poses=['standing','sitting','walking','flinch','down'];
      for(let row=0;row<7;row++)for(let col=0;col<10;col++) {
        const pose=poses[Math.floor(col/2)],on=col%2===1;
        const elevation=row===6?Math.PI/2:row===5?1:.2;
        eye.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);
        actor.setPose(pose);actor.setFlameTailVisible(false);actor.setBobtailVisible(on);actor.update(eye,row<5?-row*Math.PI/4:row===5?-Math.PI/2:0,.2,true);
        actor.billboard.rotation.set(0,0,0);
        if(row===6){display.top=.75;display.bottom=-.75;}else{display.top=1.25;display.bottom=-.25;}display.updateProjectionMatrix();
        renderer.render(scene,display);ctx.drawImage(renderer.domElement,col*240,row*240);
        ctx.font='16px monospace';ctx.fillStyle='#ffedc9';ctx.fillText(pose+' '+(on?'tail on':'tail off'),col*240+6,row*240+232);
      }
      actor.dispose();library.dispose();renderer.dispose();Object.values(textures).forEach(t=>t.dispose());
      return canvas.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync('artifacts/hero-bobtail-v3/rig-gallery.png',Buffer.from(result,'base64'));
    console.log('Passed mouse/touch bobtail toggles, den visibility, settings layout, all pose/view gallery.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
