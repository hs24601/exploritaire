import {HeroLoading} from '../../ui/HeroLoader';
import { floorSlot, floorLayout } from '../rules/verticalColumns';
import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createCombatClock } from '../combatClock';
import { createCombatCameraAction } from '../combatCameraAction';
import * as THREE from 'three';
import { loadMediaTexture } from '../mediaTexture';
import { bakeProceduralWoods, proceduralClusters } from '../proceduralWoods';
import { BANKS_SPRITE_ASSETS } from '../banksSprite';
import { battleSpriteAssets } from '../battleSpriteAssets';
import { HERO_ORBIT_ASSETS } from '../heroOrbitSprite';
import { useArtStyle } from '../artStyle';
import { COMBAT_CAMERA_VIEWS, COMBAT_DEMO_SECONDS, createCombatCameraControls, createCombatDemoRig, demoPhase, type CombatAuthoredShot, type CombatCameraView, type CombatCameraSnapshot } from '../combatDemoRig';
import './CombatDemo.css';
import { SceneButton as CameraButton } from './SceneButton';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from '../battleTurnPriority';
import { detectFxQuality } from '../atmosphere';
import { cuesFor, freshEvents, type BattleScene } from '../rules/battleCues';
import { rankLabel } from '../protoState';

export function CombatDemo({onClose, onRestart, onEscape, firstTeam = BATTLE_TURN_PRIORITY[0], attackingTeam, battle, overlay, cameraShot, protoGestures = false}: {protoGestures?: boolean; onClose: () => void; onRestart: () => void; onEscape?: () => void; firstTeam?: BattleTeam; attackingTeam?: BattleTeam; battle?: BattleScene; overlay?: ReactNode; cameraShot?: CombatAuthoredShot}) {
  const artStyle = useArtStyle();
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const foundationOverlay = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const [status, setStatus] = useState('Preparing arena…');
  const [elapsed, setElapsed] = useState(0);
  const [cameraView, setCameraView] = useState<CombatCameraView>(firstTeam);
  const [freecamEnabled, setFreecamEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [cameraInfo, setCameraInfo] = useState<CombatCameraSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = useState('Copy camera cue');
  const controls = useRef<{frame: (shot: CombatAuthoredShot) => void; select: (view: CombatCameraView) => void; toggleFreecam: () => void; replay: () => void; move: (key: string, held: boolean) => void; cue: () => object; refresh: () => void} | null>(null);
  // The battle panel's units and events: who stands, who fell, and what just happened.
  const battleRef = useRef(battle); battleRef.current = battle;
  const attackingTeamRef = useRef(attackingTeam); attackingTeamRef.current = attackingTeam;
  const followedTeam = useRef<BattleTeam | undefined>(undefined);
  // Events from before the arena opened are history, not cues to replay.
  const seenEvent = useRef(battle?.events[battle.events.length - 1]?.id ?? 0);
  const pendingCues = useRef<ReturnType<typeof cuesFor>>([]);
  useEffect(() => {
    const overlay = foundationOverlay.current;
    if (!overlay || !battle?.verticalTableau) return;
    const layout = overlay.closest('.proto-main-layout');
    for (const [side, selector] of [['party', '[data-battle-actor="hero"]'], ['enemy', '[data-battle-target="khad-root"]']] as const) {
      const slot = overlay.querySelector<HTMLElement>(`[data-foundation-overlay="${side}"]`);
      const source = layout?.querySelector<HTMLElement>(`.proto-tableau-field--combat ${selector}`);
      if (slot && source) {
        const copy = source.cloneNode(true) as HTMLElement;
        const bounds = source.getBoundingClientRect();
        slot.style.width = bounds.width + 'px';
        copy.style.width = bounds.width + 'px';
        copy.style.height = bounds.height + 'px';
        slot.replaceChildren(copy);
      }
    }
  }, [battle]);
  useEffect(() => {
    if (!battle) return;
    const fresh = freshEvents(battle.events, seenEvent.current);
    if (fresh.length) { seenEvent.current = fresh[fresh.length - 1]!.id; pendingCues.current.push(...cuesFor(fresh)); }
    controls.current?.refresh();
  }, [battle]);
  useEffect(() => {
    setReady(false);
    const heldKeys = new Set<string>();
    let selected: CombatCameraView = firstTeam;
    let manualEnabled = true;
    setFreecamEnabled(true);
    const clearInput = () => heldKeys.clear();
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('.details-card-viewer')) { clearInput(); return; }
      // Escape first cancels a held or armed battle ability (useAbilityDrag).
      if (event.key === 'Escape' && document.querySelector('.battle-field[data-aiming]')) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      else {
        const buttonMove = (event.target as HTMLElement)?.closest<HTMLButtonElement>('[data-move]')?.dataset.move;
        if (buttonMove && (event.key === 'Enter')) { event.preventDefault(); controls.current?.move(buttonMove, true); }
        if (manualEnabled && !event.ctrlKey && !event.altKey && !event.metaKey && !((event.target as HTMLElement)?.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]'))) {
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
    const visibility = () => { if (document.hidden) clearInput(); controls.current?.refresh(); };
    window.addEventListener('keyup', keyUp, true);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', visibility);
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let rig: ReturnType<typeof createCombatDemoRig> | undefined;
    let observer: ResizeObserver | undefined;
    let detachPointer = () => {};
    let sharedSurface: HTMLDivElement | undefined;
    const dropRegions = new Map<string, HTMLDivElement>();
    let canvasBounds = { left: 0, top: 0, width: 0, height: 0 };
    let arenaBounds = { left: 0, top: 0, width: 0, height: 0 };
    const textures: THREE.Texture[] = [];
    let tableauCleanup = () => {};
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const quality = detectFxQuality();
    async function start() {
      try {
        renderer = new THREE.WebGLRenderer({antialias: Boolean(battleRef.current?.verticalTableau), alpha: false});
        renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
        // Baked procedural woods arrive as object URLs; everything else is an asset path.
        const load = async (path: string) => {
          const baked = path.startsWith('blob:');
          const t = await loadMediaTexture(baked ? path : `${import.meta.env.BASE_URL}assets/${path}`);
          if (disposed) { t.dispose(); throw new Error('closed'); }
          textures.push(t); t.userData.watercolor = baked || /watercolor|bobtail/.test(path);
          t.magFilter = t.userData.watercolor ? THREE.LinearFilter : THREE.NearestFilter;
          t.minFilter = t.magFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t;
        };
        // Paint combat woods use the procedural pine clusters (static cluster if the bake failed).
        if (artStyle === 'paint') await bakeProceduralWoods();
        const clusters = artStyle === 'paint' ? proceduralClusters() : [];
        const entries = await Promise.all(Object.entries({...battleSpriteAssets(artStyle),...BANKS_SPRITE_ASSETS,...(battleRef.current?.heroOrbit && artStyle==='paint'?HERO_ORBIT_ASSETS:{}),trees:clusters[0]??(artStyle==='paint'?'runtime/environment/watercolor/v1/woods-cluster-sprite-v1.png':'deprecated/pixel/environment/small_woods_pines.png')}).map(async ([key,path]) => [key,await load(path)] as const));
        const treeVariants = await Promise.all(clusters.slice(1).map(load));
        const assets = Object.fromEntries(entries) as Record<string,THREE.Texture> & {trees:THREE.Texture};
        if (disposed || !host.current) return;
        const layout = host.current.closest<HTMLElement>('.proto-main-layout') ?? host.current.closest<HTMLElement>('.banks-rescue-cinema__stage') ?? host.current.parentElement!;
        const field = layout.querySelector<HTMLElement>('.proto-tableau-field--combat');
        sharedSurface = document.createElement('div');
        sharedSurface.className = 'combat-shared-view';
        sharedSurface.setAttribute('aria-hidden','true');
        layout.append(sharedSurface);
        sharedSurface.append(renderer.domElement);
        rig = createCombatDemoRig(scene, camera, assets, quality, Boolean(battleRef.current?.proceduralSlimeComparison), Boolean(battleRef.current?.khadRoot), treeVariants, Boolean(battleRef.current?.heroOrbit));
        // A live, non-interactive copy of 222's deal sits on the arena ground.
        const tableau = new THREE.Group(); scene.add(tableau);
        tableauCleanup = () => { tableau.children.slice().forEach(child => { const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }); scene.remove(tableau); };
        // 223 Stepping Stones: Hero's reach ring and, while a card is hovered, the ring she would have after playing it.
        const reachRing = (color: number, opacity: number) => { const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); return ring; };
        const standRing = reachRing(0xf2c76b, .7), ghostRing = reachRing(0xd8ecff, .45), enemyRing = reachRing(0xe689ae, .7);
        const standDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xf2c76b, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide })); standDisc.rotation.x = -Math.PI / 2; standDisc.visible = false; scene.add(standDisc);
        const placeRing = (mesh: THREE.Mesh, spot?: { stand: [number, number]; radius: number }, height = .025) => { mesh.visible = Boolean(spot); if (spot) { mesh.position.set(spot.stand[0], height, spot.stand[1]); mesh.scale.setScalar(spot.radius); } };
        const updateReachRings = () => { const stepping = battleRef.current?.verticalTableau?.stepping; placeRing(standRing, stepping); placeRing(standDisc, stepping, .02); placeRing(ghostRing, stepping?.ghost, .03); placeRing(enemyRing, stepping?.enemy, .03); };
        const clearTableau = tableauCleanup;
        tableauCleanup = () => { clearTableau(); [standRing, ghostRing, enemyRing, standDisc].forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); scene.remove(mesh); }); };
        const cardCaptures = new Map<string, Promise<HTMLCanvasElement>>();
        let captureQueue = Promise.resolve();
        let tableauSignature = '';
        let tableauRevision = 0;
        const updateTableau = () => {
          const data = battleRef.current?.verticalTableau;
          const signature = JSON.stringify(data?.columns ?? null);
          if (signature === tableauSignature) return;
          tableauSignature = signature;
          const revision = ++tableauRevision;
          tableau.children.slice().forEach(child => {
            tableau.remove(child);
            const mesh = child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
            mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose();
          });
          // 223 moves reach every play, so its faces are captured lit once per rank and dimmed with the material instead.
          const stepping = Boolean(data?.stepping);
          data?.columns.slice(0, data.tiled ? data.columns.length : 10).forEach((column, index) => column.forEach((card, depth) => {
            const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 178;
            const ctx = canvas.getContext('2d'); if (!ctx) return;
            const lit = card.reachable || stepping;
            ctx.fillStyle = lit ? '#46514a' : '#242c2b'; ctx.fillRect(0, 0, 128, 178);
            ctx.strokeStyle = card.selected ? '#f5d879' : lit ? '#92917b' : '#46504b'; ctx.lineWidth = card.selected ? 7 : 3; ctx.strokeRect(2, 2, 124, 174);
            ctx.fillStyle = '#101b20'; ctx.beginPath(); ctx.roundRect(33, 38, 62, 103, 12); ctx.fill();
            ctx.strokeStyle = '#6b7270'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = lit ? '#f3e9c9' : '#777b70'; ctx.font = 'bold 60px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(rankLabel(card.rank), 64, 91);
            const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
            const geometry = new THREE.PlaneGeometry(data?.tiled ? floorLayout(data.tiled).width : 1.15, data?.tiled ? floorLayout(data.tiled).height : 1.6); geometry.rotateZ(-Math.PI / 2); geometry.rotateX(-Math.PI / 2);
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .01, side: THREE.DoubleSide }));
            mesh.userData.cardId = card.id;
            const side = index < 5 ? -1 : 1;
            const [x,z] = data?.tiled ? floorSlot(index,data.tiled) : [-0.5 + (2 - index % 5) * 1.8125, side * (2.8 + (column.length - 1 - depth) * .75)];
            mesh.position.set(x, data?.tiled ? .035 : .035 + depth * .008, z);
            tableau.add(mesh);
            const source = Array.from(field?.querySelectorAll<HTMLButtonElement>('[data-battle-card]') ?? []).find(node => node.dataset.battleCard === card.id);
            if (!source) return;
            if (stepping) mesh.material.color.setHex(card.reachable ? 0xffffff : 0x4a4a4a);
            const key = stepping ? JSON.stringify([card.rank, source.dataset.buried]) : JSON.stringify([card.rank, card.reachable, card.selected, source.dataset.buried, source.disabled]);
            let captured = cardCaptures.get(key);
            // Only a lit, unmarked card is a clean face to reuse; others keep the drawn face until one appears.
            if (!captured && stepping && (!card.reachable || source.disabled || source.hasAttribute('data-stepping-stand'))) return;
            if (!captured) {
              captured = captureQueue.then(async () => {
                if (disposed) throw new Error('Arena closed');
                const {default: capture} = await import('html2canvas');
                // html2canvas misplaces text in the centered CSS grid. Capture the
                // plaque without its glyph, then draw that glyph at the plaque's
                // actual center using the browser's canvas text renderer.
                const ink = source.querySelector<HTMLElement>('.proto-card-value-ink');
                const sourceBounds = source.getBoundingClientRect();
                const inkBounds = ink?.getBoundingClientRect();
                const inkStyle = ink ? getComputedStyle(ink) : null;
                // Snapshot these values before the asynchronous capture: the
                // source node can be replaced or restyled while it is queued.
                const fontSize = parseFloat(inkStyle?.fontSize || '') || Math.max(24, sourceBounds.width * .62);
                const fontFamily = inkStyle?.fontFamily || "'Classic Pixel', monospace";
                const fontWeight = inkStyle?.fontWeight || '700';
                const canDrawRank = Boolean(inkBounds && sourceBounds.width && sourceBounds.height);
                const rankX = inkBounds && sourceBounds.width ? Math.max(0, Math.min(sourceBounds.width, inkBounds.left - sourceBounds.left + inkBounds.width / 2)) : sourceBounds.width / 2;
                const rankY = inkBounds && sourceBounds.height ? Math.max(0, Math.min(sourceBounds.height, inkBounds.top - sourceBounds.top + inkBounds.height / 2)) : sourceBounds.height / 2;
                const face = await capture(source, {backgroundColor: null, scale: 3, logging: false, onclone: cloned => {
                  const clonedCard = Array.from(cloned.querySelectorAll<HTMLElement>('[data-battle-card]')).find(node => node.dataset.battleCard === card.id);
                  const clonedInk = clonedCard?.querySelector<HTMLElement>('.proto-card-value-ink');
                  if (clonedInk && canDrawRank) { clonedInk.style.color = 'transparent'; clonedInk.style.textShadow = 'none'; }
                }});
                if (canDrawRank) {
                  const context = face.getContext('2d');
                  if (context) {
                    const sx = face.width / sourceBounds.width, sy = face.height / sourceBounds.height;
                    context.save(); context.scale(sx, sy);
                    context.font = fontWeight + ' ' + fontSize + 'px ' + fontFamily;
                    context.fillStyle = '#fff3d6'; context.textAlign = 'center'; context.textBaseline = 'middle';
                    context.shadowColor = 'rgba(0,0,0,.65)'; context.shadowBlur = 1;
                    context.fillText(rankLabel(card.rank), rankX, rankY);
                    context.restore();
                  }
                }
                return face;
              });
              captureQueue = captured.then(() => undefined, () => undefined);
              cardCaptures.set(key, captured);
              captured.catch(() => cardCaptures.delete(key));
            }
            void captured.then(face => {
              if (disposed || revision !== tableauRevision || mesh.parent !== tableau) return;
              const actual = new THREE.CanvasTexture(face); actual.colorSpace = THREE.SRGBColorSpace;
              mesh.material.map?.dispose(); mesh.material.map = actual; mesh.material.needsUpdate = true; schedule();
            }).catch(error => console.warn('Could not capture tableau card', error));
          }));
          tableau.updateMatrixWorld(true);
          rig?.setTableauPeekBounds(tableau.children.length ? new THREE.Box3().setFromObject(tableau) : undefined);
        };
        // Read the live turn after loading; the enemy may have taken over meanwhile.
        const openingTeam = attackingTeamRef.current ?? firstTeam;
        selected = openingTeam; setCameraView(openingTeam);
        followedTeam.current = attackingTeamRef.current;
        const cameraControls = createCombatCameraControls(camera, openingTeam);
        const cameraAction = createCombatCameraAction();
        const basePosition = new THREE.Vector3();
        const cameraRight = new THREE.Vector3();
        let displayedTime = 0;
        const entered = gameTime.now();
        const combatClock = createCombatClock(entered / 1000);
        const cameraClock = createCombatClock(entered / 1000);
        let authoredCamera = false;
        let actionStarted: number | null = null;
        let lastTick = -1, lastFrame = entered, lastReadout = -Infinity;
        const paint = (now: number) => {
          // Entry overview and scripted battle action have independent clocks.
          const cameraTime = selected === 'cinematic' ? displayedTime : (now - entered) / 1000;
          const cueTime = cameraClock.sample(now / 1000, Boolean(battleRef.current?.paused) || document.hidden) * 1000;
          const shot = cameraControls.update(cameraTime, authoredCamera ? cueTime : now, reduced);
          const seconds = combatClock.sample(now / 1000, Boolean(battleRef.current?.paused));
          pendingCues.current.splice(0).forEach(cue => {
            rig!.cue(cue, seconds);
            if (cue.kind === 'attack') {
              const actors = rig!.snapshot();
              const attacker = actors.find(actor => actor.id === cue.actorId);
              const target = actors.find(actor => actor.id === cue.targetId);
              cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
              const direction = attacker && target ? Math.sign((target.position[0] - attacker.position[0]) * cameraRight.x + (target.position[1] - attacker.position[1]) * cameraRight.z) : 0;
              cameraAction.cue(cue, seconds, direction);
            }
          });
          updateTableau(); updateReachRings();
          if (battleRef.current) { rig!.setSurge(Boolean(battleRef.current.darknessSurge)); rig!.setWeedOptions(battleRef.current.weedOptions ?? {girth:1,sway:1}); rig!.setUnits(battleRef.current.units, seconds); }
          rig!.setAmbushed(Boolean(battleRef.current?.ambushed));
          const action = cameraAction.sample(seconds, reduced);
          basePosition.copy(camera.position);
          cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
          camera.position.addScaledVector(cameraRight, action.drift);
          camera.zoom = action.zoom; camera.updateProjectionMatrix();
          renderer!.domElement.style.filter = action.blur > .001 ? `blur(${action.blur.toFixed(3)}px)` : '';
          rig!.update(displayedTime, reduced, seconds); rig!.present(renderer!); renderer!.render(scene, camera);
          rig!.projectDropTargets(canvasBounds.width, canvasBounds.height, (id, bounds, targetable) => {
            let region = dropRegions.get(id);
            if (!region && host.current) {
              region = document.createElement('div'); region.className = 'combat-demo__drop-target';
              region.dataset.sceneTarget = id;
              region.setAttribute('aria-hidden', 'true'); host.current.append(region); dropRegions.set(id, region);
            }
            if (!region) return;
            const left = bounds ? Math.max(0, canvasBounds.left + bounds.left - arenaBounds.left) : 0;
            const top = bounds ? Math.max(0, canvasBounds.top + bounds.top - arenaBounds.top) : 0;
            const right = bounds ? Math.min(arenaBounds.width, canvasBounds.left + bounds.right - arenaBounds.left) : 0;
            const bottom = bounds ? Math.min(arenaBounds.height, canvasBounds.top + bounds.bottom - arenaBounds.top) : 0;
            region.hidden = !bounds || right <= left || bottom <= top;
            region.dataset.targetable = String(targetable && !region.hidden);
            region.dataset.depth = String(bounds?.depth ?? 0);
            if (!region.hidden) Object.assign(region.style, { left: left+'px', top: top+'px', width: (right-left)+'px', height: (bottom-top)+'px' });
          });
          if (host.current) {
            host.current.dataset.cameraView = selected;
            host.current.dataset.cameraPosition = camera.position.toArray().map(n => n.toFixed(3)).join(',');
            host.current.dataset.cameraTarget = shot.target.toArray().map(n => n.toFixed(3)).join(',');
            host.current.dataset.cameraMoving = String(shot.moving);
            host.current.dataset.actionStarted = String(actionStarted !== null);
            host.current.dataset.combatTime = String(seconds);
            host.current.dataset.combatPaused = String(Boolean(battleRef.current?.paused));
            host.current.dataset.actionZoom = String(action.zoom);
            host.current.dataset.actionBlur = String(action.blur);
            if (import.meta.env.DEV) { host.current.dataset.actors = JSON.stringify(rig!.snapshot()); host.current.dataset.khadFace=JSON.stringify(rig!.khadFace()??null); }
          }
          if (now - lastReadout >= 100 || displayedTime === COMBAT_DEMO_SECONDS) {
            lastReadout = now; setCameraInfo(cameraControls.snapshot());
          }
          // Input and authored framing always operate on the unmodified camera.
          camera.position.copy(basePosition); camera.zoom = 1; camera.updateProjectionMatrix();
          return shot.moving;
        };
        const schedule = () => { if (!disposed && !frame) frame = gameTime.requestAnimationFrame(render); };
        const render = (now: number) => {
          frame = 0;
          if (disposed) return;
          const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
          if (manualEnabled && selected === 'freecam' && heldKeys.size) {
            const right = Number(heldKeys.has('d')) - Number(heldKeys.has('a'));
            const forward = Number(heldKeys.has('w')) - Number(heldKeys.has('s'));
            const up = Number(heldKeys.has('e')) - Number(heldKeys.has('q'));
            const length = Math.hypot(right, forward, up) || 1;
            const speed = Math.max(2, cameraControls.snapshot().distance * .5) * dt / length;
            cameraControls.pan(right * speed, forward * speed, up * speed);
          }
          const t = actionStarted === null ? 0 : Math.min(COMBAT_DEMO_SECONDS, combatClock.sample(now / 1000, Boolean(battleRef.current?.paused)) - actionStarted / 1000);
          displayedTime = t;
          const moving = paint(now);
          if (Math.floor(t * 10) !== lastTick) { lastTick = Math.floor(t * 10); setElapsed(t); }
          setStatus(actionStarted === null
            ? attackingTeamRef.current ? moving ? 'Following attackers' : `${attackingTeamRef.current === 'party' ? 'Player' : 'Enemy'} turn`
              : moving ? 'Battlefield overview' : `${firstTeam === 'party' ? 'Player' : 'Enemy'} goes first`
            : reduced ? 'Reduced motion · scene effects off' : demoPhase(t));
          // Keep the forest breeze live after the camera and battle cues settle.
          if (!reduced || (actionStarted !== null && t < COMBAT_DEMO_SECONDS) || moving || heldKeys.size || rig!.busy(combatClock.time)) schedule();
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
          const density = layout.classList.contains('banks-rescue-cinema__stage') ? 1 : battleRef.current?.verticalTableau ? 1.5 : 2;
          renderer.setSize(Math.max(1,Math.round(width/density)),Math.max(1,Math.round(height/density)),false);
          canvasBounds = { left, top, width, height }; arenaBounds = arena;
          rig?.setMarkerViewport(width,height);
          // Extend the original lens sideways/upwards instead of recentering,
          // stretching, or duplicating the arena image beneath the cards.
          if (visibleArena) camera.setViewOffset(arena.width,arena.height,left-arena.left,top-arena.top,width,height);
          else { camera.clearViewOffset(); camera.aspect = width/height; }
          camera.updateProjectionMatrix();
          renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
          sharedSurface.dataset.projection = visibleArena ? 'extended' : 'tableau';
          paint(gameTime.now());
        };
        // Manual input takes over the current shot without changing the toggle.
        const beginManual = () => {
          if (!manualEnabled) return false;
          if (selected !== 'freecam') {
            authoredCamera = false; selected = 'freecam'; setCameraView('freecam');
            cameraControls.select('freecam', gameTime.now());
          }
          return true;
        };
        const arena = host.current;
        let drag: {id: number; x: number; y: number; pan: boolean} | null = null;
        const clearDrag = () => {
          const id = drag?.id;
          drag = null; delete arena.dataset.dragging;
          if (id !== undefined && arena.hasPointerCapture(id)) arena.releasePointerCapture(id);
        };
        controls.current = {
          frame(cue) { clearInput(); clearDrag(); authoredCamera = true; selected = 'side'; setCameraView('side'); const now = gameTime.now(); cameraControls.frame(cue, cameraClock.sample(now / 1000, Boolean(battleRef.current?.paused) || document.hidden) * 1000); lastReadout = -Infinity; paint(now); schedule(); },
          select(view) {
            clearInput(); clearDrag(); authoredCamera = false; selected = view; const now = gameTime.now();
            if (view === 'cinematic') { actionStarted = combatClock.sample(now / 1000, Boolean(battleRef.current?.paused)) * 1000; lastTick = -1; displayedTime = 0; setElapsed(0); }
            cameraControls.select(view, now); lastReadout = -Infinity; paint(now); schedule();
          },
          toggleFreecam() {
            manualEnabled = !manualEnabled; setFreecamEnabled(manualEnabled);
            clearInput(); clearDrag(); lastReadout = -Infinity; paint(gameTime.now());
          },
          replay() { actionStarted = combatClock.sample(gameTime.now() / 1000, Boolean(battleRef.current?.paused)) * 1000; lastTick = -1; displayedTime = 0; setElapsed(0); schedule(); },
          move(key, held) { if (held && !beginManual()) return; if (held) { if (!heldKeys.size) lastFrame = gameTime.now(); heldKeys.add(key); schedule(); } else { heldKeys.delete(key); lastReadout = -Infinity; paint(gameTime.now()); } },
          refresh() { const now = gameTime.now(); if (paint(now) || rig!.busy(combatClock.time)) schedule(); },
          cue() { const info = cameraControls.snapshot(); return { t: Number(displayedTime.toFixed(3)), p: info.position, target: info.target, fov: info.fov }; },
        };
        const pointerDown = (event: PointerEvent) => {
          if (protoGestures && (event.pointerType === 'touch' || event.button === 0)) return;
          if (drag || ![0, 1, 2].includes(event.button) || !beginManual()) return;
          // touch-action already owns the gesture. Cancelling touch presses can
          // suppress subsequent compatibility clicks on the camera buttons.
          if (event.pointerType !== 'touch') event.preventDefault();
          arena.setPointerCapture(event.pointerId);
          drag = {id: event.pointerId, x: event.clientX, y: event.clientY, pan: protoGestures ? event.button !== 1 : event.button !== 0 || event.shiftKey};
          arena.dataset.dragging = 'true';
        };
        const pointerMove = (event: PointerEvent) => {
          if (!drag || event.pointerId !== drag.id) return;
          if (!manualEnabled || selected !== 'freecam') { pointerEnd(event); return; }
          const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
          drag.x = event.clientX; drag.y = event.clientY;
          if (drag.pan) {
            const units = cameraControls.snapshot().distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, arena.clientHeight);
            cameraControls.pan(-dx * units, -dy * units, 0);
          } else cameraControls.orbit(dx * .005, dy * .005);
          lastReadout = -Infinity; paint(gameTime.now());
        };
        const pointerEnd = (event: PointerEvent) => {
          if (drag?.id !== event.pointerId) return;
          clearDrag();
        };
        const wheel = (event: WheelEvent) => {
          if (!beginManual()) return;
          event.preventDefault();
          const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? arena.clientHeight : 1);
          cameraControls.dolly(THREE.MathUtils.clamp(pixels * .001, -.3, .3));
          lastReadout = -Infinity; paint(gameTime.now());
        };
        // Match the map: one finger pans, two pan/pinch, three twist and tilt.
        let touches: { x: number; y: number; distance: number; angles: Map<number, number>; count: number } | null = null;
        const touchFrame = (list: TouchList) => {
          const points = Array.from(list), x = points.reduce((sum, p) => sum + p.clientX, 0) / points.length, y = points.reduce((sum, p) => sum + p.clientY, 0) / points.length;
          return { x, y, distance: points.length >= 2 ? Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY) : 0, angles: new Map(points.map(p => [p.identifier, Math.atan2(p.clientY - y, p.clientX - x)])), count: points.length };
        };
        const touchStart = (event: TouchEvent) => { if (protoGestures && event.touches.length && beginManual()) touches = touchFrame(event.touches); };
        const touchMove = (event: TouchEvent) => {
          if (!protoGestures || !touches || !event.touches.length || !manualEnabled) return;
          event.preventDefault();
          const next = touchFrame(event.touches);
          if (next.count === touches.count) {
            const dx = next.x - touches.x, dy = next.y - touches.y;
            if (next.count < 3) {
              const units = cameraControls.snapshot().distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, arena.clientHeight);
              cameraControls.pan(-dx * units, -dy * units, 0);
              if (next.count === 2 && touches.distance > 0 && next.distance > 0) cameraControls.dolly(Math.log(touches.distance / next.distance));
            } else {
              let sum = 0, count = 0;
              next.angles.forEach((angle, id) => { const previous = touches!.angles.get(id); if (previous !== undefined) { sum += Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)); count++; } });
              if (count) cameraControls.orbit(-sum / count, dy * .005);
            }
            lastReadout = -Infinity; paint(gameTime.now());
          }
          touches = next;
        };
        const touchEnd = (event: TouchEvent) => { touches = event.touches.length ? touchFrame(event.touches) : null; };
        arena.addEventListener('touchstart', touchStart, {passive: true}); arena.addEventListener('touchmove', touchMove, {passive: false}); arena.addEventListener('touchend', touchEnd); arena.addEventListener('touchcancel', touchEnd);
        // The same DOM card remains the source of truth for legality and receipt behavior.
        const raycaster = new THREE.Raycaster(), clickPoint = new THREE.Vector2();
        const clickCard = (event: MouseEvent) => {
          if (event.button !== 0 || !battleRef.current?.verticalTableau || !canvasBounds.width || !canvasBounds.height) return;
          clickPoint.set((event.clientX - canvasBounds.left) / canvasBounds.width * 2 - 1, 1 - (event.clientY - canvasBounds.top) / canvasBounds.height * 2);
          camera.updateMatrixWorld();
          raycaster.setFromCamera(clickPoint, camera);
          const hit = raycaster.intersectObjects(tableau.children)[0];
          const id = hit?.object.userData.cardId;
          if (typeof id !== 'string') return;
          const source = Array.from(field?.querySelectorAll<HTMLButtonElement>('[data-battle-card]') ?? []).find(card => card.dataset.battleCard === id);
          source?.click();
        };
        const contextMenu = (event: Event) => event.preventDefault();
        arena.addEventListener('pointerdown', pointerDown); arena.addEventListener('pointermove', pointerMove);
        arena.addEventListener('pointerup', pointerEnd); arena.addEventListener('pointercancel', pointerEnd); arena.addEventListener('lostpointercapture', pointerEnd);
        arena.addEventListener('click', clickCard);
        arena.addEventListener('wheel', wheel, {passive: false}); arena.addEventListener('contextmenu', contextMenu);
        detachPointer = () => {
          arena.removeEventListener('pointerdown', pointerDown); arena.removeEventListener('pointermove', pointerMove);
          arena.removeEventListener('pointerup', pointerEnd); arena.removeEventListener('pointercancel', pointerEnd); arena.removeEventListener('lostpointercapture', pointerEnd);
          arena.removeEventListener('click', clickCard);
          arena.removeEventListener('wheel', wheel); arena.removeEventListener('contextmenu', contextMenu);
          arena.removeEventListener('touchstart', touchStart); arena.removeEventListener('touchmove', touchMove); arena.removeEventListener('touchend', touchEnd); arena.removeEventListener('touchcancel', touchEnd);
        };
        observer = new ResizeObserver(resize); observer.observe(host.current); observer.observe(layout); if (field) observer.observe(field); resize();
        setReady(true); schedule();
      } catch (error) { if (!disposed) setStatus(`Arena could not load: ${error instanceof Error ? error.message : 'WebGL unavailable'}`); }
    }
    void start();
    return () => { disposed = true; controls.current = null; clearInput(); detachPointer(); gameTime.cancelAnimationFrame(frame); observer?.disconnect(); dropRegions.forEach(region => region.remove()); rig?.dispose(); tableauCleanup(); textures.forEach(t => t.dispose()); renderer?.dispose(); renderer?.domElement.remove(); sharedSurface?.remove(); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', clearInput); document.removeEventListener('visibilitychange', visibility); if (previous?.isConnected) previous.focus(); };
  }, [firstTeam, artStyle, protoGestures]);
  const hadAuthoredShot = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (cameraShot) { controls.current?.frame(cameraShot); hadAuthoredShot.current = true; }
    else if (hadAuthoredShot.current) { controls.current?.select(firstTeam); hadAuthoredShot.current = false; }
  }, [cameraShot?.id, ready, artStyle]);
  useEffect(() => {
    if (!ready || !attackingTeam || attackingTeam === followedTeam.current) return;
    followedTeam.current = attackingTeam;
    // Reuse the orbital preset transition without rebuilding the arena or replaying cues.
    controls.current?.select(attackingTeam);
  }, [attackingTeam, ready, artStyle]);
  return <section data-ready={ready || undefined} data-authored-shot={cameraShot?.id} ref={dialog} className="combat-demo proto-map" aria-labelledby="combat-demo-title" tabIndex={-1} data-elapsed={elapsed.toFixed(1)} data-complete={elapsed >= COMBAT_DEMO_SECONDS || undefined} data-camera-view={cameraView} data-freecam-enabled={freecamEnabled}>
    {overlay}
    {!ready && !status.startsWith('Arena could not load:') && <HeroLoading className="combat-world-loading">{protoGestures?'Entering the woods…':status}</HeroLoading>}
    {battle?.verticalTableau && <div ref={foundationOverlay} className="combat-demo__foundations battle-field" aria-hidden="true" inert>
      <div className="combat-demo__foundation-overlay battle-enemy-unit" data-foundation-overlay="enemy" />
      <div className="combat-demo__foundation-overlay battle-field__slot" data-foundation-overlay="party" />
    </div>}
    <div ref={host} className="combat-demo__arena" aria-label="Combatants in a Three.js forest arena" />
    {status.startsWith('Arena could not load:') && <div role="alert" className="combat-demo__load-error">{status}</div>}
    <details className="combat-demo__tools"><summary>Camera controls</summary>
    <header className="combat-demo__header"><h1 id="combat-demo-title">Dark Woods · battle</h1><CameraButton type="button" onClick={onClose}>Return to table · Esc</CameraButton></header>
    <footer className="combat-demo__footer">
      <div className="combat-demo__readout"><span>{status}</span><span>{elapsed.toFixed(1)} / 10s</span></div>
      <div className="combat-demo__camera-panel">
        <div className="combat-demo__views" role="group" aria-label="Camera angles">
          {COMBAT_CAMERA_VIEWS.map(view => <CameraButton key={view.id} type="button" className="combat-demo__view" data-view={view.id} aria-pressed={view.id === 'freecam' ? freecamEnabled : cameraView === view.id} title={view.id === 'freecam' ? (protoGestures ? 'Toggle manual camera control: right-drag to pan, middle-drag to orbit, wheel to zoom' : 'Toggle manual camera control: WASD pan, Q/E down/up, drag orbit, wheel distance') : view.description} disabled={!ready} onClick={() => { if (view.id === 'freecam') controls.current?.toggleFreecam(); else { setCameraView(view.id); controls.current?.select(view.id); } }}>
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
    </details>
    <CameraButton type="button" className="combat-demo__copy-quick" aria-label="Copy camera data" disabled={!ready} onClick={async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(controls.current?.cue(), null, 2)); setCopyStatus('Camera data copied'); }
      catch { setCopyStatus('Copy unavailable'); }
    }}>{copyStatus === 'Copy camera cue' ? 'Copy camera data' : copyStatus}</CameraButton>
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
