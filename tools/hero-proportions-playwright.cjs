const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto('http://localhost:5178/proto.html');
  const results=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createDirectionalSpriteLibrary,directionalPartGeometry}=await import('/src/proto/directionalSpriteRig.ts');
   const {HERO_DIRECTIONAL_SPRITE}=await import('/src/proto/directionalSprites.ts');
   const {MOCHI_DIRECTIONAL_SPRITE}=await import('/src/proto/mochiSprite.ts');
   const {BATTLE_SPRITE_ASSETS}=await import('/src/proto/battleSpriteAssets.ts');
   const loader=new THREE.TextureLoader(),textures={};
   for(const[key,file]of Object.entries(BATTLE_SPRITE_ASSETS)){
    const t=await loader.loadAsync(`/assets/${file}`);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;textures[key]=t;
   }
   const size=384, renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(size,size);renderer.outputColorSpace=THREE.SRGBColorSpace;
   const target=new THREE.WebGLRenderTarget(size,size);target.texture.colorSpace=THREE.SRGBColorSpace;
   const camera=new THREE.OrthographicCamera(-2,2,2.9,-1.1,.1,200);
   const render=scene=>{
    renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);return pixels;
   };
   const mask=pixels=>{
    const background=pixels.slice(0,3),out=new Uint8Array(size*size);
    for(let i=0;i<out.length;i++)out[i]=Number([0,1,2].some(c=>Math.abs(pixels[i*4+c]-background[c])>2));
    return out;
   };
   const connectivity=mask=>{
    const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let largest=0,total=0;
    for(let start=0;start<mask.length;start++)if(mask[start]){
     total++;if(visited[start])continue;let read=0,write=1;queue[0]=start;visited[start]=1;
     while(read<write){
      const index=queue[read++],x=index%size,y=Math.floor(index/size);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
       if(!(dx||dy)||x+dx<0||x+dx>=size||y+dy<0||y+dy>=size)continue;
       const next=index+dy*size+dx;if(mask[next]&&!visited[next]){visited[next]=1;queue[write++]=next;}
      }
     }largest=Math.max(largest,write);
    }return largest/total;
   };
   const measurements=[];
   for(const definition of [HERO_DIRECTIONAL_SPRITE,MOCHI_DIRECTIONAL_SPRITE]){
   const library=createDirectionalSpriteLibrary(textures,definition),height=definition.id==='mochi'?1.85:2.55;
   for(const tier of ['low','high','top'])for(let direction=0;direction<(tier==='top'?1:8);direction++){
    const actor=library.create(height),scene=new THREE.Scene();scene.background=new THREE.Color(0x223038);scene.add(actor.root);
    camera.position.set(0,tier==='top'?20:tier==='high'?18:4.5,tier==='top'?.1:tier==='high'?10:14);camera.lookAt(0,tier==='top'?0:1.2,0);camera.updateMatrixWorld();
    actor.update(camera,-direction*Math.PI/4,0,true);scene.updateMatrixWorld(true);
    const frame=[...definition.low,...definition.high,...(definition.lowOpposite??[]),...(definition.highOpposite??[]),definition.top].find(f=>f.id===actor.frame),part=frame.parts[0];
    const actual=render(scene),referenceScene=new THREE.Scene();referenceScene.background=scene.background;
    const group=new THREE.Group();group.matrixAutoUpdate=false;group.matrix.copy(actor.facing.matrixWorld);referenceScene.add(group);
    const geometry=directionalPartGeometry({...part,clip:frame.outline},textures[frame.source].image);
    const material=new THREE.MeshBasicMaterial({map:textures[frame.source],transparent:false,alphaTest:.45,side:THREE.DoubleSide,forceSinglePass:true});
    const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(height*part.rect[2]/part.rect[3],height,1);mesh.position.y=height/2;group.add(mesh);
    const reference=render(referenceScene),referenceMask=mask(reference),actualMask=mask(actual);let missing=0,extra=0,colorMismatch=0,colorError=0,visible=0,interiorMissing=0;
    for(let i=0;i<referenceMask.length;i++){
     if(referenceMask[i])visible++;
     if(referenceMask[i]&&!actualMask[i]){
      missing++;
      if([-size-1,-size,-size+1,-1,1,size-1,size,size+1].every(offset=>referenceMask[i+offset]))interiorMissing++;
     }
     if(actualMask[i]&&!referenceMask[i])extra++;
     if(referenceMask[i]){
      const errors=[0,1,2].map(c=>Math.abs(actual[i*4+c]-reference[i*4+c]));
      colorError+=errors.reduce((sum,v)=>sum+v,0);
      if(errors.some(v=>v>3))colorMismatch++;
     }
    }
    let worstConnectivity=1;
    for(const time of [.25,1.3,2.7,4.1,5.6]){
     actor.update(camera,-direction*Math.PI/4,time,false,.8,1);
     worstConnectivity=Math.min(worstConnectivity,connectivity(mask(render(scene))));
    }
    actor.setOpacity(.24);
    const fadedVisibleFraction=mask(render(scene)).reduce((sum,v)=>sum+v,0)/visible;
    measurements.push({actor:definition.id,frame:frame.id,missing,extra,interiorMissing,silhouetteDifferenceFraction:Math.max(missing,extra)/visible,colorMismatchFraction:colorMismatch/visible,meanColorError:colorError/(visible*3),worstConnectivity,fadedVisibleFraction});
    geometry.dispose();material.dispose();actor.dispose();
   }
   library.dispose();
   }
   target.dispose();Object.values(textures).forEach(t=>t.dispose());renderer.dispose();return measurements;
  });
  fs.writeFileSync('artifacts/directional-sprites/proportions-check.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  for(const result of results){
   // Separate triangle interpolation can round a nearest-filtered outline
   // texel differently. Allow isolated contour pixels, never an interior gap
   // or a changed silhouette exceeding 0.1% of the original occupied area.
   assert.equal(result.interiorMissing,0,`${result.frame}: an internal joint gap opened`);
   assert.ok(result.silhouetteDifferenceFraction<.001,`${result.frame}: neutral proportions changed`);
   if(result.actor==='hero')assert.ok(result.colorMismatchFraction<.015,`${result.frame}: neutral source appearance changed`);
   // Mochi has a denser source texture rendered at a smaller world size. Exact
   // texel-boundary rounding affects more pixels: bound average RGB error too.
   assert.ok(result.meanColorError<1,`${result.actor}/${result.frame}: neutral colors changed`);
   assert.ok(result.worstConnectivity>.98,`${result.frame}: animated head/hind disconnected from body`);
   assert.ok(result.fadedVisibleFraction>.15,`${result.frame}: charge echo was discarded by the alpha cutoff`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
