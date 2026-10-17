const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5192/proto.html');
  const png=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
   const {HERO_WALKING_DIRECTIONAL_SPRITE:walking}=await import('/src/proto/heroWalkingSprite.ts');
   const {BATTLE_SPRITE_ASSETS}=await import('/src/proto/battleSpriteAssets.ts');
   const textures={},loader=new THREE.TextureLoader();
   for(const key of ['heroWalkingLow','heroWalkingHigh']){
    const texture=await loader.loadAsync('/assets/'+BATTLE_SPRITE_ASSETS[key]);texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.userData.watercolor=true;texture.colorSpace=THREE.SRGBColorSpace;textures[key]=texture;
   }
   const library=createDirectionalSpriteLibrary(textures,walking),actor=library.create(2.55),scene=new THREE.Scene();scene.add(actor.root);
   const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setClearColor(0,0);
   const camera=new THREE.OrthographicCamera(-2,2,2.9,-1.1,.1,200);
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=816;const ctx=canvas.getContext('2d');ctx.fillStyle='#102722';ctx.fillRect(0,0,1024,816);
   for(let row=0;row<3;row++)for(let phase=0;phase<4;phase++){
    const elevation=row===0?.2:row===1?1:Math.PI/2;
    camera.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);camera.lookAt(0,row===2?0:1.2,0);camera.updateMatrixWorld();
    actor.update(camera,row===2?Math.PI:-Math.PI/2,(phase+.05)/6,false);
    renderer.render(scene,camera);ctx.drawImage(renderer.domElement,phase*256,row*272);
    ctx.font='16px monospace';ctx.fillStyle='#cafff4';ctx.fillText(['Low','Elevated','OTT'][row]+' · '+(phase+1),phase*256+16,row*272+260);
   }
   actor.dispose();library.dispose();Object.values(textures).forEach(t=>t.dispose());renderer.dispose();return canvas.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync('artifacts/actor-watercolor-v1/walking-rig-preview.png',Buffer.from(png,'base64'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

