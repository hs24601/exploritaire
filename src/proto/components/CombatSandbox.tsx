import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { isTextEditingTarget } from '../keyboardInput';
import { useGlobalPauseLifecycle } from './GlobalPause';
import { BattleTableauField } from './BattleTableauField';
import './CombatSandbox.css';
import type { BattleScene } from '../rules/battleCues';

const BattleCamera = lazy(() => import('./CombatDemo').then(module => ({ default: module.CombatDemo })));

// Translate the authored Khad identity to the existing arena rig slot.
function cameraScene(scene: BattleScene): BattleScene {
  // Tutorial scenarios name their Khad Roots; map enemies to the rig slots in order.
  const slots = ['dark-slime', 'rear-slime', 'small-slime'], enemies = scene.units.filter(unit => unit.team === 'enemy').map(unit => unit.id);
  const id = (value: string) => value === 'khad-root' ? 'dark-slime' : enemies.includes(value) && !slots.includes(value) ? slots[enemies.indexOf(value) % slots.length] : value;
  return { ...scene, units: scene.units.map(unit => ({ ...unit, id: id(unit.id) })),
    events: scene.events.map(event => ({ ...event,
      ...('sourceId' in event && typeof event.sourceId === 'string' ? { sourceId: id(event.sourceId) } : {}),
      ...('actorId' in event && typeof event.actorId === 'string' ? { actorId: id(event.actorId) } : {}),
      ...('targetId' in event && typeof event.targetId === 'string' ? { targetId: id(event.targetId) } : {}) })) };
}

function SandboxFps() {
 const label=useRef<HTMLOutputElement>(null);
 useEffect(()=>{
  let frame=0,last=performance.now(),previous=last,count=0,worst=0;
  const sample=(now:number)=>{const dt=now-previous;previous=now;if(!document.hidden){count++;worst=Math.max(worst,dt);if(now-last>=500){if(label.current)label.current.textContent=Math.round(count*1000/(now-last))+' FPS · '+worst.toFixed(0)+' ms peak';last=now;count=0;worst=0;}}else{last=now;count=0;worst=0;}frame=requestAnimationFrame(sample);};
  frame=requestAnimationFrame(sample);return()=>cancelAnimationFrame(frame);
 },[]);
 return <output ref={label} className="combat-sandbox__fps" aria-label="Rendering FPS and peak frame time">— FPS</output>;
}

/** Combat iteration with an on-demand live Three.js arena. */
export function CombatSandbox() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scene, setScene] = useState<BattleScene>();
  const [replay, setReplay] = useState(0);
  useGlobalPauseLifecycle();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTextEditingTarget(event.target)) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      // Own both phases so Space on a focused button cannot also activate it.
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keydown' && !event.repeat) gameTime.setPaused(!gameTime.isPaused());
    };
    const block = (event: Event) => {
      if (document.documentElement.dataset.combatInspection && !gameTime.isPlayerPaused()) return;
      if (!gameTime.isPaused() || !(event.target instanceof Element) || !event.target.closest('.combat-sandbox__pane')) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', shortcut, true);
    window.addEventListener('keyup', shortcut, true);
    const blocked = ['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'touchmove', 'click', 'dblclick', 'wheel', 'keydown', 'keyup'] as const;
    blocked.forEach(type => window.addEventListener(type, block, { capture: true, passive: false }));
    return () => {
      window.removeEventListener('keydown', shortcut, true);
      window.removeEventListener('keyup', shortcut, true);
      blocked.forEach(type => window.removeEventListener(type, block, true));
    };
  }, []);
  return <main className="combat-sandbox" data-lighting="disabled">
    <SandboxFps />
    <div className="proto-main-layout combat-sandbox__pane" data-primary-viewport="tableau" data-battle-camera={cameraOpen || undefined}>
      <div className="proto-tableau-field proto-tableau-field--combat">
        <BattleTableauField sandbox hours={12} lights={[]} active cameraOpen={cameraOpen} onWatch={() => setCameraOpen(open => !open)} onSceneChange={setScene} />
      </div>
      {cameraOpen && scene && <Suspense fallback={<div className="combat-sandbox__camera-loading" role="status">Loading battle camera…</div>}>
        <BattleCamera key={scene.sandboxSession + '-' + replay} battle={cameraScene(scene)} onClose={() => setCameraOpen(false)} onRestart={() => setReplay(value => value + 1)} />
      </Suspense>}
    </div>
  </main>;
}
