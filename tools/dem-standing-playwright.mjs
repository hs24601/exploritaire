import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const { findLayoutDefects } = createRequire(import.meta.url)('./lib/layout-check.cjs');
const base = process.env.PROTO_TEST_URL || 'http://127.0.0.1:5211';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && r.url().includes('/assets/'))failed.push(r.url());});
  await page.goto(`${base}/proto.html?actorEditor&entity=dem`,{waitUntil:'networkidle'});
  await page.locator('.ae-canvas canvas').waitFor();await page.waitForTimeout(1500);
  if(await page.locator('vite-error-overlay').count())throw Error('Vite error overlay is present');
  if(await page.getByRole('alert').count())throw Error(await page.getByRole('alert').allTextContents());
  if(await page.getByRole('textbox',{name:'Name',exact:true}).inputValue()!=='Dem')throw Error('Dem was not selected');
  for(const size of [{width:1280,height:720},{width:1912,height:914},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);await page.waitForTimeout(100);
    const defects=await findLayoutDefects(page,'.ae-canvas',{parts:'canvas'});
    if(defects.length)throw Error(defects.join('\n'));
    await page.locator('.ae-canvas').screenshot({path:`output/dem-editor-${size.width}.png`});
  }
  const review=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
    const {DEM_DIRECTIONAL_SPRITE:definition,DEM_SPRITE_ASSETS:assets}=await import('/src/proto/demSprite.ts');
    const loader=new THREE.TextureLoader();
    const textures=Object.fromEntries(await Promise.all(Object.entries(assets).map(async([key,path])=>{
      const t=await loader.loadAsync('/assets/'+path);t.colorSpace=THREE.SRGBColorSpace;t.userData.watercolor=true;
      t.minFilter=t.magFilter=THREE.LinearFilter;return [key,t];
    })));
    const library=createDirectionalSpriteLibrary(textures,definition),rig=library.create(1.7);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#202c32');scene.add(rig.root);
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(384,384);
    const camera=new THREE.OrthographicCamera(-1.5,1.5,2.1,-.9,.01,100);
    const sheet=document.createElement('canvas');sheet.width=2304;sheet.height=768;const ctx=sheet.getContext('2d');
    ctx.fillStyle='#202c32';ctx.fillRect(0,0,sheet.width,sheet.height);
    const frames=[];
    for(let tier=0;tier<2;tier++)for(let direction=0;direction<5;direction++){
      const yaw=direction*Math.PI/4;camera.position.set(Math.sin(yaw)*5,tier?8:1.2,Math.cos(yaw)*5);camera.lookAt(0,.7,0);
      rig.update(camera,0,0,true);renderer.render(scene,camera);
      ctx.drawImage(renderer.domElement,direction*384,tier*384);
      ctx.fillStyle='#e7edf0';ctx.font='18px system-ui';ctx.fillText(rig.frame,direction*384+16,tier*384+28);frames.push(rig.frame);
    }
    camera.left=-1.2;camera.right=1.2;camera.top=1.2;camera.bottom=-1.2;camera.updateProjectionMatrix();
    camera.position.set(0,10,.001);camera.lookAt(0,0,0);rig.update(camera,Math.PI,0,true);renderer.render(scene,camera);
    ctx.drawImage(renderer.domElement,1920,384);ctx.fillText('top — four planted paws',1936,412);frames.push(rig.frame);
    renderer.setSize(900,900);renderer.render(scene,camera);const top=renderer.domElement.toDataURL();
    // Verify that both PNG atlases have transparent gutters and opaque body pigment.
    const alpha=Object.entries(textures).map(([key,t])=>{
      const c=document.createElement('canvas');c.width=t.image.width;c.height=t.image.height;const ink=c.getContext('2d');ink.drawImage(t.image,0,0);
      const d=ink.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;
      for(let i=3;i<d.length;i+=4){if(d[i]===0)clear++;if(d[i]>=250)solid++;}
      if(clear<d.length/4*.25||solid<10000)throw Error('Invalid sprite alpha: '+key);
      return {key,clear,solid};
    });
    return {sheet:sheet.toDataURL(),top,frames,alpha};
  });
  for(const [key,name] of [['sheet','dem-standing-v1-contact-sheet'],['top','dem-standing-v1-overhead-3x']])fs.writeFileSync(`output/${name}.png`,Buffer.from(review[key].split(',')[1],'base64'));
  console.log({url:`${base}/proto.html?actorEditor&entity=dem`,frames:review.frames,alpha:review.alpha,errors,failed});
  if(errors.length||failed.length)throw Error('Browser errors or missing assets');
} finally {await browser.close();}
