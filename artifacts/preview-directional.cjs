const { chromium } = require('playwright');
const fs = require('node:fs');
fs.mkdirSync('artifacts/directional-sprites',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:3});
  await page.goto('http://localhost:5178/proto.html?combatdemo');
  await page.waitForFunction(()=>document.querySelector('.combat-demo')?.dataset.complete==='true');
  for(const view of ['side','party','enemy','overview']){
   await page.locator(`[data-view="${view}"]`).click();
   await page.waitForFunction(()=>document.querySelector('.combat-demo__arena')?.dataset.cameraMoving==='false');
   await page.screenshot({path:`artifacts/directional-sprites/${view}-1280.png`,scale:'css'});
   console.log(view,await page.locator('.combat-demo__arena').getAttribute('data-actors'));
  }
  const previews=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
   const {HERO_DIRECTIONAL_SPRITE,DARK_SLIME_DIRECTIONAL_SPRITE}=await import('/src/proto/directionalSprites.ts');
   const {MOCHI_DIRECTIONAL_SPRITE}=await import('/src/proto/mochiSprite.ts');
   const {BATTLE_SPRITE_ASSETS}=await import('/src/proto/battleSpriteAssets.ts');
   const loader=new THREE.TextureLoader(),textures={};
   for(const [key,path]of Object.entries(BATTLE_SPRITE_ASSETS)){
    const t=await loader.loadAsync(`/assets/${path}`); t.magFilter=t.minFilter=THREE.NearestFilter; t.generateMipmaps=false; t.colorSpace=THREE.SRGBColorSpace; textures[key]=t;
   }
   const previews={};
   for(const [key,definition]of [['hero',HERO_DIRECTIONAL_SPRITE],['mochi',MOCHI_DIRECTIONAL_SPRITE],['slime',DARK_SLIME_DIRECTIONAL_SPRITE]]){
    const library=createDirectionalSpriteLibrary(textures,definition);
    const columns=key==='mochi'?8:5;
    const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true}); renderer.setSize(columns*320,900); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.setScissorTest(true);
    for(let row=0;row<3;row++)for(let col=0;col<columns;col++){
     const scene=new THREE.Scene(); scene.background=new THREE.Color(0x223038);
     const actor=library.create(2.55); scene.add(actor.root);
     const camera=new THREE.PerspectiveCamera(34,320/300,.1,100),elevation=[15,55,89][row]*Math.PI/180,angle=col*Math.PI/4;
     camera.position.set(Math.sin(angle)*8*Math.cos(elevation),8*Math.sin(elevation),Math.cos(angle)*8*Math.cos(elevation)); camera.lookAt(0,1.2,0);camera.updateMatrixWorld();actor.update(camera,0,0,true);
     renderer.setViewport(col*320,(2-row)*300,320,300);renderer.setScissor(col*320,(2-row)*300,320,300);renderer.render(scene,camera);actor.dispose();
    }
    previews[key]=renderer.domElement.toDataURL('image/png').split(',')[1];renderer.dispose();library.dispose();
   }
   Object.values(textures).forEach(t=>t.dispose());return previews;
  });
  for(const[key,data]of Object.entries(previews))fs.writeFileSync(`artifacts/directional-sprites/${key}-assembly.png`,Buffer.from(data,'base64'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
