import type { Card } from '../protoState';
import type { BattleActor, BattleState } from './battle';
import { statusOf, withStatus } from './battleStatuses';

export const SNOWFLAKE_EXPRESSIONS = {
  kin: 'Gain 1 Ice Armor when the enemy turn begins, up to 1 from the sticker.',
  Grit: 'Damage that triggers Grit also applies 1 Chill to the attacker.',
  Fetch: 'Give the fetched card, its orthogonal neighbors and its backfill Ice affinity.',
  Dig: 'Give the dug card, its orthogonal neighbors and its backfill Ice affinity.',
  'Vice Grip': 'Apply 1 Frostbite to the held enemy each enemy turn.',
  'Pack Leader': 'Free promotions apply 1 Chill to the new leader’s inherited target.',
  Bite: 'Deal +1 ice damage per AP spent on Bite.',
} as const;
export type SnowflakeExpression = keyof typeof SNOWFLAKE_EXPRESSIONS;
export type StickerMemory = { x: number; y: number; enhancement?: SnowflakeExpression };
export const DEFAULT_STICKER_MEMORY: StickerMemory = { x: .82, y: .82 };
export type SnowflakeReward = 'available' | { kinId: string; memory: StickerMemory };

const samples = 32;
// A downsampled alpha footprint of ice.png, including the die-cut holes.
const alpha = '00000000 0003c000 001a5800 007e7e00 00ffff00 02fdbf80 07fbffe0 04fffd20 0cffff60 0ffffff0 3dffffb8 1ffffff8 3ffffffc 1ffffff8 3bffffdc 6ffffff6 67ffffe6 3bffffdc 1fffffb8 3ffffffc 3ffffffc 1fffff78 1dffffb8 0ffffff0 04bff920 06ffff60 03fdbfc0 00ffff00 007e7e00 003bd400 00018000 00000000'.split(' ').map(hex => parseInt(hex,16));
const sums = Array.from({length: samples + 1}, () => new Float64Array(samples + 1));
for (let y = 1; y <= samples; y++) {
  for (let x = 1; x <= samples; x++) {
    sums[y][x] = sums[y-1][x] + sums[y][x-1] - sums[y-1][x-1] + ((alpha[y-1] >>> (samples-x)) & 1);
  }
}
export const STICKER_WIDTH = .28;
const printWidth = STICKER_WIDTH * .84; // Flurry's 8% print inset on both sides.
const printHeight = printWidth * 63 / 88;
const unit = (n: number) => Math.min(1, Math.max(0,n));

export function stickerFrontCoverage(x: number, y: number) {
  const area = (u: number, v: number) => {
    const sx = unit(u) * samples, sy = unit(v) * samples;
    const i = Math.min(samples-1, Math.floor(sx)), j = Math.min(samples-1, Math.floor(sy));
    const a = sx-i, b = sy-j;
    return (sums[j][i]*(1-a)+sums[j][i+1]*a)*(1-b) + (sums[j+1][i]*(1-a)+sums[j+1][i+1]*a)*b;
  };
  const left = .5-x/printWidth, right = .5+(1-x)/printWidth;
  const top = .5-y/printHeight, bottom = .5+(1-y)/printHeight;
  return (area(right,bottom)-area(left,bottom)-area(right,top)+area(left,top))/sums[samples][samples];
}

export function stickerMemory(x: number, y: number): StickerMemory {
  if (stickerFrontCoverage(x,y) < .1) {
    const anchorX = unit(x), anchorY = unit(y);
    let near = 0, far = 1;
    for (let i = 0; i < 18; i++) {
      const fraction = (near+far)/2;
      if (stickerFrontCoverage(anchorX+(x-anchorX)*fraction,anchorY+(y-anchorY)*fraction) >= .1) near = fraction;
      else far = fraction;
    }
    x = anchorX+(x-anchorX)*near;
    y = anchorY+(y-anchorY)*near;
  }
  return { x, y };
}

export function isSnowflakeExpression(value: unknown): value is SnowflakeExpression {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SNOWFLAKE_EXPRESSIONS, value);
}

export function canPlaceSnowflake(state: BattleState, actor: BattleActor) {
  return state.snowflakeReward === 'available' && !state.result && state.turn === 'party' &&
    !state.adeptFrenzy && actor.hp > 0 && actor.controller !== 'npc';
}

export function supportsSnowflake(actor: BattleActor, expression: string): expression is SnowflakeExpression {
  if (!isSnowflakeExpression(expression)) return false;
  if (expression === 'kin') return true;
  if (expression === 'Pack Leader') return Boolean(actor.packLeader);
  if (expression === 'Grit') return actor.id === 'hero' || Boolean(actor.grit);
  return actor.id === 'hero' && (expression === 'Fetch' || Boolean(actor.adept));
}

export function snowflakeEnhancements(actor:BattleActor):SnowflakeExpression[]{
  return (Object.keys(SNOWFLAKE_EXPRESSIONS) as SnowflakeExpression[]).filter(name=>supportsSnowflake(actor,name));
}
/** Center position owns exactly one band, including at an exact boundary.
 * Sticker width/overhang never combines neighboring enhancements. */
export function snowflakeEnhancementAt(actor:BattleActor,y:number):SnowflakeExpression{
  const choices=snowflakeEnhancements(actor);
  return choices[Math.min(choices.length-1,Math.floor(unit(y)*choices.length))];
}

export function placeSnowflake(state: BattleState, kinId: string, memory: StickerMemory): BattleState {
  const actor = state.party.find(unit => unit.id === kinId);
  return actor && canPlaceSnowflake(state, actor) && Number.isFinite(memory.x) && Number.isFinite(memory.y)
    ? { ...state, snowflakeReward: { kinId, memory: {...stickerMemory(memory.x, memory.y),enhancement:snowflakeEnhancementAt(actor,memory.y)} } }
    : state;
}

export function unstickSnowflake(state:BattleState):BattleState{
 return state.snowflakeReward&&state.snowflakeReward!=='available'?{...state,snowflakeReward:'available'}:state;
}

export function hasSnowflake(state: BattleState, kinId: string, expression: SnowflakeExpression) {
  const reward = state.snowflakeReward;
  if (!reward || reward === 'available' || reward.kinId !== kinId) return false;
  const actor = state.party.find(unit => unit.id === kinId);
  // Existing saved bundled attachments remain compatible; newly placed ones
  // always persist their single enhancement so later ability changes cannot remap it.
  return Boolean(actor && supportsSnowflake(actor, expression) && (!reward.memory.enhancement||reward.memory.enhancement===expression));
}

export const iceCard = (card: Card): Card => card.element === 'ice' ? card : { ...card, element: 'ice' };

/** Use the row measured from each column's exposed end, including uneven columns. */
export function frostRetrieval(columns: Card[][], column: number, index: number, width: number) {
  const row = columns[column].length - 1 - index;
  return columns.map((cards, x) => {
    if (x >= width || Math.abs(x - column) > 1) return cards;
    return cards.map((card, y) => Math.abs(x - column) + Math.abs(cards.length - 1 - y - row) === 1 ? iceCard(card) : card);
  });
}

export function openSnowflakeEnemyTurn(state: BattleState): BattleState {
  const reward = state.snowflakeReward;
  if (!reward || reward === 'available' || !state.party.some(actor => actor.id === reward.kinId && actor.hp > 0)) return state;
  const party = state.party.map(actor => actor.id === reward.kinId && hasSnowflake(state,actor.id,'kin') && (actor.iceArmor ?? 0) < 1 ? { ...actor, iceArmor: 1 } : actor);
  if (!hasSnowflake(state, reward.kinId, 'Vice Grip')) return { ...state, party };
  return { ...state, party, foes: state.foes.map(foe => {
    const held = state.tutorial ? statusOf(foe, 'grip') : foe.effects.some(effect => effect.kind === 'grip' && effect.left > 0);
    if (foe.hp <= 0 || foe.gripSource !== reward.kinId || !held) return foe;
    return withStatus(foe, { id: 'frostbite', stacks: (statusOf(foe, 'frostbite')?.stacks ?? 0) + 1 });
  }) };
}
