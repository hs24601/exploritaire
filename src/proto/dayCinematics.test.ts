import { describe, it, expect } from 'vitest';
import { buildDayCinematicBeats, dayCinematicBeatId } from './dayCinematics';
import { createDayOneState, createDayTwoState, createDayThreeState } from './dayScenarios';
import { validChoreography } from './cameraChoreography';
import { createCombatCameraControls } from './combatDemoRig';
import { DAY_TWO_RESCUE_SHOTS } from './dayRescueShots';
import * as THREE from 'three';
describe('opening days cinematic first pass', () => {
  it('ships valid, named shot sequences without changing the authored world', () => {
    const state = createDayOneState(), before = JSON.stringify(state);
    const beats = buildDayCinematicBeats(state);
    expect(beats).toHaveLength(13); expect(new Set(beats.map(b => b.choreography.id)).size).toBe(13);
    expect(beats.every(b => validChoreography(b.choreography))).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(dayCinematicBeatId(state)).toBe('day01.opening');
  });
  it('derives every shelter shot from the latest authored den position', () => {
    const state = createDayOneState(); const moved = { ...state, biomeTiles: state.biomeTiles.map(t => t.id === 'hero-den' ? { ...t, position: { x: 144, y: 192 } } : t) };
    const opening = buildDayCinematicBeats(moved)[0];
    expect(opening.choreography.steps.every(s => s.shot.x === 144 && s.shot.y === 192)).toBe(true);
    expect(opening.choreography.steps.every(s => s.shot.yaw >= 135 && s.shot.yaw <= 225)).toBe(true);
    // The second composition is reader-triggered, never a timed step in the opening.
    expect(opening.choreography.steps).toHaveLength(1);
    expect(opening.choreography.steps[0].shot).toMatchObject({ scale: 9.165, yaw: 194, pitch: 17.6 });
    const second = opening.bubbleCameras?.[1];
    expect(second?.kind).toBe('shot');
    if (second?.kind !== 'shot') throw new Error('Missing second-bubble shot');
    expect(second.step.shot).toEqual({ x: 144, y: 192, scale: 9.935, yaw: 186.4, pitch: 82, tilted: true, framing: .24 });
    expect(second.step.durationMs).toBe(1800);
    expect(second.step.easing).toBe('smooth');
  });
  it('only changes camera beats at real story milestones', () => {
    const state = createDayOneState();
    const exposed = { ...state, biomeTiles: state.biomeTiles.map(t => t.id === state.dayScenarioTiles?.sparsePatchId ? { ...t, berryHarvested: true } : t) };
    expect(dayCinematicBeatId(exposed)).toBeNull();
    expect(dayCinematicBeatId({ ...exposed, discoveredTutorialQuests: ['denser-patch'] })).toBeNull();
    expect(dayCinematicBeatId({ ...exposed, discoveredTutorialQuests: ['denser-patch'], dockedTutorialQuests: ['denser-patch'] })).toBe('day01.sparse-patch');
    expect(dayCinematicBeatId({ ...state, ordinaryDay: { ...state.ordinaryDay!, supper: true } })).toBe('day01.saved-light');
    expect(dayCinematicBeatId({ ...state, ordinaryDay: { ...state.ordinaryDay!, supper: true, bedtime: true } })).toBe('day01.rest');
    expect(dayCinematicBeatId({ ...state, dayScenario: undefined })).toBeNull();
    const second = createDayTwoState(); expect(dayCinematicBeatId(second)).toBe('day02.opening');
    expect(dayCinematicBeatId({ ...second, haul: { ...second.haul, mana: 2 } })).toBe('day02.scarcity');
    expect(dayCinematicBeatId({ ...second, dayTwoAmbush: true })).toBeNull();
    expect(dayCinematicBeatId(createDayThreeState())).toBe('day03.opening');
  });
  it('gives the rescue real per-beat camera cues and respects manual takeover', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100), controls = createCombatCameraControls(camera);
    controls.update(4,0,true); controls.frame(DAY_TWO_RESCUE_SHOTS.hope,0);
    const before = camera.position.clone(); controls.update(4,500,false); expect(camera.position.equals(before)).toBe(false);
    controls.update(4,2000,false); expect(camera.position.toArray()).toEqual([...DAY_TWO_RESCUE_SHOTS.hope.position]);
    controls.select('freecam',2100); const manual = camera.position.clone(); controls.update(4,4000,false); expect(camera.position.equals(manual)).toBe(true);
    expect(Object.keys(DAY_TWO_RESCUE_SHOTS)).toHaveLength(15);
  });
});

it('pins the actual den and sparse bush for the opening section only, including its first trip', async () => {
  const { dayCinematicLabelBeatId } = await import('./dayCinematics');
  const state = createDayOneState(), sparseId = state.dayScenarioTiles!.sparsePatchId!;
  const beats = buildDayCinematicBeats(state);
  const labels = (s: typeof state) => beats.find(b => b.id === dayCinematicLabelBeatId(s))?.choreography.tileLabelIds ?? [];
  expect(labels(state)).toEqual(['hero-den', sparseId]);
  // Any active journey releases the camera but retains labels for this section.
  expect(labels({ ...state, journey: { actorId: 'hero' } as NonNullable<typeof state.journey> })).toEqual(['hero-den', sparseId]);
  expect(labels({ ...state, biomeTiles: state.biomeTiles.map(t => t.id === sparseId ? { ...t, berryHarvested: true } : t) })).toEqual([]);
  expect(labels({ ...state, dayScenario: undefined })).toEqual([]);
  expect(labels(createDayTwoState())).toEqual([]);
  expect(labels(createDayThreeState())).toEqual([]);
});

it('frames the actual denser patch from Hero on the second sparse-reflection bubble',()=>{
  const state=createDayOneState();
  const shotFor=(s:typeof state)=>{const camera=buildDayCinematicBeats(s).find(b=>b.id==='day01.sparse-patch')!.bubbleCameras![1];if(camera.kind!=='shot')throw Error('Expected quest shot');return camera.step;};
  const sparse=state.biomeTiles.find(t=>t.id===state.dayScenarioTiles!.sparsePatchId)!,patch=state.biomeTiles.find(t=>t.id===state.dayScenarioTiles!.patchId)!;
  expect(shotFor(state)).toMatchObject({durationMs:1800,holdMs:0,shot:{x:(sparse.position.x+patch.position.x)/2,y:(sparse.position.y+patch.position.y)/2,scale:10.9,yaw:90,pitch:54.8,tilted:true}});
  const moved={...state,biomeTiles:state.biomeTiles.map(t=>t.id===patch.id?{...t,position:{x:sparse.position.x,y:sparse.position.y-48}}:t)};
  expect(shotFor(moved).shot).toMatchObject({x:sparse.position.x,y:sparse.position.y-24,yaw:0});
});
