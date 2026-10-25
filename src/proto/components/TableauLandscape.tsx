import { berryScenerySprite, SPARSE_BERRY_POINTS } from '../berryPresentation';
import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadMediaTexture } from '../mediaTexture';
import { BERRY_TABLEAU_PROPS, createTableauLandscape } from '../tableauLandscape';
import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { attachTableauFreecam } from '../tableauFreecam';
import { BIOME_CARD_RECIPES, biomeCardSources } from '../biomeCardArt';
import { bakeProceduralWoods, proceduralClusters } from '../proceduralWoods';
import { tableauDepartureEye } from '../tableauTravelCamera';

/** One landscape behind the entire field, including its foundation shelf. */
export function TableauLandscape({ tileType, manaGlow = true, berriesAvailable = true, departureProgress = 0, cameraYaw = 0 }: { tileType?: string; manaGlow?: boolean; berriesAvailable?: boolean; departureProgress?: number; cameraYaw?: number }) {
  const style = useArtStyle();
  const kind = tileType ?? 'unexplored';
  const vegetation = ['woods', 'dark-woods', 'berry-patch', 'berry-patch-sparse', 'hero-den'].includes(kind);
  if (vegetation) return <VegetationLandscape tileType={kind} manaGlow={manaGlow && berriesAvailable} berriesAvailable={berriesAvailable} departureProgress={departureProgress} cameraYaw={cameraYaw} />;
  const ground = biomeCardSources(kind, style).ground;
  return <div className="proto-tableau-landscape" data-biome={kind} aria-hidden="true" style={{ backgroundColor: (BIOME_CARD_RECIPES[kind] ?? BIOME_CARD_RECIPES.unexplored).groundColor, backgroundImage: ground ? `url(${ground})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />;
}

function VegetationLandscape({ tileType, manaGlow, berriesAvailable, departureProgress, cameraYaw }: { tileType: string; manaGlow: boolean; berriesAvailable: boolean; departureProgress: number; cameraYaw: number }) {
  const host = useRef<HTMLDivElement>(null);
  const artStyle = useArtStyle();
  const [ready, setReady] = useState(false);
  const [freecam, setFreecam] = useState(true);
  // Resource updates preserve the canvas, foliage and camera.
  const fruitState = useRef({ berriesAvailable, manaGlow });
  fruitState.current = { berriesAvailable, manaGlow };
  const refreshFruit = useRef<(() => void) | undefined>(undefined);
  const departure = useRef(departureProgress);
  departure.current = departureProgress;
  const yaw = useRef(cameraYaw); yaw.current = cameraYaw;
  const refreshCamera = useRef<(() => void) | undefined>(undefined);
  useEffect(() => { refreshCamera.current?.(); }, [departureProgress, cameraYaw]);
  useEffect(() => { refreshFruit.current?.(); }, [berriesAvailable, manaGlow]);
  const controls = useRef<ReturnType<typeof attachTableauFreecam> | undefined>(undefined);
  const berries = tileType === 'berry-patch' || tileType === 'berry-patch-sparse';
  const woods = tileType !== 'hero-den' && !berries && tileType !== 'dirt' && tileType !== 'path' && tileType !== 'road';
  useEffect(() => { controls.current?.setEnabled(freecam); }, [freecam]);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const sceneHost = element.closest<HTMLElement>('.travel-tableau') ?? element.parentElement;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let landscape: ReturnType<typeof createTableauLandscape> | undefined;
    let texture: THREE.Texture | undefined;
    let fruitTexture: THREE.Texture | undefined;
    let treeTextures: THREE.Texture[] = [];
    let observer: ResizeObserver | undefined;
    let frame = 0, last = gameTime.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    setReady(false);
    const lost = (event: Event) => { event.preventDefault(); gameTime.cancelAnimationFrame(frame); frame = 0; setReady(false); };
    const restored = () => { setReady(true); schedule(); };
    const schedule = () => { if (!disposed && !frame) frame = gameTime.requestAnimationFrame(render); };
    const render = (now: number) => {
      frame = 0;
      if (!renderer || !landscape || disposed) return;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height || document.hidden) return;
      controls.current?.update(Math.min(.05, (now - last) / 1000)); last = now;
      // Move the eye back through the ground scene; never scale the card field.
      // Zero preserves the gathering composition and manual woods freecam.
      if (departure.current > 0 || yaw.current !== 0 || departing) {
        const eye = tableauDepartureEye(departure.current, woods);
        const radius = eye.z + 8;
        camera.position.set(Math.sin(yaw.current) * radius, eye.y, -8 + Math.cos(yaw.current) * radius);
        camera.lookAt(0, woods ? 5.2 : tileType === 'berry-patch-sparse' ? 4 : berries ? -.7 : 1.1, -8);
        // Carry the atmospheric range with the dolly so the departing bush
        // recedes in perspective instead of disappearing into close-shot fog.
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.near = (woods ? 18 : 15) + eye.z - 10;
          scene.fog.far = (woods ? 58 : 36) + eye.z - 10;
        }
      }
      departing = departure.current > 0 || yaw.current !== 0;
      const w = Math.round(width), h = Math.round(height);
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
      camera.aspect = width / height;
      if (tileType === 'berry-patch-sparse') {
        const tray = sceneHost?.querySelector('.travel-free-layout')?.getBoundingClientRect();
        camera.clearViewOffset();
        camera.zoom = tray?.height ? tray.height * 1.08 / (height * .6) : 1;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        if (tray?.height) {
          const bounds = element.getBoundingClientRect();
          const center = new THREE.Vector3(0, 5.5, -8).project(camera);
          // Shift the whole landscape with the bush, retaining its ground contact.
          camera.setViewOffset(width, height,
            (center.x + 1) * width / 2 - (tray.left + tray.width / 2 - bounds.left),
            (1 - center.y) * height / 2 - (tray.top + tray.height * .28 - bounds.top), width, height);
        }
      }
      camera.updateProjectionMatrix();
      landscape.update(camera, now / 1000, reduced.matches);
      renderer.render(scene, camera);
      element.dispatchEvent(new Event('tableau-scenery-rendered', { bubbles:true }));
      element.dataset.cameraPosition = camera.position.toArray().map(n => n.toFixed(3)).join(',');
      if ((woods || berries) && !reduced.matches) schedule();
    };
    let departing = false;
    refreshCamera.current = schedule;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
    const snapshot = () => {
      if (!renderer || !landscape || disposed) return;
      // Redraw the settled scene without advancing its clock or simulation.
      renderer.render(scene, camera);
      element.dispatchEvent(new Event('tableau-scenery-rendered', { bubbles:true }));
    };
    element.addEventListener('tableau-scenery-request', snapshot);
    camera.position.set(0, woods ? 3.2 : 5.2, 10);
    // Frame the sparse bush as the card cluster's branching silhouette, with
    // its crown behind the upper cards and its foot below the front card.
    // Other berry scenery retains its low, receding planted edge.
    camera.lookAt(0, woods ? 5.2 : tileType === 'berry-patch-sparse' ? 4 : berries ? -.7 : 1.1, -8);
    const visibility = () => { if (!document.hidden) schedule(); };
    const rustle = (event: Event) => {
      if (reduced.matches || !landscape) return;
      const { x, y } = (event as CustomEvent<{x: number; y: number}>).detail;
      const bounds = element.getBoundingClientRect();
      landscape.rustle(camera, (x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2, gameTime.now() / 1000);
      schedule();
    };
    sceneHost?.addEventListener('tableau-vegetation-rustle', rustle);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', schedule);
    async function start() {
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Paint woods use the procedural pine clusters, baked once per session
        // (normally during the loading screen); the static cluster stays if the bake fails.
        if (woods && artStyle === 'paint') await bakeProceduralWoods();
        const name = tileType === 'hero-den' ? 'hero-den-standee-v3.png'
          : tileType === 'berry-patch-sparse' ? 'watercolor-v1/manaberry-sparse-standee-v1.png' : berries ? 'berry-bush.svg' : 'small_woods_pines.png';
        const khadBush = tileType === 'berry-patch-sparse' && artStyle === 'paint';
        const source = khadBush
          ? `${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/manaberry-sparse-khad-right-v1.png`
          : berryScenerySprite(scenerySprite(`${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/${name}`, artStyle, `tableau:${tileType}`)!, false);
        texture = await loadMediaTexture(source);
        if (woods && artStyle === 'paint') treeTextures = await Promise.all(proceduralClusters().map(loadMediaTexture)).catch(() => []);
        if (disposed) treeTextures.forEach(art => art.dispose());
        for (const art of treeTextures) { art.magFilter = art.minFilter = THREE.LinearFilter; art.generateMipmaps = false; art.colorSpace = THREE.SRGBColorSpace; }
        if (berries) fruitTexture = await loadMediaTexture(`${import.meta.env.BASE_URL}assets/runtime/items/manaberry/manaberry-fruit-v1.svg`);
        if (disposed) { texture.dispose(); fruitTexture?.dispose(); return; }
        texture.magFilter = artStyle === 'paint' ? THREE.LinearFilter : THREE.NearestFilter;
        texture.minFilter = texture.magFilter;
        texture.generateMipmaps = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        landscape = createTableauLandscape(scene, texture, woods, false, tileType === 'hero-den' ? { props: [], groundColor: 0x4d3b2a, groundCover: { pixel: artStyle !== 'paint', palette: 'dirt' } } : tileType === 'berry-patch-sparse' ? { khadGroundTint: khadBush, props: [{ x: 0, z: -8, height: 11 }], groundCover: { pixel: artStyle !== 'paint' }, fruitTexture, manaFruit: SPARSE_BERRY_POINTS.map(point => ({ ...point, size: .29 })) } : berries ? { props: BERRY_TABLEAU_PROPS, groundCover: { pixel: artStyle !== 'paint' }, berryFruit: true, fruitTexture } : { treeTextures });
        refreshFruit.current = () => {
          landscape?.setFruitVisible(fruitState.current.berriesAvailable, fruitState.current.manaGlow);
          schedule();
        };
        refreshFruit.current();
        element.append(renderer!.domElement);
        renderer!.domElement.addEventListener('webglcontextlost', lost);
        renderer!.domElement.addEventListener('webglcontextrestored', restored);
        if (woods && sceneHost) {
          controls.current = attachTableauFreecam(sceneHost, camera, schedule);
          controls.current.setEnabled(freecam);
        }
        observer = new ResizeObserver(schedule);
        observer.observe(element);
        const tray = sceneHost?.querySelector('.travel-free-layout');
        if (tileType === 'berry-patch-sparse' && tray) observer.observe(tray);
        schedule();
        setReady(true);
      } catch {
        // Keep the existing dark field visible when WebGL/assets are unavailable.
        if (!disposed) setReady(false);
      }
    }
    void start();
    return () => {
      disposed = true;
      refreshFruit.current = undefined;
      refreshCamera.current = undefined;
      gameTime.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('tableau-scenery-request', snapshot);
      sceneHost?.removeEventListener('tableau-vegetation-rustle', rustle);
      reduced.removeEventListener('change', schedule);
      controls.current?.dispose(); controls.current = undefined;
      observer?.disconnect();
      landscape?.dispose();
      texture?.dispose();
      fruitTexture?.dispose();
      treeTextures.forEach(art => art.dispose());
      renderer?.domElement.removeEventListener('webglcontextlost', lost);
      renderer?.domElement.removeEventListener('webglcontextrestored', restored);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [artStyle, tileType, woods, berries]);
  return <>
    <div ref={host} className="proto-tableau-landscape" data-ready={ready} data-berries={berries && berriesAvailable} data-biome={tileType} data-woods={woods} data-freecam-enabled={woods && freecam} aria-hidden="true" />
    {woods && <button type="button" className="proto-tableau-freecam" aria-label="Woods freecam" aria-pressed={freecam} disabled={!ready}
      title="Drag empty background to orbit; Shift/right drag to pan; wheel or pinch to zoom; WASD to move, Q/E for height"
      onClick={() => setFreecam(value => !value)}>Freecam</button>}
  </>;
}
