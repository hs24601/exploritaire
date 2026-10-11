const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage(); await page.goto('http://localhost:5178/proto.html');
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const {createDirectionalSpriteLibrary} = await import('/src/proto/directionalSpriteRig.ts');
      const {HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE} = await import('/src/proto/directionalSprites.ts');
      const {MOCHI_DIRECTIONAL_SPRITE} = await import('/src/proto/mochiSprite.ts');
      const {BATTLE_SPRITE_ASSETS} = await import('/src/proto/battleSpriteAssets.ts');
      const loader = new THREE.TextureLoader(), textures = {};
      for (const [key,file] of Object.entries(BATTLE_SPRITE_ASSETS)) {
        const t = await loader.loadAsync(`/assets/${file}`); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; textures[key] = t;
      }
      const start = performance.now();
      const heroes = createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE), slimes = createDirectionalSpriteLibrary(textures,DARK_SLIME_DIRECTIONAL_SPRITE);
      const mochis = createDirectionalSpriteLibrary(textures,MOCHI_DIRECTIONAL_SPRITE);
      const preparationMs = performance.now()-start;
      const renderer = new THREE.WebGLRenderer({antialias:false}); renderer.setSize(1280,480); renderer.outputColorSpace = THREE.SRGBColorSpace;
      const camera = new THREE.PerspectiveCamera(45,1280/480,.1,100), gl = renderer.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info'), device = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const quantile = (values,q) => [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
      const measurements = [];
      for (const [count,population] of [[1,'hero'],[10,'hero'],[10,'hero-slime'],[10,'hero-mochi']]) {
        const scene = new THREE.Scene();
        const actors = Array.from({length:count},(_,i) => {
          const other=i>=5 && population!=='hero';
          const actor = (other ? population==='hero-mochi'?mochis:slimes : heroes).create(other ? 1.85 : 2.55);
          actor.root.position.set((i%5-2)*3,0,Math.floor(i/5)*3); scene.add(actor.root); return actor;
        });
        // Exercise every direction and elevation, then time the usual side view.
        for (const elevation of [15,55,89]) for (let direction=0;direction<8;direction++) {
          const yaw = direction*Math.PI/4, pitch = elevation*Math.PI/180;
          camera.position.set(Math.sin(yaw)*25*Math.cos(pitch),25*Math.sin(pitch),Math.cos(yaw)*25*Math.cos(pitch)); camera.lookAt(0,0,0);
          actors.forEach(a=>a.update(camera,0,0,true)); renderer.render(scene,camera);
        }
        const textureCountAfterOrbit = renderer.info.memory.textures;
        camera.position.set(8,5,24); camera.lookAt(0,1,1);
        const updates = [], submissions = [], waits = [];
        for (let frame=0;frame<150;frame++) {
          const a = performance.now(); actors.forEach((actor,i)=>actor.update(camera,i>=5 ? Math.PI : 0,frame/60,false,i*1.7,1));
          const b = performance.now(); renderer.render(scene,camera); const c = performance.now(); gl.finish(); const d = performance.now();
          if(frame>=30) {updates.push(b-a);submissions.push(c-b);waits.push(d-c);}
          if(frame%30===0) await new Promise(resolve=>setTimeout(resolve,0));
        }
        measurements.push({count,population,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,gpuTextures:renderer.info.memory.textures,textureCountAfterOrbit,updateMedianMs:quantile(updates,.5),updateP95Ms:quantile(updates,.95),submitMedianMs:quantile(submissions,.5),submitP95Ms:quantile(submissions,.95),gpuWaitP95Ms:quantile(waits,.95)});
        actors.forEach(a=>a.dispose());
      }
      heroes.dispose(); slimes.dispose(); mochis.dispose(); Object.values(textures).forEach(t=>t.dispose()); renderer.dispose();
      return {device,rendererPixels:[1280,480],preparationMs,atlasMiB:Object.values(textures).reduce((sum,t)=>sum+t.image.width*t.image.height*4/1024/1024,0),measurements};
    });
    assert.deepEqual(result.measurements.map(m=>m.drawCalls),[3,30,20,30]);
    assert.deepEqual(result.measurements.map(m=>m.gpuTextures),[2,2,3,5]);
    assert.ok(result.measurements.every(m=>m.gpuTextures===m.textureCountAfterOrbit),'Orbiting reuses atlas textures');
    fs.writeFileSync('artifacts/directional-sprites/benchmark.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
