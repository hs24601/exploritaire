import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gameTime } from '../../gameTime';
import { loadMediaTexture } from '../mediaTexture';
import { createTableauLandscape, type ExtraLandscapeProp } from '../tableauLandscape';
import { attachTableauFreecam } from '../tableauFreecam';
import { rng } from '../bushPainter';
import { PINE_DEFAULT_PRESET, PINE_PAINTER_VERSION, type PinePaintPreset } from '../pinePainter';
import { paintOffThread } from '../paintWorkerClient';
import { setGlobalLightsEnabled, useGlobalLights } from '../globalLighting';
import { GlobalPauseControl, useGlobalPauseLifecycle } from './GlobalPause';
import './BushSandbox.css';

const ASSETS = `${import.meta.env.BASE_URL}assets/runtime`;
const IMAGEGEN_PINE = `${ASSETS}/environment/watercolor/v1/pine-sprite-v1.png`;
// Woods height proportions: immersive painted woods and pines are height 8.
const PINE_HEIGHT = 8, SPACING = 4.2, DEPTH = -9;
// The woods tableau's three depth tints, nearest first.
const LAYER_TINTS = [0xacc6c7, 0x718f9e, 0x486779];

type Settings = Omit<PinePaintPreset, 'seed'> & {
  seed: number; size: 256 | 512; variants: number; density: number; layers: number; variety: number;
  woods: boolean; combat: boolean; lit: boolean; swap: boolean; moon: number; azimuth: number; ambient: number;
};
const DEFAULTS: Settings = { ...PINE_DEFAULT_PRESET, size: 512, variants: 4, density: 24, layers: 3, variety: .3,
  woods: true, combat: false, lit: false, swap: false, moon: 1, azimuth: 211, ambient: 1 };

/** Painted rows of the cutout: the visible tree, not its transparent margin. */
function paintedHeight(image: CanvasImageSource & { width: number; height: number }) {
  const scan = document.createElement('canvas'); scan.width = image.width; scan.height = image.height;
  const ctx = scan.getContext('2d')!; ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (data[(y * image.width + x) * 4 + 3] > 40) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? 1 : (bottom - top + 1) / image.height;
}

/** A backdrop slot: the ImageGen half and the procedural half mirror each other,
 * so both sides get the same spacing, heights and depth layers. */
type Slot = { x: number; z: number; scale: number; layer: number };
function backdrop(count: number, layers: number, variety: number): Slot[] {
  const random = rng(0x5eed + count * 31 + layers), slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const layer = i % layers, z = DEPTH - 6 - layer * 9 - random() * 5, x = 2.5 + random() * (10 + layer * 6);
    slots.push({ x, z, scale: 1 + (random() - .5) * 2 * variety, layer });
  }
  return slots;
}

/** Proto sandbox: the approved ImageGen pine and the procedural pine staged
 * head to head in the game's shared woods landscape (sky, stars, terrain, fog,
 * depth tints, sway and freecam), with a mirrored backdrop forest of each
 * behind them. Lit cutouts and the light sliders are preview-only. */
export function WoodsSandbox() {
  useGlobalPauseLifecycle();
  const lightsOn = useGlobalLights();
  const field = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [status, setStatus] = useState('Preparing scene…');
  const [bake, setBake] = useState<{ firstMs: number; wallMs: number; count: number; size: number; offThread: number } | null>(null);
  const live = useRef(settings); live.current = settings;
  const stage = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; schedule: () => void; landscape?: ReturnType<typeof createTableauLandscape>; textures: THREE.Texture[] } | null>(null);
  const [stageReady, setStageReady] = useState(0);
  // Finished bakes, keyed by painter version and full preset, so moving a scene
  // slider never repaints a pine it already holds. Bounded like the bush cache.
  const cache = useRef(new Map<string, { canvas: HTMLCanvasElement; ms: number; offThread: boolean }>());
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));

  // Renderer, camera, freecam and frame loop persist across scene rebuilds.
  useEffect(() => {
    const element = field.current; if (!element) return;
    // Native frames keep the freecam usable while the game is paused; sway
    // follows the game clock, so pause still freezes it.
    let disposed = false, frame = 0, last = performance.now();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 120);
    camera.position.set(0, 4.5, 8); camera.lookAt(0, 4.5, DEPTH);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(render); };
    const controls = attachTableauFreecam(element, camera, schedule);
    const render = (now: number) => {
      frame = 0;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height || document.hidden) return;
      controls.update(Math.min(.05, (now - last) / 1000)); last = now;
      const seconds = gameTime.now() / 1000;
      if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio())) renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      const landscape = stage.current?.landscape;
      if (landscape) {
        landscape.update(camera, seconds, reduced.matches);
        // Preview light controls scale the game's own moon and sky after its update.
        const { moon, ambient, azimuth } = live.current, angle = THREE.MathUtils.degToRad(azimuth);
        landscape.lights.moon.intensity *= moon; landscape.lights.hemisphere.intensity *= ambient;
        landscape.lights.moon.position.set(Math.cos(angle) * 6, 10, Math.sin(angle) * 6);
      }
      renderer.render(scene, camera);
      element.dataset.cameraPosition = camera.position.toArray().map(n => n.toFixed(2)).join(',');
      schedule();
    };
    const resize = new ResizeObserver(schedule); resize.observe(element);
    const visibility = () => { if (!document.hidden) schedule(); };
    document.addEventListener('visibilitychange', visibility);
    stage.current = { scene, camera, schedule, textures: [] };
    setStageReady(value => value + 1);
    schedule();
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      resize.disconnect(); controls.dispose();
      stage.current?.landscape?.dispose(); stage.current?.textures.forEach(texture => texture.dispose()); stage.current = null;
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  // Rebuild the landscape when the art or a structural option changes. Light
  // sliders apply live without a rebuild.
  const { seed, slender, fullness, droop, trunk, brush, warmth, size, variants, density, layers, variety, woods, combat, lit, swap } = settings;
  useEffect(() => {
    const current = stage.current; if (!current) return;
    let cancelled = false;
    const textures: THREE.Texture[] = [];
    const prepare = (texture: THREE.Texture) => { texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; return texture; };
    void (async () => {
      try {
        setStatus('Loading ImageGen pine…');
        const pine = prepare(await loadMediaTexture(IMAGEGEN_PINE)); textures.push(pine);
        if (cancelled) return;
        // One variant per seed step; the lead pine uses the chosen seed itself.
        const presets = Array.from({ length: variants }, (_, k): PinePaintPreset => ({ seed: seed + k * 7919, slender, fullness, droop, trunk, brush, warmth }));
        setStatus(`Baking ${variants} procedural pine${variants > 1 ? 's' : ''} (${size}px)…`);
        const started = performance.now();
        const baked = await Promise.all(presets.map(async preset => {
          const key = `${PINE_PAINTER_VERSION}:${size}:${JSON.stringify(preset)}`, hit = cache.current.get(key);
          if (hit) return { ...hit, cached: true };
          // Painted in the paint worker; raw pixels come back for the texture.
          const painted = await paintOffThread({ kind: 'pine', preset, size }), raster = painted.raster!;
          const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
          canvas.getContext('2d')!.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
          const entry = { canvas, ms: painted.paintMs, offThread: painted.offThread };
          cache.current.set(key, entry); if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value!);
          return { ...entry, cached: false };
        }));
        const wallMs = performance.now() - started;
        if (cancelled) return;
        const procedural = baked.map(({ canvas }) => { const texture = prepare(new THREE.CanvasTexture(canvas)); textures.push(texture); return texture; });
        // Match painted tree heights, not canvas heights: each cutout has its own margin.
        const pineScale = PINE_HEIGHT / paintedHeight(pine.image as HTMLImageElement);
        const procScale = baked.map(({ canvas }) => PINE_HEIGHT / paintedHeight(canvas));
        const side = swap ? -1 : 1, slots = backdrop(density, layers, variety);
        // The ImageGen half uses the landscape's own prop path (shared texture, tints and sway);
        // the procedural half mirrors every slot across the centre line.
        const props = [{ x: -side * SPACING, z: DEPTH, height: pineScale },
          ...slots.map(s => ({ x: -side * s.x, z: s.z, height: pineScale * s.scale, tint: LAYER_TINTS[s.layer] }))];
        const extra: ExtraLandscapeProp[] = [{ texture: procedural[0], x: side * SPACING, z: DEPTH, height: procScale[0] },
          ...slots.map((s, i) => { const k = (i + 1) % procedural.length; return { texture: procedural[k], x: side * s.x, z: s.z, height: procScale[k] * s.scale, tint: LAYER_TINTS[s.layer] }; })];
        // Swap scenes in one step; the previous scene and its art are released only now.
        current.landscape?.dispose(); current.textures.forEach(texture => texture.dispose());
        current.textures = textures.splice(0);
        current.landscape = createTableauLandscape(current.scene, pine, woods, combat, { props, groundCover: { pixel: false }, extraProps: extra, litProps: lit });
        const fresh = baked.filter(b => !b.cached);
        setBake({ firstMs: baked[0].ms, wallMs, count: fresh.length, size, offThread: fresh.filter(b => b.offThread).length });
        setStatus('');
        current.schedule();
      } catch (error) {
        if (!cancelled) setStatus(`Scene failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    })();
    // A superseded build releases only the art it never installed.
    return () => { cancelled = true; textures.forEach(texture => texture.dispose()); };
  }, [stageReady, seed, slender, fullness, droop, trunk, brush, warmth, size, variants, density, layers, variety, woods, combat, lit, swap]);

  const slider = (key: 'slender' | 'fullness' | 'droop' | 'trunk' | 'brush' | 'warmth' | 'variants' | 'density' | 'layers' | 'variety' | 'moon' | 'ambient' | 'azimuth', label: string, min: number, max: number, step: number) =>
    <label className="bush-sandbox__row">{label}<input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => set(key, Number(event.target.value))} /><output>{settings[key]}</output></label>;
  const toggle = (key: 'woods' | 'combat' | 'lit' | 'swap', label: string) =>
    <label className="bush-sandbox__check"><input type="checkbox" checked={settings[key]} onChange={event => set(key, event.target.checked)} />{label}</label>;
  const bakeLine = bake && (bake.count
    ? `Baked ${bake.count} pine${bake.count > 1 ? 's' : ''} at ${bake.size}px in ${bake.wallMs.toFixed(0)} ms (lead ${bake.firstMs.toFixed(0)} ms; ${bake.offThread === bake.count ? 'paint worker' : bake.offThread ? `${bake.offThread} in worker, ${bake.count - bake.offThread} main thread` : 'main thread'})`
    : `All pines from cache (${PINE_PAINTER_VERSION}, ${bake.size}px)`);

  return <main className="bush-sandbox">
    <header className="bush-sandbox__header">
      <h1>Woods sandbox · ImageGen vs procedural pine</h1>
      <GlobalPauseControl />
      <button onClick={() => setSettings(DEFAULTS)}>Reset</button>
      <a href="proto.html">Proto</a>
    </header>
    <div className="bush-sandbox__body">
      <aside className="bush-sandbox__panel" aria-label="Sandbox controls">
        <p className="bush-sandbox__legend">{swap ? 'Left: procedural · Right: ImageGen' : 'Left: ImageGen · Right: procedural'}</p>
        <fieldset><legend>Procedural pine</legend>
          <label className="bush-sandbox__row">Seed<input type="number" value={seed} onChange={event => set('seed', Math.max(0, Math.floor(Number(event.target.value) || 0)))} /><button onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>Random</button></label>
          {slider('slender', 'Slender', 0, 1, .05)}{slider('fullness', 'Fullness', 0, 1, .05)}{slider('droop', 'Droop', 0, 1, .05)}{slider('trunk', 'Trunk', 0, 1, .05)}{slider('brush', 'Brush', 0, 1, .05)}{slider('warmth', 'Warmth', 0, 1, .05)}
          <label className="bush-sandbox__row">Bake size<select value={size} onChange={event => set('size', Number(event.target.value) as 256 | 512)}><option value={256}>256px</option><option value={512}>512px</option></select></label>
        </fieldset>
        <fieldset><legend>Backdrop forest</legend>
          {slider('density', 'Trees per side', 0, 60, 1)}{slider('layers', 'Depth layers', 1, 3, 1)}{slider('variety', 'Height variety', 0, .6, .05)}{slider('variants', 'Pine variants', 1, 8, 1)}
          <p className="bush-sandbox__note">Each side mirrors the other's slots, so spacing, heights and depth tints match. Procedural variants step the seed.</p>
        </fieldset>
        <fieldset><legend>Scene</legend>
          {toggle('woods', 'Woods (sky, stars, terrain, fog)')}{toggle('combat', 'Combat scenery tint')}{toggle('swap', 'Swap sides')}
          <label className="bush-sandbox__check"><input type="checkbox" checked={lightsOn} onChange={event => setGlobalLightsEnabled(event.target.checked)} />Global lights (game setting)</label>
        </fieldset>
        <fieldset><legend>Lighting preview</legend>
          {toggle('lit', 'Lit cutouts (preview, not shipped)')}
          {slider('moon', 'Moon', 0, 2.5, .05)}{slider('azimuth', 'Moon azimuth', 0, 359, 1)}{slider('ambient', 'Ambient', 0, 2, .05)}
          <p className="bush-sandbox__note">Game scenery cutouts are unlit: moon and ambient change the ground and (with lit cutouts) every pine.</p>
        </fieldset>
        <p className="bush-sandbox__stat" role="status">{status || bakeLine}</p>
        <p className="bush-sandbox__note">Drag empty scene to orbit · Shift/right drag to pan · wheel to zoom · click the scene, then WASD to move and Q/E for height.</p>
      </aside>
      <div ref={field} className="bush-sandbox__scene" aria-label="Pine comparison scene" />
    </div>
  </main>;
}
