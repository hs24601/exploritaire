import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { pineViewPair } from './reliefOrbit';
import pineFrames from './pineOrbitFrames.json';
import './depthLab.css';

// Image-space relief, matching Yizhe's image + estimated depth + subdivided
// plane technique. Never wrap the color image around a reconstructed solid.
const assets = {
  pineOrbit: { name: 'Pine · eight-view draft', path: 'labs/pine-orbit-v1/pine-0.png' },
  pine: { name: 'Pine', path: 'environment/watercolor/v1/pine-relief-v1.png' },
  cir: { name: 'Cir', path: 'keru/cir/cir-phoenix-gather-still-v5.png' },
  hero: { name: 'Hero', path: 'ui/holocards/layered/hero-watercolor-v5-ordinary-day.png' },
  eevee: { name: 'Eevee', path: 'labs/live-paint/eevee.png' },
} as const;
type Asset = keyof typeof assets;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const asset = get<HTMLSelectElement>('asset'), view = get<HTMLSelectElement>('view');
const depth = get<HTMLInputElement>('depth'), sway = get<HTMLInputElement>('sway');
const follow = get<HTMLInputElement>('follow'), angle = get<HTMLInputElement>('angle');
const worldYaw = get<HTMLInputElement>('world-yaw'), guideToggle = get<HTMLInputElement>('guide');
const blendViews = get<HTMLInputElement>('blend-views');
const caption = get<HTMLOutputElement>('caption');
get<HTMLFormElement>('depth-controls').onsubmit = event => event.preventDefault();

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#171b1b');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 30);
  camera.position.set(.55, .1, 6.7);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true; orbit.enablePan = false;
  orbit.minDistance = 4.8; orbit.maxDistance = 10;
  orbit.minAzimuthAngle = -Math.PI / 6; orbit.maxAzimuthAngle = Math.PI / 6;
  orbit.minPolarAngle = Math.PI / 2 - .18; orbit.maxPolarAngle = Math.PI / 2 + .18;
  const uniforms = {
    colorMap: { value: null as THREE.Texture | null }, depthMap: { value: null as THREE.Texture | null },
    displacement: { value: 1.3 }, showDepth: { value: 0 },
    rootAnchor: { value: 0 },
    colorMapB: { value: null as THREE.Texture | null }, depthMapB: { value: null as THREE.Texture | null },
    frameBlend: { value: 0 },
    uvA: { value: new THREE.Vector4(1, 1, 0, 0) }, uvB: { value: new THREE.Vector4(1, 1, 0, 0) },
    anchorA: { value: new THREE.Vector2(.498, .067) }, anchorB: { value: new THREE.Vector2(.498, .067) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform sampler2D depthMap;
      uniform float displacement;
      uniform float rootAnchor;
      uniform sampler2D depthMapB;
      uniform float frameBlend;
      uniform vec4 uvA, uvB;
      uniform vec2 anchorA, anchorB;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        // Pine's trunk stays on the world pivot as its image plane follows yaw.
        float baseA = mix(0.5, texture2D(depthMap, anchorA).r, rootAnchor);
        float baseB = mix(0.5, texture2D(depthMapB, anchorB).r, rootAnchor);
        float da = texture2D(depthMap, uv * uvA.xy + uvA.zw).r - baseA;
        float db = texture2D(depthMapB, uv * uvB.xy + uvB.zw).r - baseB;
        displaced.z += mix(da, db, frameBlend) * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D colorMap;
      uniform sampler2D depthMap;
      uniform float showDepth;
      uniform sampler2D colorMapB, depthMapB;
      uniform float frameBlend;
      uniform vec4 uvA, uvB;
      varying vec2 vUv;
      vec4 samplePaint(sampler2D image, vec2 uv) {
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
        return texture2D(image, uv);
      }
      void main() {
        vec2 a = vUv * uvA.xy + uvA.zw, b = vUv * uvB.xy + uvB.zw;
        vec4 ca = samplePaint(colorMap, a), cb = samplePaint(colorMapB, b);
        float alpha = mix(ca.a, cb.a, frameBlend);
        vec4 paint = vec4(mix(ca.rgb * ca.a, cb.rgb * cb.a, frameBlend) / max(alpha, 0.00001), alpha);
        if (paint.a < 0.001) discard;
        float d = mix(texture2D(depthMap, a).r, texture2D(depthMapB, b).r, frameBlend);
        vec3 color = mix(paint.rgb, vec3(d), showDepth);
        gl_FragColor = vec4(color, paint.a);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1, 1, 192, 192);
  const painting = new THREE.Mesh(geometry, material);
  // Bounds depend on displacement, so avoid flat-plane frustum rejection.
  painting.frustumCulled = false; scene.add(painting);
  // Fixed world-space reference geometry makes a full orbit visible. It is
  // independent of the camera-facing painting and never turns with it.
  const guide = new THREE.Group(); scene.add(guide);
  const ringPoints = Array.from({ length: 96 }, (_, i) => {
    const a = i / 96 * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * 1.65, -1.851, Math.cos(a) * 1.65);
  });
  guide.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: '#626d67' })));
  for (let i = 0; i < 4; i++) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.065, 16, 12), new THREE.MeshBasicMaterial({ color: ['#d9a359', '#91b5b1', '#8c9e73', '#a998b8'][i] }));
    marker.position.set(Math.sin(i * Math.PI / 2) * 1.65, -1.851, Math.cos(i * Math.PI / 2) * 1.65);
    guide.add(marker);
  }
  const loader = new THREE.TextureLoader();
  const cache = new Map<Asset, { color: THREE.Texture; depth: THREE.Texture }>();
  let orbitFrames: { color: THREE.Texture; depth: THREE.Texture }[] = [];
  let request = 0, disposed = false;
  const base = `${import.meta.env.BASE_URL}assets/runtime/`;
  function update() {
    uniforms.displacement.value = view.value === 'original' ? 0 : Number(depth.value);
    uniforms.showDepth.value = view.value === 'depth' ? 1 : 0;
    get<HTMLOutputElement>('depth-value').value = Number(depth.value).toFixed(2);
    depth.disabled = view.value === 'original';
    canvas.dataset.view = view.value;
  }
  function configureOrbit() {
    const pine = asset.value === 'pine' || asset.value === 'pineOrbit', full = pine && follow.checked;
    orbit.minAzimuthAngle = full ? -Infinity : -Math.PI / 6;
    orbit.maxAzimuthAngle = full ? Infinity : Math.PI / 6;
    uniforms.rootAnchor.value = pine ? 1 : 0;
    get<HTMLInputElement>('depth-file').disabled = asset.value === 'pineOrbit';
    blendViews.disabled = asset.value !== 'pineOrbit';
    document.querySelectorAll<HTMLElement>('[data-pine-control]').forEach(el => { el.hidden = !pine; });
    angle.disabled = worldYaw.disabled = !full;
    if (!full) painting.rotation.y = 0;
    guide.visible = pine && guideToggle.checked;
    get<HTMLOutputElement>('angle-value').value = `${angle.value}°`;
    if (canvas.dataset.ready === 'true') caption.value = pine
      ? full ? asset.value === 'pineOrbit' ? 'Pine · eight painted views · draft transitions' : 'Pine · single-view camera following' : 'Pine · fixed relief · bounded camera'
      : `${assets[asset.value as Asset].name} · original paint + estimated depth · drag gently`;
    orbit.update();
  }
  async function select() {
    const current = ++request, key = asset.value as Asset;
    get<HTMLParagraphElement>('depth-error').hidden = true;
    painting.visible = false; canvas.dataset.ready = 'false';
    caption.value = `Loading ${assets[key].name}…`;
    try {
      if (key === 'pineOrbit' && !orbitFrames.length) {
        orbitFrames = await Promise.all(Array.from({ length: 8 }, async (_, i) => {
          const [color, estimate] = await Promise.all([
            loader.loadAsync(`${base}labs/pine-orbit-v1/pine-${i}.png`),
            loader.loadAsync(`${base}labs/depth-relief/pine-orbit-${i}-depth.png`),
          ]);
          color.colorSpace = THREE.SRGBColorSpace; estimate.colorSpace = THREE.NoColorSpace;
          return { color, depth: estimate };
        }));
        cache.set(key, orbitFrames[0]);
      }
      let pair = cache.get(key);
      if (!pair) {
        const [color, estimate] = await Promise.all([
          loader.loadAsync(base + assets[key].path),
          loader.loadAsync(`${base}labs/depth-relief/${key}-depth.png`),
        ]);
        color.colorSpace = THREE.SRGBColorSpace;
        estimate.colorSpace = THREE.NoColorSpace;
        pair = { color, depth: estimate };
        if (disposed) { color.dispose(); estimate.dispose(); return; }
        cache.set(key, pair);
      }
      if (current !== request || disposed) return;
      uniforms.colorMap.value = pair.color; uniforms.depthMap.value = pair.depth;
      uniforms.colorMapB.value = pair.color; uniforms.depthMapB.value = pair.depth;
      uniforms.frameBlend.value = 0;
      uniforms.uvA.value.set(1, 1, 0, 0); uniforms.uvB.value.set(1, 1, 0, 0);
      uniforms.anchorA.value.set(.498, .067); uniforms.anchorB.value.set(.498, .067);
      painting.scale.set(4.2 * (key === 'pineOrbit' ? .65 : pair.color.image.width / pair.color.image.height), 4.2, 1);
      painting.visible = true; update();
      get<HTMLAnchorElement>('export-depth').href = `${base}labs/depth-relief/${key === 'pineOrbit' ? 'pine-orbit-0' : key}-depth.png`;
      get<HTMLAnchorElement>('export-depth').download = `${key}-depth.png`;
      caption.value = `${assets[key].name} · original paint + estimated depth · drag gently`;
      canvas.dataset.asset = key;
      configureOrbit();
      if (key === 'pine' || key === 'pineOrbit') caption.value = key === 'pineOrbit' ? 'Pine · eight painted views · draft transitions' : 'Pine · single-view camera following';
    } catch (reason) { fail(reason); }
  }
  function fail(reason: unknown) {
    const error = get<HTMLParagraphElement>('depth-error');
    error.hidden = false; error.textContent = `Relief test could not load: ${String(reason)}`;
  }
  asset.addEventListener('change', () => { void select(); });
  depth.addEventListener('input', update); view.addEventListener('change', update);
  follow.addEventListener('change', configureOrbit); angle.addEventListener('input', configureOrbit);
  guideToggle.addEventListener('change', configureOrbit);
  worldYaw.addEventListener('input', () => {
    sway.checked = false;
    const yaw = Number(worldYaw.value) * Math.PI / 180, radius = Math.hypot(camera.position.x, camera.position.z);
    camera.position.x = Math.sin(yaw) * radius; camera.position.z = Math.cos(yaw) * radius;
    orbit.update();
  });
  get<HTMLButtonElement>('reset').onclick = () => {
    sway.checked = false; orbit.reset(); camera.position.set(0, 0, 6.7); orbit.target.set(0, 0, 0); orbit.update();
  };
  // Custom maps are session-only and never overwrite baked artwork or depth.
  let imported: THREE.Texture | undefined;
  get<HTMLInputElement>('depth-file').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if (!file) return;
    const current = request, url = URL.createObjectURL(file);
    try {
      const texture = await loader.loadAsync(url); texture.colorSpace = THREE.NoColorSpace;
      if (current !== request || disposed) { texture.dispose(); return; }
      imported?.dispose(); imported = texture; uniforms.depthMap.value = texture; uniforms.depthMapB.value = texture;
      caption.value = `${assets[asset.value as Asset].name} · custom depth map`;
    } catch (reason) { fail(reason); }
    finally { URL.revokeObjectURL(url); }
  });
  const observer = new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    // Reserve the wrapped control strip without moving the trunk in world space.
    camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, 0, get<HTMLFormElement>('depth-controls').offsetHeight / 2, canvas.clientWidth, canvas.clientHeight);
    camera.updateProjectionMatrix();
  }); observer.observe(canvas); observer.observe(get('depth-controls'));
  orbit.addEventListener('start', () => { sway.checked = false; });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  sway.checked = !reducedMotion;
  let previous = performance.now(), elapsed = 0;
  renderer.setAnimationLoop(now => {
    const dt = Math.min(.05, (now - previous) / 1000); previous = now;
    if (document.hidden || disposed) return;
    elapsed += dt;
    if (sway.checked && (asset.value === 'pine' || asset.value === 'pineOrbit') && follow.checked) {
      const yaw = orbit.getAzimuthalAngle() + dt * .16, radius = Math.hypot(camera.position.x, camera.position.z);
      camera.position.x = Math.sin(yaw) * radius; camera.position.z = Math.cos(yaw) * radius;
    } else if (sway.checked) {
      const distance = orbit.getDistance();
      const yaw = Math.sin(elapsed * .24) * .2, pitch = Math.sin(elapsed * .19) * .04;
      camera.position.set(Math.sin(yaw) * distance, pitch * distance, Math.cos(yaw) * distance);
    }
    orbit.update();
    const yaw = orbit.getAzimuthalAngle();
    const multi = asset.value === 'pineOrbit' && orbitFrames.length === 8;
    if (multi) {
      const { a, b, blend } = pineViewPair(yaw, blendViews.checked);
      uniforms.colorMap.value = orbitFrames[a].color; uniforms.depthMap.value = orbitFrames[a].depth;
      uniforms.colorMapB.value = orbitFrames[b].color; uniforms.depthMapB.value = orbitFrames[b].depth;
      uniforms.frameBlend.value = blend;
      uniforms.uvA.value.fromArray(pineFrames.frames[a].uv); uniforms.uvB.value.fromArray(pineFrames.frames[b].uv);
      uniforms.anchorA.value.fromArray(pineFrames.frames[a].anchor); uniforms.anchorB.value.fromArray(pineFrames.frames[b].anchor);
      canvas.dataset.frames = `${a},${b}`; canvas.dataset.blend = String(blend);
      const active = blend < .5 ? a : b;
      get<HTMLAnchorElement>('export-depth').href = `${base}labs/depth-relief/pine-orbit-${active}-depth.png`;
      get<HTMLAnchorElement>('export-depth').download = `pine-orbit-${active}-depth.png`;
    }
    painting.rotation.y = (asset.value === 'pine' || multi) && follow.checked
      ? yaw - Math.sin(yaw * (multi ? 8 : 1)) * Number(angle.value) * Math.PI / 180 : 0;
    const degrees = (yaw * 180 / Math.PI + 360) % 360;
    worldYaw.value = String(Math.round(degrees));
    get<HTMLOutputElement>('yaw-value').value = `${Math.round(degrees)}°`;
    canvas.dataset.yaw = String(yaw); canvas.dataset.reliefAngle = String(yaw - painting.rotation.y);
    renderer.render(scene, camera);
    if (painting.visible) canvas.dataset.ready = 'true';
  });
  window.addEventListener('pagehide', () => {
    disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); orbit.dispose();
    cache.forEach(pair => { pair.color.dispose(); pair.depth.dispose(); }); imported?.dispose();
    orbitFrames.slice(1).forEach(pair => { pair.color.dispose(); pair.depth.dispose(); });
    geometry.dispose(); material.dispose(); renderer.dispose();
    guide.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
  }, { once: true });
  await select();
}
start().catch(reason => { const error = get<HTMLParagraphElement>('depth-error'); error.hidden = false; error.textContent = String(reason); });
