import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEPTH_ASSETS } from './depthLabAssets';
import { pineDepthGeometry } from './pineDepthGeometry';
import profile from './depthLabPine.json';
import './depthLab.css';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const asset = get<HTMLSelectElement>('asset'), method = get<HTMLSelectElement>('method');
const depth = get<HTMLInputElement>('depth'), light = get<HTMLInputElement>('light');
const spin = get<HTMLInputElement>('spin'), probeToggle = get<HTMLInputElement>('probe');
const rear = get<HTMLInputElement>('rear'), front = get<HTMLInputElement>('front');
const caption = get<HTMLOutputElement>('caption');
get<HTMLFormElement>('depth-controls').onsubmit = event => event.preventDefault();

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#d7d1bd');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  camera.position.set(0, 2.25, 8.4);
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, 1.5, 0); orbit.enableDamping = true;
  orbit.minDistance = 4; orbit.maxDistance = 13;
  orbit.minPolarAngle = .35; orbit.maxPolarAngle = Math.PI / 2 - .02;
  orbit.enablePan = false; orbit.update();
  const ambient = new THREE.AmbientLight('#fff6e4', 1.4); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff4db', 2.2);
  sun.position.set(-3, 7, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -4; sun.shadow.normalBias = .025;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(5, 96), new THREE.MeshBasicMaterial({ color: '#c9c7ac' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; scene.add(ground);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: .23 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.012; shadow.receiveShadow = true; scene.add(shadow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.72, 1.735, 96), new THREE.MeshBasicMaterial({ color: '#898e79', side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -.005; scene.add(ring);
  // A real depth-tested object traverses the near and far sides of the artwork.
  const probe = new THREE.Mesh(new THREE.SphereGeometry(.13, 24, 16), new THREE.MeshStandardMaterial({ color: '#d08a31', roughness: .65 }));
  probe.castShadow = true; scene.add(probe);
  const loader = new THREE.TextureLoader(), textures = new Map<string, THREE.Texture>();
  await Promise.all(Object.values(DEPTH_ASSETS).flatMap(recipe => recipe.layers.map(async layer => {
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${layer.path}`);
    texture.colorSpace = THREE.SRGBColorSpace; textures.set(layer.path, texture);
  })));
  const model = new THREE.Group(); scene.add(model);
  const materials: THREE.MeshLambertMaterial[] = [];
  function material(texture: THREE.Texture, alphaTest: number) {
    const mat = new THREE.MeshLambertMaterial({ map: texture, emissiveMap: texture, emissive: 'white', color: 'black', alphaTest, side: THREE.DoubleSide });
    materials.push(mat); return mat;
  }
  function addPlane(texture: THREE.Texture, height: number, z: number, angle = 0, id = '') {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * texture.image.width / texture.image.height, height), material(texture, .18));
    mesh.position.set(0, height / 2, z); mesh.rotation.y = angle; mesh.name = id;
    mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map: texture, alphaTest: .18, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    model.add(mesh); return mesh;
  }
  function clearModel() {
    for (const child of [...model.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.customDepthMaterial as THREE.Material | undefined)?.dispose(); model.remove(child);
    }
    materials.splice(0).forEach(mat => mat.dispose());
  }
  function lighting() {
    const amount = Number(light.value) * .45;
    for (const mat of materials) { mat.color.setScalar(amount); mat.emissiveIntensity = 1 - amount; }
  }
  function build() {
    clearModel();
    const key = asset.value as keyof typeof DEPTH_ASSETS, recipe = DEPTH_ASSETS[key];
    const volumeOption = method.querySelector<HTMLOptionElement>('option[value=volume]')!;
    volumeOption.disabled = !recipe.volume;
    if (!recipe.volume && method.value === 'volume') method.value = 'layers';
    const separation = Number(depth.value);
    if (key === 'pine') {
      const texture = textures.get(recipe.layers[0].path)!;
      if (method.value === 'volume') {
        const mesh = new THREE.Mesh(pineDepthGeometry(separation), material(texture, .18));
        mesh.castShadow = true;
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ map: texture, alphaTest: .18, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
        model.add(mesh);
      } else {
        const height = 3 * profile.sourceHeight / (profile.bounds[3] - profile.bounds[1]);
        const bottomOffset = (profile.sourceHeight - profile.bounds[3]) / profile.sourceHeight * height;
        const count = method.value === 'layers' ? 4 : 1;
        for (let i = 0; i < count; i++) {
          const plane = addPlane(texture, height, 0, i / count * Math.PI);
          plane.position.y -= bottomOffset;
          if (count > 1) plane.scale.z = separation;
        }
      }
      caption.value = method.value === 'volume' ? 'Pine · wrapped painting · drag to orbit 360°' : method.value === 'layers' ? 'Pine · four intersecting PNG planes' : 'Pine · original flat PNG';
    } else {
      recipe.layers.forEach((layer, i) => {
        const mesh = addPlane(textures.get(layer.path)!, layer.height, method.value === 'flat' ? i * .003 : layer.depth * separation, 0, layer.id);
        // Shared center registration: front/rear gust canvases surround the subject.
        mesh.position.y = 1.6;
        mesh.visible = layer.id === 'rear' ? rear.checked : layer.id === 'front' ? front.checked : true;
      });
      caption.value = method.value === 'flat' ? 'Cir · layers aligned on one plane' : 'Cir · authored rear / subject / front PNG layers';
    }
    rear.disabled = front.disabled = key !== 'cir';
    depth.disabled = method.value === 'flat' || (key === 'pine' && method.value === 'layers');
    lighting(); canvas.dataset.asset = key; canvas.dataset.method = method.value;
  }
  asset.addEventListener('change', build); method.addEventListener('change', build);
  depth.addEventListener('input', build); light.addEventListener('input', lighting);
  rear.addEventListener('change', build); front.addEventListener('change', build);
  get<HTMLButtonElement>('reset').onclick = () => { camera.position.set(0, 2.25, 8.4); orbit.target.set(0, 1.5, 0); orbit.update(); };
  build();
  const observer = new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix();
  }); observer.observe(canvas);
  spin.checked = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous = performance.now(), elapsed = 0;
  renderer.setAnimationLoop(now => {
    const dt = Math.min(.05, (now - previous) / 1000); previous = now;
    if (document.hidden) return;
    elapsed += dt;
    orbit.autoRotate = spin.checked; orbit.autoRotateSpeed = .65; orbit.update(dt);
    probe.visible = probeToggle.checked;
    probe.position.set(Math.cos(elapsed * .65) * 1.72, 1.25, Math.sin(elapsed * .65) * 1.72);
    renderer.render(scene, camera);
    canvas.dataset.ready = 'true'; canvas.dataset.yaw = orbit.getAzimuthalAngle().toFixed(3);
    canvas.dataset.probeZ = probe.position.z.toFixed(3);
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null); observer.disconnect(); orbit.dispose(); clearModel();
    textures.forEach(texture => texture.dispose());
    for (const mesh of [ground, shadow, ring, probe]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    renderer.dispose();
  }, { once: true });
}
start().catch(reason => { const error = get<HTMLParagraphElement>('depth-error'); error.hidden = false; error.textContent = `Depth test could not start: ${String(reason)}`; });
