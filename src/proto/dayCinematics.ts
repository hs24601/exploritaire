import { khadCalloutHeld } from './tutorialQuests';
import { CLAUSTROPHOBIC_DARKNESS, type PeripheralDarkness } from './peripheralDarkness';
import type { CalloutMark } from './calloutEffects';
import type { ProtoState } from './protoState';
import { dayOneReturning, dayTwoPatchForaged, sparsePatchTableauComplete } from './dayScenarios';
import { isHome } from './rules/ordinaryDay';
import type { CalloutCamera, CameraChoreography, CameraStep, CameraShot } from './cameraChoreography';
export type StoryMood = 'stone' | 'berry' | 'dusk' | 'night' | 'woods' | 'morning';
export type DayCinematicBeat = { id: string; day: 'day01' | 'day02' | 'day03'; title: string; composition: string; light: string; mood: StoryMood; peripheralDarkness?: PeripheralDarkness; calloutId?: string; bubbleCameras?: Record<number, CalloutCamera>; choreography: CameraChoreography };
type Point = { x: number; y: number };
const step = (id: string, name: string, at: Point, scale: number, yaw: number, pitch: number, durationMs = 1800, holdMs = 1600, framing = .16): CameraStep => ({ id, name, shot: { ...at, scale, yaw, pitch, tilted: true, framing }, durationMs, holdMs, easing: durationMs ? 'smooth' : 'cut' });
/** Review scaffolding: actual authored landmark positions, never miniature scenario coordinates. */
export function buildDayCinematicBeats(state: ProtoState): DayCinematicBeat[] {
  const home = state.biomeTiles.find(t => t.id === 'hero-den')?.position;
  if (!home) return [];
  const position = (id?: string) => state.biomeTiles.find(t => t.id === id)?.position;
  const sparse = position(state.dayScenarioTiles?.sparsePatchId) ?? home;
  const patch = position(state.dayScenarioTiles?.patchId) ?? sparse;
  const woods = position(state.dayScenarioTiles?.woodsId) ?? patch;
  const beat = (day: DayCinematicBeat['day'], key: string, title: string, mood: StoryMood, composition: string, light: string, shots: CameraStep[], calloutId?: string, tileLabelIds?: string[]): DayCinematicBeat => {
    const id = `${day}.${key}`;
    return { id, day, title, mood, composition, light, peripheralDarkness: mood === 'morning' ? undefined : CLAUSTROPHOBIC_DARKNESS, calloutId, choreography: { id: `story.${id}`, name: `${day.replace('day', 'Day ')} · ${title}`, steps: shots, trigger: { event: 'manual', value: '' }, restore: false, enabled: true, ...(tileLabelIds ? { tileLabelIds } : {}) } };
  };
  const denPair = (id: string, close = 7.8) => [step(id + '.wide', 'Stone shelter / mountain background', home, 3.6, 158, 60, 0, 1000), step(id + '.hero', 'Through the north entrance, close to Hero', home, close, 180, 65, 2100, 1800, .24)];
  const patchPair = (id: string, at: Point, close = 7) => [step(id + '.place', 'Hero small against the brush', at, 4, 150, 61, 1100, 800), step(id + '.thought', 'Close three-quarter, room above for her thought', at, close, 170, 67, 1900, 1600, .23)];
  return [
    { ...beat('day01','opening','A small home','stone','Hold Hero in the open den mouth with the nearby glowing bush and mountain shelter in view.','Muted morning ambient holds the stone; no added lamp.',[step('d1.home.hero','Hero in the den / nearby bush',home,9.165,194,17.6,0,1800,.24)], 'day01.opening', ['hero-den', state.dayScenarioTiles?.sparsePatchId].filter((id): id is string => Boolean(id))), bubbleCameras: { 1: { kind: 'shot', step: step('d1.home.bush', 'Swing toward the nearby bush', home, 9.935, 186.4, 82, 1800, 1800, .24) } } },
    { ...beat('day01','sparse-patch','Not enough nearby','berry','A lonely bush in a wider frame, then a gentle push toward Hero as she remembers easier days.','Overcast afternoon; the first carried berry is the only new glow.',patchPair('d1.sparse',sparse), 'day01.sparse-patch'), bubbleCameras: { 1: {kind:'shot',step:step('d1.sparse.quest','Denser patch / quest introduction',{x:(sparse.x+patch.x)/2,y:(sparse.y+patch.y)/2},10.9,Math.atan2(sparse.x-patch.x,sparse.y-patch.y)*180/Math.PI,54.8,1800,0,0)} } },
    beat('day01','patch','Farther from home','berry','A shoulder-height environmental view keeps the berry brush behind Hero while the deal remains accessible.','Afternoon greens and pink pigment; no extra scene light.',[step('d1.patch','Hero and berry brush / playable wide',patch,4.6,150,61,1600,1800,.18)]),
    beat('day01','budget','Three small lights','dusk','Move inward for the supper-versus-tomorrow decision, then leave space in the direction of home.','The existing late-afternoon clock warms the earth; carried mana stays finite.',patchPair('d1.budget',patch,6.4), 'day01.budget'),
    beat('day01','home','Before the dark','dusk','Return to the same shelter composition, closer now so home feels earned.','Existing 17:30 sunset; preserve the authored stone and local light settings.',denPair('d1.return',6.8), 'day01.home'),
    beat('day01','saved-light','One for tomorrow','night','An intimate, still north-facing portrait inside the shelter. Let the sentence breathe.','Existing 19:00 blue dusk around warm stone and the remaining berry.',[step('d1.supper','Hero in the hollow / reserved light',home,7.2,180,67,1900,2400,.25)], 'day01.saved-light'),
    beat('day01','rest','Safe in the hollow','night','A slow, shallow push toward sleeping Hero, staying on the open side of the den.','Existing 21:00 night; no time passes while reading or resting.',[step('d1.rest','Sheltered sleep',home,7.4,175,68,2400,2200,.25)]),
    beat('day01','complete','Until morning','night','Hold the shelter and its small light; leave the next day as an explicit action.','Keep the existing nighttime milestone.',[step('d1.complete','Quiet night hold',home,6.8,180,67,1600,2200,.24)]),
    beat('day02','opening','Yesterday’s light','stone','Repeat yesterday’s den angle with a closer opening; the tiny reserve now matters.','Cool morning outside; the same carried mana supplies the light.',denPair('d2.home',7.8), 'day02.opening'),
    beat('day02','patch','Almost picked clean','berry','Stay close to Hero but retain the dwindling patch behind her.','The authored morning light, without replenishing the nearby sparse bush.',[step('d2.patch','Hero searching the last branches',patch,4.8,160,64,1700,1800,.2)]),
    beat('day02','scarcity','Beyond the familiar','woods','A close reaction, then a wider view facing toward the route; distant woods stay concealed.','Existing 15:30 cooling afternoon; the reserve’s glow remains small.',[step('d2.need','Hero weighs the reserve',patch,6.7,170,67,1600,1700,.24),step('d2.outward','Room to leave the familiar brush',patch,4.7,145,62,2100,1800,.18)], 'day02.scarcity'),
    beat('day02','woods','Under the canopy','woods','Hero small beneath the towering trees, then a measured approach that leaves the mana deal usable.','Keep the actual woodland lights and cool shadow; never lift concealed terrain.',[step('d2.woods.wide','Canopy overwhelms the small traveler',woods,3.6,145,63,1500,1100,.17),step('d2.woods.hero','Stay beside Hero / readable deal',woods,5.2,165,66,2000,1800,.23)]),
    beat('day03','opening','Someone stayed','morning','Return through the den’s north mouth, then open a gentle two-character frame including Banks beside Hero.','Existing 09:00 morning; soft warm/cool separation, no invented food or emitters.',[step('d3.home','The familiar hollow',home,5.5,180,65,0,1500,.24),step('d3.together','Hero and Banks / a little room for each other',{x:home.x+5,y:home.y},6.3,165,65,2600,2600,.25)], 'day03.opening'),
  ];
}
export function dayCinematicBeatId(state: ProtoState): string | null {
  if (!state.dayScenario || state.dayTwoAmbush) return null;
  // The next scene waits for pickup, jumbo inspection and the completed dock flight.
  if (khadCalloutHeld(state)) return null;
  if (state.journey) return sparsePatchTableauComplete(state) ? 'day01.sparse-patch' : null;
  if (state.dayScenario === 'day03') return 'day03.opening';
  if (state.dayScenario === 'day02') return dayTwoPatchForaged(state) ? state.selectedBiomeId === state.dayScenarioTiles?.woodsId ? 'day02.woods' : 'day02.scarcity' : state.selectedBiomeId === state.dayScenarioTiles?.patchId ? 'day02.patch' : 'day02.opening';
  if (state.ordinaryDay?.complete) return 'day01.complete';
  if (state.ordinaryDay?.bedtime) return 'day01.rest';
  if (state.ordinaryDay?.supper) return 'day01.saved-light';
  if (dayOneReturning(state)) return isHome(state) ? 'day01.home' : 'day01.budget';
  if (state.selectedBiomeId === state.dayScenarioTiles?.patchId) return 'day01.patch';
  const sparse = state.biomeTiles.find(t => t.id === state.dayScenarioTiles?.sparsePatchId);
  return sparse?.berryHarvested ? 'day01.sparse-patch' : 'day01.opening';
}
/** Camera travel releases a shot without ending its owning tutorial section. */
export function dayCinematicLabelBeatId(state: ProtoState): string | null {
  return dayCinematicBeatId(state.journey ? { ...state, journey: undefined } : state);
}
export const storyShotAt = (shot: CameraShot, offset: Point) => ({ ...shot, x: shot.x + offset.x, y: shot.y + offset.y });

/** Sparse accents for readable, quiet dialogue; local callout edits own their own formatting. */
export function storyThoughtMarks(text: string): CalloutMark[] {
  const marks: CalloutMark[] = [];
  for (const [pattern, effect] of [[/\b(light|glowing|glow|safe)\b/i, 'glow'], [/\b(colder|cold|darker|scarcer|Please)\b/i, 'whisper'], [/\b(Banks|supper|tomorrow)\b/i, 'emphasis']] as const) {
    const match = pattern.exec(text); if (match) marks.push({ start: match.index, end: match.index + match[0].length, effect });
  }
  return marks.sort((a,b) => a.start - b.start);
}

