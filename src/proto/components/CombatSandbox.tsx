import {HeroLoading} from '../../ui/HeroLoader';
import type {CardRarity} from '../cardRarity';
import { lazy, Suspense, type ReactNode, useEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { isTextEditingTarget } from '../keyboardInput';
import { useGlobalPauseLifecycle } from './GlobalPause';
import { BattleTableauField } from './BattleTableauField';
import './CombatSandbox.css';
import type { BattleScene } from '../rules/battleCues';
import type { BattleState } from '../rules/battle';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from '../battleTurnPriority';
import { COMBAT_SANDBOX_SCENARIOS } from '../rules/battleSandboxScenarios';
import { isTiledFloor } from '../rules/verticalColumns';

const BattleCamera = lazy(() => import('./CombatDemo').then(module => ({ default: module.CombatDemo })));

// Translate the authored Khad identity to the existing arena rig slot.
// 223: Hero stands in the centre aisle beside her card's row, so her sprite never covers card values.
const aisleSpot = (stand?: readonly [number, number]): readonly [number, number] => stand ? [stand[0], Math.sign(stand[1]) * Math.min(Math.abs(stand[1]), 1.4)] : [-6.5, 0];
function cameraScene(scene: BattleScene): BattleScene {
  // Tutorial scenarios name their Khad Roots; map enemies to the rig slots in order.
  const slots = ['dark-slime', 'rear-slime', 'small-slime'], enemies = scene.units.filter(unit => unit.team === 'enemy').map(unit => unit.id);
  const id = (value: string) => value === 'khad-root' ? 'dark-slime' : enemies.includes(value) && !slots.includes(value) ? slots[enemies.indexOf(value) % slots.length] : value;
  return { ...scene, units: scene.units.map(unit => ({ ...unit, id: id(unit.id), ...(scene.verticalTableau ? { position: (unit.team === 'party' ? (scene.verticalTableau.tiled ? scene.verticalTableau.stepping?.stand ?? [-8,0] : aisleSpot(scene.verticalTableau.stepping?.stand)) : (scene.verticalTableau.tiled ? scene.verticalTableau.stepping?.enemy?.stand ?? [8,0] : [10, 0])) as readonly [number, number] } : {}) })),
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
export function CombatSandbox({ scenarioIds, onBattleChange, showFps = true, followTurnCamera = false, musicalCombat = false, biteRarity, configContent }: { scenarioIds?: readonly string[]; onBattleChange?: (battle: BattleState) => void; showFps?: boolean; followTurnCamera?: boolean; musicalCombat?: boolean; configContent?: ReactNode; biteRarity?:CardRarity } = {}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [attackingTeam, setAttackingTeam] = useState<BattleTeam>(BATTLE_TURN_PRIORITY[0]);
  const [scene, setScene] = useState<BattleScene>();
  const [replay, setReplay] = useState(0);
  const previousScenario = useRef<string | undefined>(undefined);
  const scenarioId = scene?.sandboxSession?.split('-')[0];
  const mobileScene = Boolean(cameraOpen && isTiledFloor(scenarioId));
  const setScenario = (value: string) => {
    const select = document.querySelector<HTMLSelectElement>('.proto-tableau-field--combat select[aria-label="Combat scenario"]');
    if (!select) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const endTurn = () => document.querySelector<HTMLButtonElement>('.proto-tableau-field--combat .battle-end-turn')?.click();
  useEffect(() => {
    const scenario = scene?.sandboxSession?.split('-')[0];
    if (scenario && scenario !== previousScenario.current) {
      previousScenario.current = scenario;
      if (scenario === '222' || scenario === '223' || isTiledFloor(scenario)) setCameraOpen(true);
    }
  }, [scene?.sandboxSession]);
  useGlobalPauseLifecycle();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTextEditingTarget(event.target)) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.target instanceof Element && event.target.closest('.ability-fan-overlay, .card-jumbo')) return;
      // Own both phases so Space on a focused button cannot also activate it.
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keydown' && !event.repeat && !gameTime.isPaused()) {
        const endTurn = document.querySelector<HTMLButtonElement>('.combat-sandbox .battle-end-turn');
        if (endTurn && !endTurn.disabled) endTurn.click();
      }
    };
    const block = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.scenario-share')) return;
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
    {showFps && <SandboxFps />}
    <div className="proto-main-layout combat-sandbox__pane" data-primary-viewport="tableau" data-battle-camera={cameraOpen || undefined} data-mobile-scene-only={mobileScene || undefined}>
      <div className="proto-tableau-field proto-tableau-field--combat">
        <BattleTableauField biteRarity={biteRarity} configContent={configContent} musicalCombat={musicalCombat} scenarioIds={scenarioIds} onBattleChange={battle => { if (followTurnCamera) setAttackingTeam(battle.turn ?? BATTLE_TURN_PRIORITY[0]); onBattleChange?.(battle); }} sandbox hours={12} lights={[]} active cameraOpen={cameraOpen} onWatch={() => setCameraOpen(open => !open)} onSceneChange={setScene} />
      </div>
      {mobileScene && <div className="combat-sandbox__mobile-controls">
        <label><span className="sr-only">Combat scenario</span><select aria-label="Combat scenario" value={scenarioId} onChange={event => setScenario(event.target.value)}>{COMBAT_SANDBOX_SCENARIOS.filter(option => !scenarioIds || scenarioIds.includes(option.id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <button type="button" onClick={endTurn}>End turn</button>
      </div>}
      {cameraOpen && scene && <Suspense fallback={<HeroLoading className="combat-sandbox__camera-loading">Loading battle camera…</HeroLoading>}>
        <BattleCamera protoGestures attackingTeam={followTurnCamera ? attackingTeam : undefined} cameraShot={scene.verticalTableau ? { id: '222-overhead', name: 'Tableau overhead', position: [-4.563388459635505, 25.28833890436192, 0.46119035666927677], target: [-1.402874591999775, 1.1, 0.5680114122948188], durationMs: 1 } : undefined} key={(followTurnCamera ? scene.battleSession : scene.sandboxSession) + '-' + replay} battle={cameraScene(scene)} onClose={() => setCameraOpen(false)} onRestart={() => setReplay(value => value + 1)} />
      </Suspense>}
    </div>
  </main>;
}

