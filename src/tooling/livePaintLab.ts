import * as THREE from 'three';
import { HERO_DIRECTIONAL_SPRITE } from '../proto/directionalSprites';
import { BATTLE_SPRITE_ASSETS } from '../proto/battleSpriteAssets';
import { paintVertexShader, paintFragmentShader } from '../watercolor/kuwaharaShader';
import './livePaintLab.css';

// An isolated styling spike. No gameplay, save data or default renderer changes.
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const controls = element<HTMLFormElement>('paint-controls');
controls.addEventListener('submit', event => event.preventDefault());
const error = element<HTMLParagraphElement>('paint-error');
const base = `${import.meta.env.BASE_URL}assets/`;

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); // Explicit bounded render budget, independent of device DPR.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#27382e');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.z = 10;
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const uniforms = {
    source: { value: target.texture }, resolution: { value: new THREE.Vector2(1, 1) },
    brush: { value: 3 }, strength: { value: .75 }, time: { value: 0 },
    wash: { value: 0 }, mode: { value: 1 },
  };
  const postScene = new THREE.Scene();
  const postMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: paintVertexShader, fragmentShader: paintFragmentShader, depthTest: false, depthWrite: false });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));
  const loader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  async function load(path: string) {
    const texture = await loader.loadAsync(base + path);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  }
  const [background, den, woods, portrait, sheet, eevee] = await Promise.all([
    load('runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png'),
    load('runtime/environment/watercolor/v1/hero-den-sprite-v2.png'),
    load('runtime/environment/watercolor/v1/woods-cluster-sprite-v1.png'),
    load('runtime/kin/hero/portraits/ordinary-day/hero-watercolor-v5-ordinary-day.png'),
    load(BATTLE_SPRITE_ASSETS.heroHigh),
    load('runtime/labs/live-paint/eevee.png'),
  ]);
  // Crop the authored world frame using its shared atlas definition, never guessed bounds.
  const frame = HERO_DIRECTIONAL_SPRITE.high[0];
  const [x, y, w, h] = frame.parts[0].rect;
  const crop = document.createElement('canvas'); crop.width = w; crop.height = h;
  crop.getContext('2d')!.drawImage(sheet.image, x, y, w, h, 0, 0, w, h);
  const worldHero = new THREE.CanvasTexture(crop); worldHero.colorSpace = THREE.SRGBColorSpace; textures.push(worldHero);
  function sprite(texture: THREE.Texture, height: number, x: number, y: number, z: number) {
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.scale.set(height * texture.image.width / texture.image.height, height, 1);
    mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  }
  const backdrop = sprite(background, 2, 0, 0, -4);
  sprite(woods, 1.65, -1.3, .2, -2);
  sprite(woods, 1.45, 1.3, .28, -2);
  sprite(den, 1.05, -.7, -.26, -1);
  const hero = sprite(worldHero, .75, .3, -.35, 1);
  const view = element<HTMLSelectElement>('view');
  view.addEventListener('change', () => {
    uniforms.mode.value = { original: 0, split: 1, paint: 2 }[view.value]!;
    document.querySelector<HTMLElement>('.paint-labels')!.style.visibility = view.value === 'split' ? 'visible' : 'hidden';
  });
  const subjects: Record<string, THREE.Texture> = { world: worldHero, portrait, eevee };
  element<HTMLSelectElement>('subject').addEventListener('change', event => {
    const texture = subjects[(event.target as HTMLSelectElement).value] ?? worldHero;
    hero.material.map = texture;
    hero.scale.set(.85 * texture.image.width / texture.image.height, .85, 1);
  });
  for (const name of ['brush', 'strength'] as const) {
    const input = element<HTMLInputElement>(name);
    input.addEventListener('input', () => {
      uniforms[name].value = Number(input.value) * (name === 'brush' ? target.width / canvas.clientWidth : 1);
      element<HTMLOutputElement>(`${name}-value`).value = name === 'strength' ? `${Math.round(Number(input.value) * 100)}%` : input.value;
    });
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = element<HTMLInputElement>('motion');
  motion.addEventListener('change', () => { uniforms.wash.value = motion.checked ? 1 : 0; });
  let paused = reducedMotion;
  const pause = element<HTMLButtonElement>('pause');
  function pauseLabel() { pause.textContent = paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', String(paused)); }
  pauseLabel();
  pause.addEventListener('click', () => { paused = !paused; pauseLabel(); });
  let aspect = 1;
  const resolution = element<HTMLSelectElement>('resolution');
  function resize() {
    aspect = canvas.clientWidth / canvas.clientHeight;
    camera.left = -aspect; camera.right = aspect; camera.updateProjectionMatrix();
    const scale = Math.min(1, 1280 / canvas.clientWidth, 720 / canvas.clientHeight) * Number(resolution.value);
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    renderer.setSize(width, height, false); target.setSize(width, height);
    uniforms.resolution.value.set(width, height);
    // Brush size stays in CSS pixels while changing the render resolution.
    uniforms.brush.value = Number(element<HTMLInputElement>('brush').value) * scale;
    backdrop.scale.set(Math.max(2 * aspect, 2 * background.image.width / background.image.height), Math.max(2, 2 * aspect * background.image.height / background.image.width), 1);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  resolution.addEventListener('change', resize); resize();
  let destination = .3, destinationY = -.35;
  function point(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    destination = ((event.clientX - rect.left) / rect.width * 2 - 1) * aspect;
    destinationY = THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -.65, .25);
  }
  canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); point(event); });
  canvas.addEventListener('pointermove', event => { if (canvas.hasPointerCapture(event.pointerId)) point(event); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  let previous = performance.now(), report = previous, frames = 0, elapsed = 0;
  renderer.setAnimationLoop(now => {
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (document.hidden) return;
    if (!paused) {
      elapsed += dt; uniforms.time.value = elapsed;
      hero.position.x = THREE.MathUtils.damp(hero.position.x, destination, 5, dt);
      hero.position.y = THREE.MathUtils.damp(hero.position.y, destinationY, 5, dt);
    }
    // Composite alpha sprites first, then filter opaque scene color. UI stays outside the pass.
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, camera);
    frames++;
    if (now - report > 1000) {
      element<HTMLOutputElement>('performance').value = `${Math.round(frames * 1000 / (now - report))} fps · ${target.width}×${target.height}`;
      report = now; frames = 0;
    }
    canvas.dataset.ready = 'true';
    canvas.dataset.heroX = hero.position.x.toFixed(3);
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null); observer.disconnect();
    for (const texture of textures) texture.dispose();
    for (const root of [scene, postScene]) root.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); object.material.dispose(); }
    });
    target.dispose(); renderer.dispose();
  }, { once: true });
}
start().catch(reason => { error.hidden = false; error.textContent = `Live paint test could not start: ${reason instanceof Error ? reason.message : String(reason)}`; });

