import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createDirectionalSpriteLibrary } from '../directionalSpriteRig';
import { HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE } from '../directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from '../mochiSprite';
import { BANKS_DIRECTIONAL_SPRITE, BANKS_SPRITE_ASSETS } from '../banksSprite';
import { DEM_DIRECTIONAL_SPRITE, DEM_SPRITE_ASSETS } from '../demSprite';
import { DEM_COMBAT_ASSETS, DEM_COMBAT_POSES, sampleDemReaction, type DemReaction } from '../demCombatSprites';
import { BATTLE_SPRITE_ASSETS } from '../battleSpriteAssets';
import { createKhadWeed } from '../khadWeedRig';

export function ActorEditorPreview({ id, asset, mode, onModeChange, active = true }: { id: string; asset?: string; mode: 'actor' | 'asset'; onModeChange: (mode:'actor'|'asset')=>void; active?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | undefined>(undefined);
  const [error, setError] = useState('');
  const hasRig = ['hero','mochi','banks','dem','khad-root','dark-slime','rear-slime','small-slime'].includes(id);
  const empty = !asset && (mode === 'asset' || !hasRig);
  const [heading, setHeading] = useState(0);
  const angle = useRef(0); angle.current = heading * Math.PI / 180;
  const [fov, setFov] = useState(40);
  const playback = useRef<{kind?:DemReaction;elapsed:number;paused:boolean}>({elapsed:0,paused:false});
  const [playing, setPlaying] = useState(false), [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media.matches; }; update();
    media.addEventListener('change',update); return () => media.removeEventListener('change',update);
  }, []);
  const play = (kind: DemReaction) => { playback.current = {kind,elapsed:0,paused:false};setPlaying(true);setPaused(false); };
  const pause = () => { playback.current.paused = !playback.current.paused;setPaused(playback.current.paused); };
  const cameraRef = useRef<THREE.PerspectiveCamera | undefined>(undefined);
  useEffect(() => { if (cameraRef.current) { cameraRef.current.fov = fov; cameraRef.current.updateProjectionMatrix(); } }, [fov]);
  useEffect(() => {
    const element = host.current;
    setError('');
    if (!element || empty || !active) return;
    playback.current = {elapsed:0,paused:false};setPlaying(false);setPaused(false);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setError('WebGL is unavailable. Review the original artwork below.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); element.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#202c32');
    const camera = new THREE.PerspectiveCamera(fov, 1, .01, 100); camera.position.set(2.2, 1.6, 3); cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .8, 0); controls.enableDamping = true; controls.minDistance = .3; controls.maxDistance = 20; controls.maxPolarAngle = Math.PI / 2; controls.saveState(); controlsRef.current = controls;
    const grid = new THREE.GridHelper(10, 20, '#627b82', '#35484f'); scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xe4edff, 0x444038, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2); keyLight.position.set(3, 5, 4); scene.add(keyLight);
    const khad = mode === 'actor' && id === 'khad-root' ? createKhadWeed(1.7) : undefined;
    if (khad) scene.add(khad.root);
    const textures: THREE.Texture[] = [];
    let disposed = false, rig: ReturnType<ReturnType<typeof createDirectionalSpriteLibrary>['create']> | undefined;
    let library: ReturnType<typeof createDirectionalSpriteLibrary> | undefined;
    let plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | undefined;
    const loader = new THREE.TextureLoader();
    const load = async (url: string) => { const texture = await loader.loadAsync(url); if (disposed) { texture.dispose(); throw new Error('disposed'); } texture.colorSpace = THREE.SRGBColorSpace; texture.userData.watercolor = /watercolor|bobtail/.test(url); texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false; textures.push(texture); return texture; };
    const definition = mode === 'actor' ? ({ hero: HERO_DIRECTIONAL_SPRITE, mochi: MOCHI_DIRECTIONAL_SPRITE, banks: BANKS_DIRECTIONAL_SPRITE, dem: DEM_DIRECTIONAL_SPRITE, 'dark-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'rear-slime': DARK_SLIME_DIRECTIONAL_SPRITE, 'small-slime': DARK_SLIME_DIRECTIONAL_SPRITE } as Record<string, typeof HERO_DIRECTIONAL_SPRITE>)[id] : undefined;
    (async () => {
      if (definition) {
        const poses: Record<string, typeof HERO_DIRECTIONAL_SPRITE> = id === 'dem' ? DEM_COMBAT_POSES : {};
        const sources = [...new Set([definition,...Object.values(poses)].flatMap(pose => [...pose.low, ...pose.high, ...(pose.lowOpposite ?? []), ...(pose.highOpposite ?? []), pose.top]).map(frame => frame.source))];
        const paths = { ...BATTLE_SPRITE_ASSETS, ...BANKS_SPRITE_ASSETS, ...DEM_SPRITE_ASSETS, ...DEM_COMBAT_ASSETS };
        const loaded = await Promise.all(sources.map(async source => [source, await load(`${import.meta.env.BASE_URL}assets/${paths[source]}`)] as const));
        if (disposed) return;
        library = createDirectionalSpriteLibrary(Object.fromEntries(loaded), definition, poses); rig = library.create(1.7); scene.add(rig.root);
      } else if (asset && !khad) {
        const texture = await load(asset); if (disposed) return;
        plane = new THREE.Mesh(new THREE.PlaneGeometry(1.7 * texture.image.width / texture.image.height, 1.7), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, alphaTest: .05 })); plane.position.y = .85; scene.add(plane);
      }
    })().catch(() => { if (!disposed) setError('Could not load this preview. Select another asset to continue.'); });
    const resize = new ResizeObserver(() => { const width = element.clientWidth, height = element.clientHeight; renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }); resize.observe(element);
    let lastTime: number | undefined;
    const visibility = () => { lastTime = undefined; };
    document.addEventListener('visibilitychange',visibility);
    renderer.setAnimationLoop(time => {
      const dt = lastTime === undefined ? 0 : Math.max(0,(time-lastTime)/1000);lastTime=time;
      controls.update();
      if(rig) {
        const state=playback.current;
        if(state.kind && id==='dem') {
          if(!state.paused && !document.hidden)state.elapsed+=dt;
          const sample=sampleDemReaction(state.kind,state.elapsed,reduced.current);
          rig.setPose(sample.pose);rig.root.position.set(Math.sin(angle.current)*sample.forward*1.7,0,Math.cos(angle.current)*sample.forward*1.7);rig.setFlash(sample.flash);
          if(sample.done){state.kind=undefined;state.paused=false;setPlaying(false);setPaused(false);}
        } else {rig.setPose('standing');rig.root.position.set(0,0,0);rig.setFlash(0);}
        rig.update(camera,angle.current,time/1000,true);
        renderer.domElement.dataset.pose=rig.pose;
      }
      if (khad) { khad.root.rotation.y = angle.current; khad.update(time / 1000, true); }
      if (plane) plane.rotation.y = angle.current;
      renderer.render(scene, camera);
    });
    return () => { disposed = true; document.removeEventListener('visibilitychange',visibility); resize.disconnect(); renderer.setAnimationLoop(null); controls.dispose(); rig?.dispose(); library?.dispose(); khad?.dispose(); textures.forEach(texture => texture.dispose()); plane?.geometry.dispose(); plane?.material.dispose(); grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); renderer.dispose(); renderer.domElement.remove(); controlsRef.current = undefined; cameraRef.current = undefined; };
  }, [id, asset, mode, empty, active]);
  return <div className="ae-preview">
    <div className="ae-preview__top"><div className="ae-preview__modes" role="group" aria-label="Preview mode"><button type="button" aria-pressed={mode==='actor'} onClick={()=>onModeChange('actor')}>Game view</button><button type="button" aria-pressed={mode==='asset'} disabled={!asset} onClick={()=>onModeChange('asset')}>Artwork</button></div><button type="button" className="ae-text-button" disabled={empty} onClick={() => controlsRef.current?.reset()}>Reset view</button></div>
    {empty ? <div className="ae-preview__placeholder"><span aria-hidden="true">✧</span><strong>Ready for a first look</strong><p>No artwork has been added for this Keru yet.</p></div> : <div ref={host} className="ae-canvas" aria-label="Orbitable 3D Keru preview" />}
    {error && <p role="alert">{error}</p>}
    <details className="ae-preview__settings"><summary>View controls <span>Orbit · zoom · rotation</span></summary><div className="ae-toolbar"><label>Heading <input aria-label="Heading" type="range" min="0" max="360" value={heading} onChange={e => setHeading(+e.target.value)} /></label><label>Field of view <input aria-label="Field of view" type="range" min="15" max="90" value={fov} onChange={e => setFov(+e.target.value)} /></label></div>
      {id==='dem' && mode==='actor' && <div className="ae-toolbar ae-reactions" aria-label="Dem animations"><button type="button" onClick={()=>play('hit')}>Play hit</button><button type="button" onClick={()=>play('flinch')}>Play flinch</button><button type="button" disabled={!playing} onClick={pause}>{paused?'Resume animation':'Pause animation'}</button></div>}
      <p>Drag to orbit · right-drag to pan · scroll or pinch to zoom.</p>
    </details>
  </div>;
}
