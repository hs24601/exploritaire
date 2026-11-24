import type { Card, ProtoState } from './protoState';

import { EVENT_CARDS_ENABLED } from './tableauFeatures';
export { EVENT_CARDS_ENABLED } from './tableauFeatures';

export type EventUtility = 'Fetch' | 'Dig';
/** Alternatives are OR'd. A characteristic solution is party-wide; it does
 * not silently unlock a buried card unless that solution explicitly allows it. */
export type EventSolution = { type: 'wildcard' } | { type: 'rank' } | { type: 'utility'; moves: EventUtility[] }
  | { type: 'characteristic'; anyOf: string[]; allowBuried?: boolean };
export type TableauEvent = {
  id: string; title: string; description: string; solutions: EventSolution[];
  effect: { type: 'search'; sourceKey: string; segment: number; stamina: number; cards: number; reward: 'wood' | 'mana' }
    | { type: 'resource'; resource: 'wood' | 'mana'; amount: number }
    | { type: 'notice'; message: string };
};
export type EventAccess = { rank: number; depth: number; ap: number; partyCharacteristics: readonly string[]; utility?: EventUtility };
const tag = (value: string) => value.replace(/^#/, '').toLowerCase();
export function eventPlayCost(card: Card, access: EventAccess): number | null {
  if (!card.event || access.depth < 1) return null;
  const utilityCost=access.utility === 'Fetch' ? access.depth === 1 ? 2 : null : access.utility === 'Dig' ? access.depth : null;
  if (access.utility && (utilityCost === null || access.ap < utilityCost)) return null;
  const adjacent=card.rank === access.rank % 13 + 1 || access.rank === card.rank % 13 + 1;
  const traits=new Set(access.partyCharacteristics.map(tag));
  const legal=card.event.solutions.some(solution=>{
    if(solution.type==='utility')return Boolean(access.utility && solution.moves.includes(access.utility));
    if(solution.type==='characteristic')return (access.depth===1 || solution.allowBuried===true) && solution.anyOf.some(value=>traits.has(tag(value)));
    if(access.depth!==1)return false;
    return solution.type==='wildcard' || adjacent;
  });
  return legal ? access.utility ? utilityCost : 0 : null;
}
export const eventRequirements = (event: TableauEvent) => event.solutions.map(solution=>solution.type==='wildcard' ? 'Any foundation · exposed card'
  : solution.type==='rank' ? 'Adjacent rank · exposed card'
    : solution.type==='utility' ? solution.moves.join(' or ')
      : `Party: ${solution.anyOf.map(value=>'#'+value.replace(/^#/, '')).join(' or ')}${solution.allowBuried ? ' · any visible row' : ' · exposed card'}`).join(' OR ');

export const eventChangesRank = (event: TableauEvent) => event.solutions.every(solution=>solution.type==='rank'||solution.type==='utility');
export function applySimpleEvent(state: ProtoState, card: Card): ProtoState | null {
  const event=card.event;
  if(!event || state.resolvedEventIds?.includes(card.id) || state.eventDiscard?.some(entry=>entry.id===card.id) || event.effect.type==='search')return null;
  return {...state,resolvedEventIds:[...(state.resolvedEventIds??[]),card.id],
    haul:event.effect.type==='resource' ? {...state.haul,[event.effect.resource]:state.haul[event.effect.resource]+Math.max(0,event.effect.amount)} : state.haul};
}

/** Spawning events never replaces earned cards or rewards. Row 0 is deepest;
 * the last row is exposed, matching all Proto tableau generators. */
export function spawnTableauEvent<T extends Card>(columns: readonly T[][], card: T, column = 0, row?: number): T[][] {
  if (!EVENT_CARDS_ENABLED) return columns.map(cards => [...cards]);
  const index=Math.max(0,Math.min(columns.length-1,column));
  return columns.map((cards,i)=>{
    if(i!==index)return [...cards];
    const next=[...cards];next.splice(Math.max(0,Math.min(next.length,row??next.length)),0,card);return next;
  });
}

/** Authoring example; not spawned into an unrelated tile automatically. */
export const MOON_FRUIT_EVENT: TableauEvent = { id:'moon-fruit',title:'MOON FRUIT',
  description:'Fruit hangs high in the canopy. A capable party member must reach it.',
  solutions:[{type:'characteristic',anyOf:['treeClimber','lumberjack','flight']}],
  effect:{type:'resource',resource:'mana',amount:1} };
