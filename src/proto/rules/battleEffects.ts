import type { AbilityEffect } from './battleAbilities';
import type { ActiveEffect } from './battle';
export const BLEED = {kind:'bleed',dps:1,seconds:4} as const;
export function bleedChance(current: readonly ActiveEffect[], incoming: readonly AbilityEffect[]) {
 const bleed=incoming.find(e=>e.kind==='bleed');
 return Math.min(1,(bleed ? bleed.chance ?? 1 : 0)+(current.some(e=>e.kind==='exposed' && e.left>0)? .1:0));
}
/** One seeded roll per direct hit that could bleed; previews do not mutate the source state. */
export function applyHitEffects(current: ActiveEffect[], incoming: readonly AbilityEffect[], seed: number) {
  const chance = bleedChance(current,incoming);
  const added = incoming.filter(e=>e.kind!=='bleed');
  if(chance>0) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    if(seed/4294967296<chance) added.push({...BLEED,chance:undefined});
  }
  return {seed,effects:[...current.filter(e=>!added.some(n=>n.kind===e.kind)),...added.map(e=>({...e,left:e.seconds,tickIn:1}))]};
}
