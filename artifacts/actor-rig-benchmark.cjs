const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('http://localhost:5178/proto.html');
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const { createSpriteRigLibrary } = await import('/src/proto/actorSpriteRig.ts');
      const { HERO_SPRITE_RIG } = await import('/src/proto/actorSpriteLibrary.ts');
      const { actorHeading, billboardFacing } = await import('/src/proto/actorOrientation.ts');
      const source = await new THREE.TextureLoader().loadAsync('/assets/actors/hero.png');
      const start = performance.now(), library = createSpriteRigLibrary(source, HERO_SPRITE_RIG);
      const preparationMs = performance.now() - start;
      const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(640, 250);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      const device = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const camera = new THREE.PerspectiveCamera(45, 640/250, .1, 100); camera.position.set(9,5,12); camera.lookAt(0,1,0);
      const quantile = (values, q) => [...values].sort((a,b) => a-b)[Math.floor((values.length-1)*q)];
      const measurements = [];
      for (const count of [1,10]) {
        const scene = new THREE.Scene();
        const rigs = Array.from({length:count}, (_, i) => {
          const rig = library.create(3.2); rig.root.position.set(i%2 ? 3 : -3, 0, (Math.floor(i/2)-2)*2); scene.add(rig.root); return rig;
        });
        const actors = rigs.map((rig, i) => ({ id: String(i), team: i%2 ? 'enemy' : 'party', position: rig.root.position }));
        const update = [], submit = [], finish = [];
        for (let frame=0;frame<330;frame++) {
          const a = performance.now();
          rigs.forEach((rig,i) => rig.update(camera, actorHeading(actors[i], actors), frame/60, false, i*1.7, 1));
          const b = performance.now(); renderer.render(scene,camera); const c = performance.now(); gl.finish(); const d = performance.now();
          if (frame >= 30) { update.push(b-a); submit.push(c-b); finish.push(d-c); }
          if (frame%30 === 0) await new Promise(resolve => setTimeout(resolve,0));
        }
        measurements.push({ count, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, gpuTextures: renderer.info.memory.textures, updateMedianMs: quantile(update,.5), updateP95Ms: quantile(update,.95), submitMedianMs: quantile(submit,.5), submitP95Ms: quantile(submit,.95), gpuFinishMedianMs: quantile(finish,.5), gpuFinishP95Ms: quantile(finish,.95) });
        rigs.forEach(rig => rig.dispose());
      }
      const positions = [{x:-3,z:0},{x:-4,z:2.6},{x:3,z:0},{x:4,z:-2.8}];
      const actors = positions.map((position,i)=>({id:String(i),team:i<2?'party':'enemy',position}));
      const example = actors.slice(0,2).map(actor => {
        const heading=actorHeading(actor,actors), billboardYaw=Math.atan2(-10.048-actor.position.x,3.209-actor.position.z);
        return {id:actor.id,heading,sourceFlip:billboardFacing(heading,billboardYaw,'left'),projection:Math.sin(heading-billboardYaw)};
      });
      const size={width:source.image.width,height:source.image.height};
      library.dispose(); source.dispose(); renderer.dispose();
      return {device,rendererPixels:[640,250],preparationMs,size,maskedTextureMiB:3*size.width*size.height*4/1024/1024,measurements,example};
    });
    fs.writeFileSync('artifacts/actor-rig-benchmark.json', JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
