import {presentBookFrame} from './bootPresentation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createKirigamiPine, kirigamiPinePose } from './kirigamiPine';
import {createBookViewport} from './viewportPolicy';

/** book.html?kirigami — standalone viewer for the kirigami pine. Standard orbit
 * camera (left-drag orbit, right-drag pan, wheel or pinch zoom) and a progress
 * scrubber from flat on the page (0%) to fully unfolded (100%). */

const PINE = 'environment/watercolor/v1/pine-relief-v1.png';
const HEIGHT = 3.2, DURATION = 1.8;

async function trimmedTexture(path: string, renderer: THREE.WebGLRenderer) {
  const source = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${path}`);
  const image = source.image as HTMLImageElement;
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (px[(y * c.width + x) * 4 + 3] > 12) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const crop = document.createElement('canvas'); crop.width = Math.max(1, x1 - x0 + 1); crop.height = Math.max(1, y1 - y0 + 1);
  crop.getContext('2d')!.drawImage(c, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const tex = new THREE.CanvasTexture(crop); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  source.dispose(); return tex;
}

function panel() {
  const root = document.createElement('section'); root.id = 'kirigami-panel'; root.setAttribute('aria-label', 'Kirigami pine controls');
  root.innerHTML = `
    <h1>Kirigami pine</h1>
    <label class="kv-row"><span>Unfold</span><input id="kv-progress" type="range" min="0" max="100" step="0.1" value="100" aria-label="Unfold progress"><output id="kv-value">100%</output></label>
    <p id="kv-stage" aria-live="off"></p>
    <div class="kv-buttons">
      <button id="kv-flatten">Flatten</button><button id="kv-unfold">Unfold</button><button id="kv-loop" aria-pressed="false">Loop</button><button id="kv-reset" aria-label="Reset camera">Reset camera</button>
    </div>
    <label class="kv-check"><input id="kv-sprite" type="checkbox" checked> Painted pine beside it</label>
    <p class="kv-help">Left-drag to orbit · right-drag to pan · scroll to zoom. On touch: drag to orbit, pinch to zoom, two-finger drag to pan.</p>`;
  const style = document.createElement('style');
  style.textContent = `
    body.kirigami-viewer #fold, body.kirigami-viewer #scene-action, body.kirigami-viewer #book-navigator, body.kirigami-viewer #book-tools, body.kirigami-viewer #fps-readout, body.kirigami-viewer #event, body.kirigami-viewer .paper-hit, body.kirigami-viewer #page-narrative { display: none !important; }
    body.kirigami-viewer canvas { position: fixed; inset: 0; width: 100vw !important; height: 100vh !important; }
    #kirigami-panel { position: fixed; right: 20px; bottom: 20px; width: min(440px, calc(100vw - 32px)); box-sizing: border-box; padding: 14px 18px 12px;
      background: linear-gradient(#4a3524, #36261a); border: 2px solid #b08a4a; border-radius: 10px; box-shadow: 0 8px 24px #0008; color: #f3ead8; font: 16px/1.35 Georgia, 'Book Antiqua', serif; }
    #kirigami-panel h1 { margin: 0 0 8px; font-size: 18px; font-weight: normal; letter-spacing: .04em; color: #e8c987; }
    #kirigami-panel .kv-row { display: grid; grid-template-columns: auto 1fr 4.2em; gap: 12px; align-items: center; }
    #kirigami-panel input[type=range] { width: 100%; accent-color: #d8b36a; height: 28px; cursor: pointer; }
    #kirigami-panel output { text-align: right; font-variant-numeric: tabular-nums; }
    #kirigami-panel #kv-stage { margin: 4px 0 10px; color: #d9cbb0; font-variant-numeric: tabular-nums; min-height: 1.35em; }
    #kirigami-panel .kv-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    #kirigami-panel button { font: inherit; color: #2b1d12; background: linear-gradient(#f0dca8, #c9a35c); border: 1px solid #7a5a2c; border-radius: 6px; padding: 6px 14px; cursor: pointer; min-height: 36px; }
    #kirigami-panel button[aria-pressed=true] { background: linear-gradient(#a8d0a0, #6f9c66); }
    #kirigami-panel .kv-check { display: flex; gap: 8px; align-items: center; margin-top: 10px; cursor: pointer; }
    #kirigami-panel .kv-check input { width: 18px; height: 18px; accent-color: #d8b36a; }
    #kirigami-panel .kv-help { margin: 8px 0 0; color: #bfae90; }`;
  document.head.append(style); document.body.append(root);
  return root;
}

export async function startKirigamiViewer(canvas: HTMLCanvasElement) {
  document.body.classList.add('kirigami-viewer'); document.title = 'Kirigami pine · Exploritaire';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const viewport=createBookViewport(renderer,canvas);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#171d21'); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .05, 100);
  const home = { pos: new THREE.Vector3(3.2, 3.6, 7.4), target: new THREE.Vector3(-.9, 1.2, -1.1) };
  camera.position.copy(home.pos);
  const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true; orbit.target.copy(home.target);
  orbit.minDistance = 1; orbit.maxDistance = 30; orbit.maxPolarAngle = Math.PI / 2 - .02;

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a3c, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2); sun.position.set(3.5, 7, 4.5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 20 }); sun.shadow.bias = -.0004;
  scene.add(sun);

  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 1 }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.z = -1.2; sheet.receiveShadow = true; scene.add(sheet);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#2a2019', roughness: 1 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -.03; table.receiveShadow = true; scene.add(table);

  const tex = await trimmedTexture(PINE, renderer);
  const pine = createKirigamiPine(tex, HEIGHT);
  pine.hole.position.y = .004; pine.hinge.position.y = .012; scene.add(pine.hole, pine.hinge);

  const spriteW = HEIGHT * tex.image.width / tex.image.height;
  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(spriteW, HEIGHT), new THREE.MeshStandardMaterial({ map: tex, alphaTest: .06, side: THREE.DoubleSide, roughness: 1 }));
  sprite.position.set(-2.6, HEIGHT / 2, .2); sprite.castShadow = true;
  sprite.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .06 });
  scene.add(sprite);

  const ui = panel();
  const slider = ui.querySelector<HTMLInputElement>('#kv-progress')!, value = ui.querySelector('output')!, stage = ui.querySelector('#kv-stage')!;
  const loopBtn = ui.querySelector<HTMLButtonElement>('#kv-loop')!;
  let progress = 1, target: number | null = null, loop = false;
  const deg = (r: number) => Math.round(r * 180 / Math.PI);
  function apply(n: number) {
    progress = THREE.MathUtils.clamp(n, 0, 1); pine.pose(progress);
    const { stand, v } = kirigamiPinePose(progress);
    slider.value = String(progress * 100); value.textContent = Math.round(progress * 100) + '%';
    stage.textContent = `Stand ${deg(stand * Math.PI / 2)}° · Centre fold ${deg(v * 2)}° between halves${progress === 0 ? ' · flat in its cut' : ''}`;
    canvas.dataset.kirigamiProgress = progress.toFixed(3);
  }
  slider.addEventListener('input', () => { target = null; loop = false; loopBtn.setAttribute('aria-pressed', 'false'); apply(Number(slider.value) / 100); });
  ui.querySelector('#kv-flatten')!.addEventListener('click', () => { target = 0; });
  ui.querySelector('#kv-unfold')!.addEventListener('click', () => { target = 1; });
  loopBtn.addEventListener('click', () => { loop = !loop; loopBtn.setAttribute('aria-pressed', String(loop)); target = loop ? (progress > .5 ? 0 : 1) : null; });
  ui.querySelector('#kv-reset')!.addEventListener('click', () => { camera.position.copy(home.pos); orbit.target.copy(home.target); orbit.update(); });
  ui.querySelector<HTMLInputElement>('#kv-sprite')!.addEventListener('change', e => { sprite.visible = (e.target as HTMLInputElement).checked; });

  function resize() { const w = innerWidth, h = innerHeight; viewport.resize(w,h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize(); apply(1);

  let last = performance.now(), pause = 0;
  renderer.setAnimationLoop(now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (pause > 0) pause -= dt;
    else if (target !== null) {
      const step = dt / DURATION, next = progress + Math.sign(target - progress) * step;
      const done = Math.abs(target - progress) <= step;
      apply(done ? target : next);
      if (done) { if (loop) { target = target === 1 ? 0 : 1; pause = .8; } else target = null; }
    }
    orbit.update(); renderer.render(scene, camera); presentBookFrame(canvas);
  });
  
}
