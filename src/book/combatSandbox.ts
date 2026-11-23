import {presentBookFrame} from './bootPresentation';
import {createBookPaper} from './bookPaper';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createTableauGroundCover } from '../proto/tableauGroundCover';
import { paintedPopupGeometry } from './paintedPopupGeometry';
import { fitBookBounds } from './responsiveFraming';
import {createBookViewport,bookRenderQuality,setBookRenderQuality,type BookRenderQuality} from './viewportPolicy';
import { ARENA_BOUNDS, arenaTrees, BOOK_SANDBOXES } from './combatSandboxConfig';

/** Presentation hook for future combat wiring. No campaign or authoring saves. */
export async function startBookCombatSandbox(canvas: HTMLCanvasElement) {
  document.body.classList.add('book-combat-sandbox'); document.title = 'Combat sandbox · Hero’s Journey';
  canvas.setAttribute('aria-label', 'Book combat arena. Hero on the left, dark slime on the right. Middle drag to rotate, right drag or WASD to pan, scroll to zoom.');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const viewport=createBookViewport(renderer,canvas);renderer.setClearColor('#171d21');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const bookPaper=createBookPaper(renderer,undefined,matchMedia('(max-width:700px)').matches?768:1024);canvas.dataset.paperProfile=bookPaper.profile;
  const world = new THREE.Scene(), props = new THREE.Group(); world.add(props);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
  const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true;
  orbit.mouseButtons.LEFT = null; orbit.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE; orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  orbit.minDistance = 2.75; orbit.maxDistance = 120; orbit.maxPolarAngle = Math.PI / 2 - .15;
  orbit.minAzimuthAngle = -Math.PI / 6; orbit.maxAzimuthAngle = Math.PI / 6;
  world.add(new THREE.HemisphereLight(0xfff5e6, 0x536c77, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1db, 1.6); sun.position.set(-4, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 8, bottom: -8, near: .1, far: 30 });
  sun.shadow.normalBias = .035; world.add(sun);
  const book = new THREE.Group(); world.add(book);
  function box(w: number, h: number, d: number, color: string, x: number, y: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.position.set(x, y, 0); m.receiveShadow = true; book.add(m);return m;
  }
  // Same open spread, page stack, gutter and cover dimensions as the story book.
  box(12.1, .2, 7.9, '#354c43', 0, -.37); box(12, .055, 7.8, '#b69c65', 0, -.24);
  for (const side of [-1, 1]) {
    box(5.8, .28, 7.5, '#d4c5a5', side * 2.95, -.07);
    for (let j = 0; j < 7; j++) box(5.8, .008, 7.5, '#ad9c7e', side * 2.95, -.19 + j * .035);
    const sheet=box(5.8,.04,7.5,'#ffffff',side*2.95,.09);sheet.material.map=side===-1?bookPaper.left:bookPaper.right;
  }
  box(.09, .045, 7.5, '#a58b62', 0, .12);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#202b2d', roughness: 1 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -.48; table.receiveShadow = true; world.add(table);
  const loader = new THREE.TextureLoader();
  async function texture(path: string, frame?: [number, number, number, number], mirror = false) {
    const source = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${path}`), image = source.image as HTMLImageElement;
    const [x, y, w, h] = frame ?? [0, 0, image.width, image.height];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (px[(j * w + i) * 4 + 3] > 12) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
    const crop = document.createElement('canvas'); crop.width = x1 - x0 + 1; crop.height = y1 - y0 + 1;
    const out = crop.getContext('2d')!; if (mirror) { out.translate(crop.width, 0); out.scale(-1, 1); }
    out.drawImage(c, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const result = new THREE.CanvasTexture(crop); result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    result.userData.sourceCrop = { x: x0 / w, y: y0 / h, width: crop.width / w, height: crop.height / h };
    source.dispose(); return result;
  }
  const [pine, hero, enemy, dirtSource, depthSource] = await Promise.all([
    texture('environment/watercolor/v1/pine-relief-v1.png'),
    texture('characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png', [41, 289, 272, 248], true),
    texture('characters/dark-slime/rig/watercolor/v1/dark-slime-directions-watercolor-v1.png', [449, 102, 360, 281]),
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/dirt-ground-v1.png`),
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/labs/depth-relief/pine-depth.png`),
  ]);
  dirtSource.colorSpace = THREE.SRGBColorSpace;
  const depth = document.createElement('canvas'); depth.width = depthSource.image.width; depth.height = depthSource.image.height;
  depth.getContext('2d')!.drawImage(depthSource.image, 0, 0); depthSource.dispose();
  const ground = new THREE.Group(); ground.position.y = .135; world.add(ground);
  for (const side of [-1, 1]) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 7.1), new THREE.MeshStandardMaterial({ map: dirtSource, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(side * 2.95, 0, 0); floor.receiveShadow = true; ground.add(floor);
    const cover = createTableauGroundCover(ground, false, 'woodland', undefined, false,
      { minX: side === -1 ? -5.65 : .15, maxX: side === -1 ? -.15 : 5.65, minZ: -3.5, maxZ: 3.5, islands: 80, grassScale: .24, grass: true });
    // Additional small tufts across the center, including the combatant anchors.
    for (let z = -3; z <= 3; z += .8) for (let x = side === -1 ? -5 : .5; x < (side === -1 ? 0 : 5.5); x += .85) cover.plant(x, z, .27, 0);
  }
  // All clutter is static here: merge by material once, rather than hundreds of draws.
  ground.traverse(root => {
    if (root.name !== 'tableau-ground-cover') return;
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of root.children) if (child instanceof THREE.Mesh && !Array.isArray(child.material)) { const list = batches.get(child.material) ?? []; list.push(child); batches.set(child.material, list); }
    for (const [material, meshes] of batches) {
      const pieces = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const geometry = mergeGeometries(pieces); pieces.forEach(g => g.dispose());
      if (geometry) { root.add(new THREE.Mesh(geometry, material)); meshes.forEach(m => root.remove(m)); }
    }
  });
  const treeData = arenaTrees(), treeMaterial = new THREE.MeshStandardMaterial({ map: pine, alphaTest: .12, side: THREE.DoubleSide, roughness: 1 });
  const geometry = paintedPopupGeometry(pine.image.width / pine.image.height, 1, pine, depth); geometry.translate(0, .5, 0);
  const trees = new THREE.InstancedMesh(geometry, treeMaterial, treeData.length), matrix = new THREE.Matrix4();
  trees.castShadow = true; trees.receiveShadow = true;
  trees.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: pine, alphaTest: .12 });
  treeData.forEach((t, i) => { matrix.makeScale(t.height, t.height, t.height); matrix.setPosition(t.x, .16, t.z); trees.setMatrixAt(i, matrix); });
  trees.computeBoundingSphere(); world.add(trees);
  function combatant(id: string, tex: THREE.Texture, x: number, height: number) {
    const hinge = new THREE.Group(); hinge.name = id; hinge.userData.paperHinge = true; hinge.position.set(x, .16, .25); props.add(hinge);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * tex.image.width / tex.image.height, height),
      new THREE.MeshStandardMaterial({ map: tex, alphaTest: .08, side: THREE.DoubleSide, roughness: 1 }));
    mesh.position.y = height / 2; mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .08 }); hinge.add(mesh); return hinge;
  }
  const heroProp = combatant('combat-hero', hero, -1.175, .825), enemyProp = combatant('combat-enemy', enemy, 1.175, .725);

  let width = 0, height = 0, framingMode='auto';
  const settings=document.createElement('details');settings.id='book-arena-settings';settings.innerHTML='<summary title="Arena framing and quality" aria-label="Arena framing and quality">⚙</summary><div><label>Composition<select aria-label="Arena composition"><option value="auto">Adaptive</option><option value="arena">Whole arena</option><option value="duel">Combat focus</option></select></label><label>Render quality<select aria-label="Render quality"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><small>1920 × 1080 design frame</small></div>';
  document.querySelector('#book-right-tools')!.append(settings);
  settings.querySelector<HTMLSelectElement>('[aria-label="Arena composition"]')!.onchange=e=>{framingMode=(e.target as HTMLSelectElement).value;reset();};
  const quality=settings.querySelector<HTMLSelectElement>('[aria-label="Render quality"]')!;quality.value=bookRenderQuality();quality.onchange=()=>setBookRenderQuality(quality.value as BookRenderQuality);
  function reset() {
    const portrait=framingMode==='duel'||framingMode==='auto'&&width/height<.85;
    const bounds = portrait ? new THREE.Box3(new THREE.Vector3(-2.3,.1,-1.5),new THREE.Vector3(2.3,1.25,2)) : new THREE.Box3().setFromObject(book).union(new THREE.Box3().setFromObject(trees)).union(new THREE.Box3().setFromObject(props));
    const shot = fitBookBounds(bounds, {position: [0, 11.5, 13.5], target: [0, .6, 0], fov: 38},
      {width, height}, {x: 18, y: 50, width: Math.max(1, width - 36), height: Math.max(1, height - 100)}, .04);
    camera.position.fromArray(shot.position); orbit.target.fromArray(shot.target); camera.lookAt(orbit.target); orbit.update();
    canvas.dataset.composition=portrait?'combat-focus':'whole-arena';
  }
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight;viewport.resize(w,h); if (w === width && h === height) return; width = w; height = h; camera.aspect = w / h; camera.updateProjectionMatrix(); reset(); }
  document.querySelector<HTMLButtonElement>('#reset')!.onclick = reset;
  const keys = new Set<string>();
  addEventListener('keydown', e => { if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) { e.preventDefault(); keys.add(e.code); } });
  addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
  addEventListener('resize', resize); resize();
  const fps = document.querySelector<HTMLOutputElement>('#fps-readout')!;
  let last = performance.now(), elapsed = 0, frames = 0;
  const offset = new THREE.Vector3(), right = new THREE.Vector3(), forward = new THREE.Vector3();
  renderer.shadowMap.needsUpdate = true;
  renderer.setAnimationLoop(now => {
    const realDt = (now - last) / 1000, dt = Math.min(.05, realDt); last = now;
    right.setFromMatrixColumn(camera.matrix, 0); right.y = 0; right.normalize(); forward.crossVectors(new THREE.Vector3(0, 1, 0), right);
    offset.set(0, 0, 0).addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA'))).addScaledVector(forward, Number(keys.has('KeyS')) - Number(keys.has('KeyW'))).multiplyScalar(dt * 4);
    camera.position.add(offset); orbit.target.add(offset); orbit.update(); renderer.render(world, camera); presentBookFrame(canvas);
    elapsed += realDt; frames++;
    if (elapsed >= .5) { fps.textContent = `${Math.round(frames / elapsed)} FPS · ${renderer.info.render.calls} draws`; elapsed = 0; frames = 0; }
  });
  // Public readiness event is the mounting seam for the future battle controller.
  Object.assign(canvas.dataset, { sandbox: 'combat', sceneIndex: BOOK_SANDBOXES.combat.id, trees: String(treeData.length), combatants: 'hero,enemy', pagesOpen: 'true' });
  dispatchEvent(new CustomEvent('book:combat-sandbox-ready', { detail: { id: BOOK_SANDBOXES.combat.id, world, book, camera, hero: heroProp, enemy: enemyProp, bounds: { ...ARENA_BOUNDS } } }));
}
