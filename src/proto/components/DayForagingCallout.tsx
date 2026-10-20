import { khadCalloutHeld } from '../tutorialQuests';
import { storyThoughtMarks, type DayCinematicBeat } from '../dayCinematics';
import type { ProtoState } from '../protoState';
import { dayOneThought, sparsePatchTableauComplete } from '../dayScenarios';
import { isHome } from '../rules/ordinaryDay';
import { Callout } from './Callout';
import { playCameraSteps } from '../cameraDirector';
import { sceneActorAnchor } from '../sceneProjection';

const heroAnchor = () => {
  // The live immersive map projects Hero without a per-frame layout read.
  const projected = sceneActorAnchor('hero');
  if (projected !== undefined) return projected;
  const actor = document.querySelector<HTMLElement>('.proto-map [data-actor-id="hero"][data-board-piece="actor"]');
  if (!actor) return null;
  const box = actor.getBoundingClientRect(), map = actor.closest('.proto-map')!.getBoundingClientRect();
  const x = box.left + box.width / 2, y = box.top;
  return box.width && box.height && x >= map.left && x <= map.right && y >= map.top && y <= map.bottom ? { x, y } : null;
};

export function DayForagingCallout({ state, hidden, cinematicBeat, onFaceTarget }: { onFaceTarget?: (target: {x:number;y:number})=>void; state: ProtoState; hidden?: boolean; cinematicBeat?: DayCinematicBeat | null }) {
  if (hidden || khadCalloutHeld(state)) return null;
  const lookTowardPatch=(index:number)=>{
    if(index!==1)return;
    const patch=state.biomeTiles.find(tile=>tile.id===state.dayScenarioTiles?.patchId);
    if(patch){onFaceTarget?.(patch.position);window.dispatchEvent(new CustomEvent('proto-quest-highlight',{detail:patch.id}));}
  };
  const solvedSparse=sparsePatchTableauComplete(state);
  if (cinematicBeat?.calloutId && (!state.journey || solvedSparse) && !state.dayTwoAmbush) return <Callout syncActorExpression={state.dayScenario === 'day01'} speaker="Hero" alignment="after" authoringId={cinematicBeat.calloutId} instanceKey={cinematicBeat.id} emoji={{actor: 'hero', emotion: state.dayScenario === 'day01' ? 'happy' : cinematicBeat.mood === 'night' || cinematicBeat.day === 'day03' ? 'joyful' : 'sad'}} text={dayOneThought(state)} marks={storyThoughtMarks(dayOneThought(state))} anchor={heroAnchor} durationMs={0} camera={{kind:'choreography',id:cinematicBeat.choreography.id}} bubbleCameras={cinematicBeat.bubbleCameras} onBubbleChange={cinematicBeat.id==='day01.opening' ? index => { if (index === 1) window.dispatchEvent(new Event('proto-opening-card-deal')); } : cinematicBeat.id==='day01.sparse-patch'?lookTowardPatch:undefined} onComplete={cinematicBeat.id === 'day01.opening' ? () => {
    const home = state.biomeTiles.find(tile => tile.id === 'hero-den')?.position;
    if (home) playCameraSteps([{ id: 'day01.opening.quest', name: 'Nearby bush / quest introduction', shot: { x: home.x + 4.11, y: home.y - 43.47, scale: 10.469, yaw: 200.4, pitch: 54.8, tilted: true, framing: .24 }, durationMs: 1800, holdMs: 0, easing: 'smooth' }], false, 'Nearby bush / quest introduction');
    window.dispatchEvent(new CustomEvent('proto-quest-highlight', { detail: state.dayScenarioTiles?.sparsePatchId }));
    window.dispatchEvent(new Event('proto-opening-card-deal'));
  } : undefined} />;
  if (state.dayScenario !== 'day01' || state.journey && !solvedSparse || state.ordinaryDay?.bedtime || state.ordinaryDay?.complete) return null;
  const sparse = state.biomeTiles.find(tile => tile.id === state.dayScenarioTiles?.sparsePatchId);
  const hero = state.worldActors.find(actor => actor.id === 'hero');
  const nearby = solvedSparse || sparse?.berryHarvested && hero && Math.hypot(hero.position.x-sparse.position.x,hero.position.y-sparse.position.y)<1;
  const supper = state.ordinaryDay?.supper && isHome(state);
  if (!nearby && !supper) return null;
  return <Callout syncActorExpression speaker="Hero" emoji={{ actor: 'hero', emotion: 'happy' }}
    onBubbleChange={!supper?lookTowardPatch:undefined} authoringId={supper ? 'day01.saved-light' : 'day01.sparse-patch'} instanceKey={supper ? 'saved-light' : 'sparse-patch'} text={dayOneThought(state)} anchor={heroAnchor} durationMs={0} />;
}
