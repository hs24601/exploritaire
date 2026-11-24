import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const {findLayoutDefects}=createRequire(import.meta.url)('./lib/layout-check.cjs');
const base=process.env.PROTO_TEST_URL||'http://127.0.0.1:5211';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/proto.html?actorEditor&entity=dem`,{waitUntil:'networkidle'});
 await page.locator('canvas[data-pose="standing"]').waitFor();
 for(const kind of ['hit','flinch']) {
   await page.getByRole('button',{name:`Play ${kind}`,exact:true}).click();
   await page.locator(`canvas[data-pose="${kind}"]`).waitFor();
   await page.getByRole('button',{name:'Pause animation',exact:true}).click();
   await page.waitForTimeout(200);const before=await page.locator('.ae-canvas').screenshot();
   await page.waitForTimeout(200);const after=await page.locator('.ae-canvas').screenshot();
   if(!before.equals(after))throw Error('Paused frame changed: '+kind);
   fs.writeFileSync(`output/dem-${kind}-preview.png`,after);
   await page.getByRole('button',{name:'Resume animation',exact:true}).click();
   await page.locator('canvas[data-pose="standing"]').waitFor();
   await page.waitForTimeout(600);
   if(!await page.getByRole('button',{name:'Pause animation',exact:true}).isDisabled())throw Error('Animation did not complete');
 }
 for(const size of [{width:1280,height:720},{width:1912,height:914},{width:390,height:844},{width:844,height:390}]) {
   await page.setViewportSize(size);await page.waitForTimeout(100);
   for(const [root,parts] of [['.ae-reactions','button'],['.ae-canvas','canvas']]) {
     const defects=await findLayoutDefects(page,root,{parts});if(defects.length)throw Error(defects.join('\n'));
   }
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Play flinch',exact:true}).click();
 await page.locator('canvas[data-pose="flinch"]').waitFor();
 await page.locator('canvas[data-pose="standing"]').waitFor();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const sheets=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
   const {DEM_DIRECTIONAL_SPRITE:standing,DEM_SPRITE_ASSETS}=await import('/src/proto/demSprite.ts');
   const {DEM_COMBAT_POSES:poses,DEM_COMBAT_ASSETS,sampleDemReaction}=await import('/src/proto/demCombatSprites.ts');
   const loader=new THREE.TextureLoader();
   const textures=Object.fromEntries(await Promise.all(Object.entries({...DEM_SPRITE_ASSETS,...DEM_COMBAT_ASSETS}).map(async([k,p])=>{const t=await loader.loadAsync('/assets/'+p);t.colorSpace=THREE.SRGBColorSpace;t.userData.watercolor=true;t.minFilter=t.magFilter=THREE.LinearFilter;return[k,t];})));
   const library=createDirectionalSpriteLibrary(textures,standing,poses),rig=library.create(1.7);
   const scene=new THREE.Scene();scene.background=new THREE.Color('#202c32');scene.add(rig.root);
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(384,384);
   const camera=new THREE.OrthographicCamera(-1.5,1.5,2.1,-.9,.01,100),result={};
   for(const kind of ['hit','flinch']) {
     rig.setPose(kind);const c=document.createElement('canvas');c.width=2304;c.height=768;const ink=c.getContext('2d');ink.fillStyle='#202c32';ink.fillRect(0,0,c.width,c.height);
     for(let tier=0;tier<2;tier++)for(let direction=0;direction<5;direction++) {
       const yaw=direction*Math.PI/4;camera.position.set(Math.sin(yaw)*5,tier?8:1.2,Math.cos(yaw)*5);camera.lookAt(0,.7,0);rig.update(camera,0,0,true);renderer.render(scene,camera);ink.drawImage(renderer.domElement,direction*384,tier*384);ink.fillStyle='#edf3f7';ink.font='18px system-ui';ink.fillText(kind+' '+rig.frame,direction*384+12,tier*384+25);
     }
     const topCamera=new THREE.OrthographicCamera(-1.2,1.2,1.2,-1.2,.01,100);topCamera.position.set(0,10,.001);topCamera.lookAt(0,0,0);rig.update(topCamera,Math.PI,0,true);renderer.render(scene,topCamera);ink.drawImage(renderer.domElement,1920,384);result[kind]=c.toDataURL();
   }
   return result;
 });
 for(const [kind,png] of Object.entries(sheets))fs.writeFileSync(`output/dem-${kind}-contact-sheet.png`,Buffer.from(png.split(',')[1],'base64'));
 const zoom=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:3});
 await zoom.goto(`${base}/proto.html?actorEditor&entity=dem`,{waitUntil:'networkidle'});await zoom.locator('.ae-reactions').screenshot({path:'output/dem-animation-controls-3x.png'});await zoom.close();
 if(errors.length)throw Error(errors.join('\n'));console.log('Dem hit/flinch: one-shot playback, pause/resume, reduced motion, four viewport layouts and 22 pose views passed.');
}finally{await browser.close();}
