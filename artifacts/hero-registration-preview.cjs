const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900}});await page.goto('http://localhost:5178/proto.html');
  const data=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createDirectionalSpriteLibrary}=await import('/src/proto/directionalSpriteRig.ts');
   const {HERO_DIRECTIONAL_SPRITE}=await import('/src/proto/directionalSprites.ts');
   const loader=new THREE.TextureLoader(),textures={};
   for(const[key,file]of[['heroLow','hero-directions-low-v1.png'],['heroHigh','hero-directions-high-v1.png'],['slime','dark-slime-directions-v1.png']]){
    const t=await loader.loadAsync(`/assets/actors/battle/${file}`);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;textures[key]=t;
   }
   const placement=[
    [[0,.65,.70],[0,.29,.58],[0,.29,.58]],
    [[-.24,.64,.68],[-.08,.30,.60],[.22,.30,.60]],
    [[-.33,.64,.66],[-.10,.30,.60],[.26,.32,.64]],
    [[-.28,.71,.58],[-.13,.305,.61],[.20,.305,.61]],
    [[0,.79,.42],[0,.42,.60],[0,.385,.77]],
   ];
   const candidate=structuredClone(HERO_DIRECTIONAL_SPRITE);
   for(const frames of [candidate.low,candidate.high])frames.forEach((frame,d)=>frame.parts.forEach((p,i)=>{[p.x,p.y,p.height]=placement[d][i];}));
   const definitions=[HERO_DIRECTIONAL_SPRITE,candidate];
   const guideRects=[[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]];
   const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(1500,900);renderer.setScissorTest(true);renderer.outputColorSpace=THREE.SRGBColorSpace;
   for(let row=0;row<3;row++){
    const library=row>0?createDirectionalSpriteLibrary(textures,definitions[row-1]):null;
    for(let d=0;d<5;d++){
     const scene=new THREE.Scene();scene.background=new THREE.Color(0x223038);
     const camera=new THREE.OrthographicCamera(-2,2,3.1,-.9,.1,200);camera.position.set(0,0,100);camera.lookAt(0,0,0);
     let actor;
     if(!row){
      const[x,y,w,h]=guideRects[d],geometry=new THREE.PlaneGeometry(2.55*w/h,2.55),uv=geometry.getAttribute('uv');
      for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*w)/textures.heroLow.image.width,1-(y+(1-uv.getY(i))*h)/textures.heroLow.image.height);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:textures.heroLow,transparent:true,alphaTest:.45}));mesh.position.y=1.275;scene.add(mesh);
     }else{actor=library.create(2.55);scene.add(actor.root);actor.update(camera,-d*Math.PI/4,0,true);}
     renderer.setViewport(d*300,(2-row)*300,300,300);renderer.setScissor(d*300,(2-row)*300,300,300);renderer.render(scene,camera);actor?.dispose();
    }library?.dispose();
   }
   return renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync('artifacts/directional-sprites/registration-comparison.png',Buffer.from(data,'base64'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
