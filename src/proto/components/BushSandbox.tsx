import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gameTime } from '../../gameTime';
import { loadMediaTexture } from '../mediaTexture';
import { createTableauLandscape, type ExtraLandscapeProp } from '../tableauLandscape';
import { attachTableauFreecam } from '../tableauFreecam';
import { BUSH_MAX_FRUIT, planBush, type BushPaintPreset } from '../bushPainter';
import { paintOffThread } from '../paintWorkerClient';
import { setGlobalLightsEnabled, useGlobalLights } from '../globalLighting';
import { GlobalPauseControl, useGlobalPauseLifecycle } from './GlobalPause';
import './BushSandbox.css';

const ASSETS = `${import.meta.env.BASE_URL}assets/runtime`;
// The sparse bush exactly as the berry tableau stages it: the fruitless
// standee with the game's fruit and mana halo laid over it.
const IMAGEGEN_STANDEE = `${ASSETS}/environment/watercolor/v1/manaberry-sparse-standee-empty-v1.png`;
const FRUIT = `${ASSETS}/items/manaberry/manaberry-fruit-v1.svg`;
const IMAGEGEN_FRUIT = [{ x: .59, y: .47, size: .29 }];
const IMAGEGEN_HEIGHT = 8, SPACING = 3.6, DEPTH = -8;

type Settings = {
  seed: number; fullness: number; spread: number; brush: number; warmth: number;
  size: 256 | 512; berries: number; woods: boolean; combat: boolean; lit: boolean; mana: boolean; swap: boolean;
  moon: number; azimuth: number; ambient: number;
};
const DEFAULTS: Settings = { seed: 5150, fullness: .7, spread: 1, brush: .65, warmth: .6, size: 512, berries: 1, woods: false, combat: false, lit: false, mana: true, swap: false, moon: 1, azimuth: 211, ambient: 1 };

/** Painted rows of the cutout: the visible bush, not its transparent margin. */
function paintedHeight(image: CanvasImageSource & { width: number; height: number }) {
  const scan = document.createElement('canvas'); scan.width = image.width; scan.height = image.height;
  const ctx = scan.getContext('2d')!; ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (data[(y * image.width + x) * 4 + 3] > 40) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? 1 : (bottom - top + 1) / image.height;
}

/** Proto sandbox: the approved ImageGen bush and the procedural bush staged
 * side by side in the game's shared Three.js landscape, with its freecam,
 * fog, ground cover, mana halo and global lights. Lit cutouts and the light
 * sliders are preview-only; game scenery is unlit unless that changes. */
export function BushSandbox() {
  useGlobalPauseLifecycle();
  const lightsOn = useGlobalLights();
  const field = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [status, setStatus] = useState('Preparing scene…');
  const [bake, setBake] = useState<{ ms: number; size: number; seed: number; offThread: boolean } | null>(null);
  const live = useRef(settings); live.current = settings;
  const stage = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; schedule: () => void; landscape?: ReturnType<typeof createTableauLandscape>; textures: THREE.Texture[] } | null>(null);
  const [stageReady, setStageReady] = useState(0);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));

  // Renderer, camera, freecam and frame loop persist across scene rebuilds.
  useEffect(() => {
    const element = field.current; if (!element) return;
    // Native frames keep the freecam usable while the game is paused; scene
    // motion (halo pulse, sway) follows the game clock, so pause still freezes it.
    let disposed = false, frame = 0, last = performance.now();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
    camera.position.set(0, 6, 7); camera.lookAt(0, 5.2, -8);
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
  // sliders and the mana toggle apply live without a rebuild.
  const { seed, fullness, spread, brush, warmth, size, berries, woods, combat, lit, swap } = settings;
  // The ImageGen bush carries one painted fruit slot; it shows fruit whenever any remain.
  const fruit = berries > 0;
  useEffect(() => {
    const current = stage.current; if (!current) return;
    let cancelled = false;
    const textures: THREE.Texture[] = [];
    void (async () => {
      try {
        setStatus('Loading ImageGen bush…');
        const [standee, fruitTexture] = await Promise.all([loadMediaTexture(IMAGEGEN_STANDEE), loadMediaTexture(FRUIT)]);
        textures.push(standee, fruitTexture);
        setStatus(`Baking procedural bush (${size}px)…`);
        if (cancelled) return;
        const preset: BushPaintPreset = { seed, fullness, spread, brush, warmth, fruit: berries };
        // Painted in the paint worker; raw pixels come back for the texture.
        const painted = await paintOffThread({ kind: 'bush', preset, size }), raster = painted.raster!, ms = painted.paintMs;
        const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
        canvas.getContext('2d')!.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
        const procedural = new THREE.CanvasTexture(canvas); textures.push(procedural);
        for (const texture of [standee, procedural]) { texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; }
        fruitTexture.colorSpace = THREE.SRGBColorSpace;
        // Match painted bush heights, not canvas heights: each cutout has its own margin.
        const proceduralHeight = IMAGEGEN_HEIGHT * paintedHeight(standee.image as HTMLImageElement) / paintedHeight(canvas);
        // Its painted fruit keeps the game's blue mana halo at the planned position.
        const halos = planBush(preset, size).fruit.map(point => ({ x: point.x / size, y: point.y / size, size: point.r * 4.6 / size }));
        const left = swap ? SPACING : -SPACING;
        const extra: ExtraLandscapeProp = { texture: procedural, x: -left, z: DEPTH, height: proceduralHeight, manaFruit: halos, paintedFruit: true };
        if (cancelled) return;
        // Swap scenes in one step; the previous scene and its art are released only now.
        current.landscape?.dispose(); current.textures.forEach(texture => texture.dispose());
        current.textures = textures.splice(0);
        current.landscape = createTableauLandscape(current.scene, standee, woods, combat, {
          props: [{ x: left, z: DEPTH, height: IMAGEGEN_HEIGHT }], groundCover: { pixel: false },
          fruitTexture, manaFruit: IMAGEGEN_FRUIT, extraProps: [extra], litProps: lit,
        });
        current.landscape.setFruitVisible(live.current.berries > 0, live.current.mana);
        setBake({ ms, size, seed, offThread: painted.offThread });
        setStatus('');
        current.schedule();
      } catch (error) {
        if (!cancelled) setStatus(`Scene failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    })();
    // A superseded build releases only the art it never installed.
    return () => { cancelled = true; textures.forEach(texture => texture.dispose()); };
  }, [stageReady, seed, fullness, spread, brush, warmth, size, berries, woods, combat, lit, swap]);

  useEffect(() => { stage.current?.landscape?.setFruitVisible(settings.berries > 0, settings.mana); stage.current?.schedule(); }, [settings.berries, settings.mana]);

  const slider = (key: 'fullness' | 'spread' | 'brush' | 'warmth' | 'berries' | 'moon' | 'ambient' | 'azimuth', label: string, min: number, max: number, step: number) =>
    <label className="bush-sandbox__row">{label}<input type="range" min={min} max={max} step={step} value={settings[key]} onChange={event => set(key, Number(event.target.value))} /><output>{settings[key]}</output></label>;
  const toggle = (key: 'woods' | 'combat' | 'lit' | 'mana' | 'swap', label: string) =>
    <label className="bush-sandbox__check"><input type="checkbox" checked={settings[key]} onChange={event => set(key, event.target.checked)} />{label}</label>;

  return <main className="bush-sandbox">
    <header className="bush-sandbox__header">
      <h1>Bush sandbox · ImageGen vs procedural</h1>
      <GlobalPauseControl />
      <button onClick={() => setSettings(DEFAULTS)}>Reset</button>
      <a href="proto.html">Proto</a>
    </header>
    <div className="bush-sandbox__body">
      <aside className="bush-sandbox__panel" aria-label="Sandbox controls">
        <p className="bush-sandbox__legend">{settings.swap ? 'Left: procedural · Right: ImageGen' : 'Left: ImageGen · Right: procedural'}</p>
        <fieldset><legend>Procedural bush</legend>
          <label className="bush-sandbox__row">Seed<input type="number" value={seed} onChange={event => set('seed', Math.max(0, Math.floor(Number(event.target.value) || 0)))} /><button onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>Random</button></label>
          {slider('berries', 'Manaberries', 0, BUSH_MAX_FRUIT, 1)}{slider('fullness', 'Fullness', 0, 1, .05)}{slider('spread', 'Spread', 0, 1, .05)}{slider('brush', 'Brush', 0, 1, .05)}{slider('warmth', 'Warmth', 0, 1, .05)}
          <label className="bush-sandbox__row">Bake size<select value={size} onChange={event => set('size', Number(event.target.value) as 256 | 512)}><option value={256}>256px</option><option value={512}>512px</option></select></label>
        </fieldset>
        <fieldset><legend>Scene</legend>
          {toggle('woods', 'Woods (sky, stars, terrain, fog)')}{toggle('combat', 'Combat scenery tint')}{toggle('mana', 'Mana glow')}{toggle('swap', 'Swap sides')}
          <label className="bush-sandbox__check"><input type="checkbox" checked={lightsOn} onChange={event => setGlobalLightsEnabled(event.target.checked)} />Global lights (game setting)</label>
        </fieldset>
        <fieldset><legend>Lighting preview</legend>
          {toggle('lit', 'Lit cutouts (preview, not shipped)')}
          {slider('moon', 'Moon', 0, 2.5, .05)}{slider('azimuth', 'Moon azimuth', 0, 359, 1)}{slider('ambient', 'Ambient', 0, 2, .05)}
          <p className="bush-sandbox__note">Game scenery cutouts are unlit: moon and ambient change the ground, ground cover and (with lit cutouts) both bushes.</p>
        </fieldset>
        <p className="bush-sandbox__stat" role="status">{status || (bake ? `Procedural bake: ${bake.ms.toFixed(0)} ms at ${bake.size}px (seed ${bake.seed}, ${bake.offThread ? 'paint worker' : 'main thread'})` : '')}</p>
        <p className="bush-sandbox__note">Drag empty scene to orbit · Shift/right drag to pan · wheel to zoom · click the scene, then WASD to move and Q/E for height.</p>
      </aside>
      <div ref={field} className="bush-sandbox__scene" aria-label="Bush comparison scene" />
    </div>
  </main>;
}
