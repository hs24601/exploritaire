import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BATTLE_SPRITE_ASSETS } from '../battleSpriteAssets';
import { COMBAT_CAMERA_VIEWS, COMBAT_DEMO_SECONDS, createCombatCameraControls, createCombatDemoRig, demoPhase, type CombatCameraView, type CombatCameraSnapshot } from '../combatDemoRig';
import './CombatDemo.css';
import { SceneButton as CameraButton } from './SceneButton';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from '../battleTurnPriority';

export function CombatDemo({onClose, onRestart, onEscape, firstTeam = BATTLE_TURN_PRIORITY[0]}: {onClose: () => void; onRestart: () => void; onEscape?: () => void; firstTeam?: BattleTeam}) {
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const [status, setStatus] = useState('Preparing arena…');
  const [elapsed, setElapsed] = useState(0);
  const [cameraView, setCameraView] = useState<CombatCameraView>(firstTeam);
  const [ready, setReady] = useState(false);
  const [cameraInfo, setCameraInfo] = useState<CombatCameraSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = useState('Copy camera cue');
  const controls = useRef<{select: (view: CombatCameraView) => void; replay: () => void; move: (key: string, held: boolean) => void; cue: () => object} | null>(null);
  useEffect(() => {
    const heldKeys = new Set<string>();
    let selected: CombatCameraView = firstTeam;
    const clearInput = () => heldKeys.clear();
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      else {
        const buttonMove = (event.target as HTMLElement)?.closest<HTMLButtonElement>('[data-move]')?.dataset.move;
        if (buttonMove && (event.key === 'Enter')) { event.preventDefault(); controls.current?.move(buttonMove, true); }
        if (selected === 'freecam' && !event.ctrlKey && !event.altKey && !event.metaKey && !((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]'))) {
          const movement = event.key.toLowerCase();
          if ('wasdqe'.includes(movement) && movement.length === 1) { event.preventDefault(); controls.current?.move(movement, true); }
        }
      }
    };
    window.addEventListener('keydown', key, true);
    const keyUp = (event: KeyboardEvent) => {
      const movement = event.key.toLowerCase();
      if (heldKeys.has(movement)) controls.current?.move(movement, false);
      const buttonMove = (event.target as HTMLElement)?.closest<HTMLButtonElement>('[data-move]')?.dataset.move;
      if (buttonMove && (event.key === 'Enter')) controls.current?.move(buttonMove, false);
    };
    const visibility = () => { if (document.hidden) clearInput(); };
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', visibility);
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let rig: ReturnType<typeof createCombatDemoRig> | undefined;
    let observer: ResizeObserver | undefined;
    let detachPointer = () => {};
    let sharedSurface: HTMLDivElement | undefined;
    const textures: THREE.Texture[] = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    async function start() {
      try {
        renderer = new THREE.WebGLRenderer({antialias: false, alpha: false});
        renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
        const loader = new THREE.TextureLoader();
        const load = async (path: string) => { const t = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${path}`); if (disposed) { t.dispose(); throw new Error('closed'); } textures.push(t); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
        const entries = await Promise.all(Object.entries({...BATTLE_SPRITE_ASSETS,trees:'biomes/small_woods_pines.png'}).map(async ([key,path]) => [key,await load(path)] as const));
        const assets = Object.fromEntries(entries) as Record<string,THREE.Texture> & {trees:THREE.Texture};
        if (disposed || !host.current) return;
        const layout = host.current.closest<HTMLElement>('.proto-main-layout')!;
        const field = layout.querySelector<HTMLElement>('.proto-tableau-field--combat');
        sharedSurface = document.createElement('div');
        sharedSurface.className = 'combat-shared-view';
        sharedSurface.setAttribute('aria-hidden','true');
        layout.append(sharedSurface);
        sharedSurface.append(renderer.domElement);
        rig = createCombatDemoRig(scene, camera, assets);
        const cameraControls = createCombatCameraControls(camera, firstTeam);
        let displayedTime = 0;
        const entered = performance.now();
        let actionStarted: number | null = null;
        let lastTick = -1, lastFrame = entered, lastReadout = -Infinity;
        const paint = (now: number) => {
          // Entry overview and scripted battle action have independent clocks.
          const cameraTime = selected === 'cinematic' ? displayedTime : (now - entered) / 1000;
          const shot = cameraControls.update(cameraTime, now, reduced);
          rig!.update(displayedTime, reduced); renderer!.render(scene, camera);
          if (host.current) {
            host.current.dataset.cameraView = selected;
            host.current.dataset.cameraPosition = camera.position.toArray().map(n => n.toFixed(3)).join(',');
            host.current.dataset.cameraTarget = shot.target.toArray().map(n => n.toFixed(3)).join(',');
            host.current.dataset.cameraMoving = String(shot.moving);
            host.current.dataset.actionStarted = String(actionStarted !== null);
            if (import.meta.env.DEV) host.current.dataset.actors = JSON.stringify(rig!.snapshot());
          }
          if (now - lastReadout >= 100 || displayedTime === COMBAT_DEMO_SECONDS) {
            lastReadout = now; setCameraInfo(cameraControls.snapshot());
          }
          return shot.moving;
        };
        const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(render); };
        const render = (now: number) => {
          frame = 0;
          if (disposed) return;
          const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
          if (selected === 'freecam' && heldKeys.size) {
            const right = Number(heldKeys.has('d')) - Number(heldKeys.has('a'));
            const forward = Number(heldKeys.has('w')) - Number(heldKeys.has('s'));
            const up = Number(heldKeys.has('e')) - Number(heldKeys.has('q'));
            const length = Math.hypot(right, forward, up) || 1;
            const speed = Math.max(2, cameraControls.snapshot().distance * .5) * dt / length;
            cameraControls.pan(right * speed, forward * speed, up * speed);
          }
          const t = actionStarted === null ? 0 : Math.min(COMBAT_DEMO_SECONDS, (now - actionStarted) / 1000);
          displayedTime = t;
          const moving = paint(now);
          if (Math.floor(t * 10) !== lastTick) { lastTick = Math.floor(t * 10); setElapsed(t); }
          setStatus(actionStarted === null
            ? moving ? 'Battlefield overview' : `${firstTeam === 'party' ? 'Player' : 'Enemy'} goes first`
            : reduced ? 'Reduced motion · scene effects off' : demoPhase(t));
          // Freecam can wake the final hold; idle cameras do not run a render loop.
          if ((actionStarted !== null && t < COMBAT_DEMO_SECONDS) || moving || heldKeys.size) schedule();
        };
        const resize = () => {
          if (!host.current || !renderer || !sharedSurface) return;
          const arena = host.current.getBoundingClientRect(), tableau = field?.getBoundingClientRect();
          const visibleArena = arena.width > 0 && arena.height > 0;
          const visibleField = tableau && tableau.width > 0 && tableau.height > 0;
          const boxes = [visibleArena ? arena : null, visibleField ? tableau : null].filter((box): box is DOMRect => Boolean(box));
          sharedSurface.hidden = !boxes.length;
          if (!boxes.length) return;
          const left = Math.min(...boxes.map(box=>box.left)), top = Math.min(...boxes.map(box=>box.top));
          const width = Math.max(...boxes.map(box=>box.right)) - left, height = Math.max(...boxes.map(box=>box.bottom)) - top;
          const parent = layout.getBoundingClientRect();
          Object.assign(sharedSurface.style,{left:`${left-parent.left}px`,top:`${top-parent.top}px`,width:`${width}px`,height:`${height}px`});
          renderer.setSize(Math.max(1,Math.round(width/2)),Math.max(1,Math.round(height/2)),false);
          // Extend the original lens sideways/upwards instead of recentering,
          // stretching, or duplicating the arena image beneath the cards.
          if (visibleArena) camera.setViewOffset(arena.width,arena.height,left-arena.left,top-arena.top,width,height);
          else { camera.clearViewOffset(); camera.aspect = width/height; }
          camera.updateProjectionMatrix();
          renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
          sharedSurface.dataset.projection = visibleArena ? 'extended' : 'tableau';
          paint(performance.now());
        };
        controls.current = {
          select(view) {
            clearInput(); selected = view; const now = performance.now();
            if (view === 'cinematic') { actionStarted = now; lastTick = -1; displayedTime = 0; setElapsed(0); }
            cameraControls.select(view, now); lastReadout = -Infinity; paint(now); schedule();
          },
          replay() { actionStarted = performance.now(); lastTick = -1; displayedTime = 0; setElapsed(0); schedule(); },
          move(key, held) { if (selected !== 'freecam') return; if (held) { if (!heldKeys.size) lastFrame = performance.now(); heldKeys.add(key); schedule(); } else { heldKeys.delete(key); lastReadout = -Infinity; paint(performance.now()); } },
          cue() { const info = cameraControls.snapshot(); return { t: Number(displayedTime.toFixed(3)), p: info.position, target: info.target, fov: info.fov }; },
        };
        const arena = host.current;
        let drag: {id: number; x: number; y: number; pan: boolean} | null = null;
        const pointerDown = (event: PointerEvent) => {
          if (selected !== 'freecam' || drag || ![0, 1, 2].includes(event.button)) return;
          // touch-action already owns the gesture. Cancelling touch presses can
          // suppress subsequent compatibility clicks on the camera buttons.
          if (event.pointerType !== 'touch') event.preventDefault();
          arena.setPointerCapture(event.pointerId);
          drag = {id: event.pointerId, x: event.clientX, y: event.clientY, pan: event.button !== 0 || event.shiftKey};
          arena.dataset.dragging = 'true';
        };
        const pointerMove = (event: PointerEvent) => {
          if (!drag || event.pointerId !== drag.id) return;
          if (selected !== 'freecam') { pointerEnd(event); return; }
          const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
          drag.x = event.clientX; drag.y = event.clientY;
          if (drag.pan) {
            const units = cameraControls.snapshot().distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, arena.clientHeight);
            cameraControls.pan(-dx * units, -dy * units, 0);
          } else cameraControls.orbit(dx * .005, dy * .005);
          lastReadout = -Infinity; paint(performance.now());
        };
        const pointerEnd = (event: PointerEvent) => {
          if (drag?.id !== event.pointerId) return;
          drag = null; delete arena.dataset.dragging;
          if (arena.hasPointerCapture(event.pointerId)) arena.releasePointerCapture(event.pointerId);
        };
        const wheel = (event: WheelEvent) => {
          if (selected !== 'freecam') return;
          event.preventDefault();
          const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? arena.clientHeight : 1);
          cameraControls.dolly(THREE.MathUtils.clamp(pixels * .001, -.3, .3));
          lastReadout = -Infinity; paint(performance.now());
        };
        const contextMenu = (event: Event) => event.preventDefault();
        arena.addEventListener('pointerdown', pointerDown); arena.addEventListener('pointermove', pointerMove);
        arena.addEventListener('pointerup', pointerEnd); arena.addEventListener('pointercancel', pointerEnd); arena.addEventListener('lostpointercapture', pointerEnd);
        arena.addEventListener('wheel', wheel, {passive: false}); arena.addEventListener('contextmenu', contextMenu);
        detachPointer = () => {
          arena.removeEventListener('pointerdown', pointerDown); arena.removeEventListener('pointermove', pointerMove);
          arena.removeEventListener('pointerup', pointerEnd); arena.removeEventListener('pointercancel', pointerEnd); arena.removeEventListener('lostpointercapture', pointerEnd);
          arena.removeEventListener('wheel', wheel); arena.removeEventListener('contextmenu', contextMenu);
        };
        observer = new ResizeObserver(resize); observer.observe(host.current); observer.observe(layout); if (field) observer.observe(field); resize();
        setReady(true); schedule();
      } catch (error) { if (!disposed) setStatus(`Arena could not load: ${error instanceof Error ? error.message : 'WebGL unavailable'}`); }
    }
    void start();
    return () => { disposed = true; controls.current = null; clearInput(); detachPointer(); cancelAnimationFrame(frame); observer?.disconnect(); rig?.dispose(); textures.forEach(t => t.dispose()); renderer?.dispose(); renderer?.domElement.remove(); sharedSurface?.remove(); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', clearInput); document.removeEventListener('visibilitychange', visibility); if (previous?.isConnected) previous.focus(); };
  }, [firstTeam]);
  return <section ref={dialog} className="combat-demo proto-map" aria-labelledby="combat-demo-title" tabIndex={-1} data-elapsed={elapsed.toFixed(1)} data-complete={elapsed >= COMBAT_DEMO_SECONDS || undefined} data-camera-view={cameraView}>
    <header className="combat-demo__header"><h1 id="combat-demo-title">Dark Woods · battle</h1><CameraButton type="button" onClick={onClose}>Return to table · Esc</CameraButton></header>
    <div ref={host} className="combat-demo__arena" aria-label="Directional Hero, Mochi and dark slime sprites in a Three.js forest arena" />
    <footer className="combat-demo__footer">
      <div className="combat-demo__readout"><span>{status}</span><span>{elapsed.toFixed(1)} / 10s</span></div>
      <div className="combat-demo__camera-panel">
        <div className="combat-demo__views" role="group" aria-label="Camera angles">
          {COMBAT_CAMERA_VIEWS.map(view => <CameraButton key={view.id} type="button" className="combat-demo__view" data-view={view.id} aria-pressed={cameraView === view.id} title={view.description} disabled={!ready} onClick={() => { setCameraView(view.id); controls.current?.select(view.id); }}>
            <CameraAngleIcon view={view.id} /><span>{view.label}</span>
          </CameraButton>)}
        </div>
        <CameraButton type="button" className="combat-demo__replay" disabled={!ready} onClick={() => controls.current?.replay()}>Replay scene</CameraButton>
      </div>
      <div className="combat-demo__scene-actions" role="group" aria-label="Battle scene actions">
        <CameraButton type="button" onClick={onRestart}>Restart battle scene</CameraButton>
        <CameraButton type="button" onClick={onEscape ?? onClose}>Escape</CameraButton>
      </div>
      <details className="combat-demo__diagnostics"><summary>Camera properties</summary><div className="combat-demo__diagnostic-body" aria-label="Live camera properties">
        {cameraInfo && <div className="combat-demo__properties">
          <span data-property="position">Position XYZ: {cameraInfo.position.map(n => n.toFixed(3)).join(' / ')}</span>
          <span data-property="target">Aim XYZ: {cameraInfo.target.map(n => n.toFixed(3)).join(' / ')}</span>
          <span data-property="rotation">Euler XYZ°: {cameraInfo.rotation.map(n => n.toFixed(2)).join(' / ')}</span>
          <span data-property="orbit">Yaw {cameraInfo.yaw.toFixed(2)}° · Elev {cameraInfo.elevation.toFixed(2)}° · Dist {cameraInfo.distance.toFixed(3)}</span>
          <span data-property="lens">FOV {cameraInfo.fov.toFixed(1)}° · Aspect {cameraInfo.aspect.toFixed(3)}</span>
          <span data-property="clip">Clip {cameraInfo.near}–{cameraInfo.far} · Y up · world units</span>
        </div>}
        <CameraButton type="button" className="combat-demo__copy" disabled={!ready} onClick={async () => {
          try { await navigator.clipboard.writeText(JSON.stringify(controls.current?.cue(), null, 2)); setCopyStatus('Camera cue copied'); }
          catch { setCopyStatus('Copy unavailable'); }
        }}>{copyStatus}</CameraButton>
      </div></details>
    </footer>
  </section>;
}

function CameraAngleIcon({view}: {view: CombatCameraView}) {
  // Tiny scene diagrams keep the camera choices readable without sprite assets.
  return <svg className="combat-demo__angle-icon" viewBox="0 0 60 32" aria-hidden="true">
    <path className="combat-demo__icon-ground" d="M4 25 21 14h22l13 11-19 5H18Z" />
    <path className="combat-demo__icon-party" d="M18 16v-7h5v7m-2-7V5m-7 16v-7h5v7m-2-7v-4" />
    <path className="combat-demo__icon-enemy" d="M38 16v-7h5v7m-2-7V5m6 16v-7h5v7m-2-7v-4" />
    {view === 'freecam' ? <path className="combat-demo__icon-camera" d="M5 12C5 0 54 0 54 12M5 12l-2-5m2 5 5-2M54 12l-5-2m5 2 2-5M29 9v15m-7-7h14m-14 0 3-3m-3 3 3 3m11-3-3-3m3 3-3 3" /> : view === 'cinematic' ? <path className="combat-demo__icon-camera" d="M8 11C9 1 48-2 54 10m-6-2 6 2-1-6" /> : <>
      <path className="combat-demo__icon-ray" d={view === 'side' ? 'M30 29 20 14M30 29 44 14' : view === 'party' ? 'M8 26 38 11M8 26 47 18' : view === 'enemy' ? 'M54 5 17 13M54 5 23 20' : 'M30 3 17 20M30 3 48 20'} />
      <rect className="combat-demo__icon-camera" x={view === 'party' ? 3 : view === 'enemy' ? 50 : 26} y={view === 'side' ? 24 : view === 'party' ? 22 : 0} width="8" height="6" />
    </>}
  </svg>;
}


