// Battle events as presentation cues: who lunges at whom, who flinches, who
// falls. Pure, so the 3D arena and the battle cards read the same story.
// Cues never feed back into the rules; a dropped or skipped cue changes nothing.

import type { ActorMarkerContent } from '../actorMarkers';
import type { KhadWeedOptions } from '../khadSpriteFaces';
import { ABILITIES, SPIRITS, type SpiritDef } from './battleAbilities';
import { previewAttack, type BattleEvent, type BattleState } from './battle';

/** Seconds from an attack's start to its impact, where flinches and defeats begin. */
export const IMPACT_SECONDS = 0.24;
/** How long each cue plays, in seconds (a held down pose ends its fall here). */
export const CUE_SECONDS = { attack: 0.62, slam: 0.62, hurt: 0.42, defeat: 1.25, down: 0.6 } as const;

export type CueMotion = 'bite' | 'scratch' | 'slam';

export type BattleCue =
  /** An attacker lunges (or a slime hops) at a target; trap cues snap shut in place. */
  | { id: number; kind: 'attack'; delay: number; actorId: string; targetId: string; motion: CueMotion; tier: number; element: SpiritDef['element'] | null; heavy: boolean; trap: boolean }
  /** The target flinches. `light` for damage over time. */
  | { id: number; kind: 'hurt'; delay: number; targetId: string; fromId: string | null; amount: number; heavy: boolean; light: boolean }
  /** A slime is beaten: flash, then evaporate. */
  | { id: number; kind: 'defeat'; delay: number; targetId: string }
  /** A party actor falls; the down pose holds while its HP is 0. */
  | { id: number; kind: 'down'; delay: number; targetId: string };

/** Hits at or above this much damage read as heavy: bigger jaws, harder knockback. */
export const HEAVY_HIT = 7;

/** An attack's form and element, recovered from its name ("Inferno Takedown"). */
const attackLook = (actorId: string, label = '') => {
  const tiers = ABILITIES[actorId]?.tiers ?? [];
  const tier = Math.max(0, tiers.findIndex((t) => label === t.name || label.endsWith(` ${t.name}`)));
  const element = Object.values(SPIRITS).find((spirit) => spirit.element && spirit.prefix && label.startsWith(`${spirit.prefix} `))?.element ?? null;
  return { tier, element, motion: (actorId === 'banks' && label === 'Bite' ? 'bite' : ABILITIES[actorId]?.motion ?? 'bite') as CueMotion };
};

/**
 * Cues for a batch of fresh events, in order. A defeat or a fall that the same
 * batch's hit caused waits for that hit's impact.
 */
export const cuesFor = (events: readonly BattleEvent[]): BattleCue[] => {
  const struck = new Set<string>();
  return events.flatMap((event): BattleCue[] => {
    const { id, targetId } = event;
    const amount = event.amount ?? 0, heavy = amount >= HEAVY_HIT;
    switch (event.kind) {
      case 'hit': case 'trap': {
        const actorId = event.sourceId ?? 'hero';
        struck.add(targetId);
        // Momentum cards own launch, impact and contact presentation; don't
        // replay the default bite/claw animation after their flight finishes.
        if(event.kind==='hit' && (event.label==='Bash' || event.label==='Pounce'))return [];
        return [
          { id, kind: 'attack', delay: 0, actorId, targetId, ...attackLook(actorId, event.label), heavy, trap: event.kind === 'trap' },
          { id, kind: 'hurt', delay: event.kind === 'trap' ? 0.12 : IMPACT_SECONDS, targetId, fromId: actorId, amount, heavy, light: false },
        ];
      }
      case 'enemy-hit': {
        const actorId = event.sourceId ?? '';
        struck.add(targetId);
        if(event.label==='Thorns')return [
          {id,kind:'hurt',delay:IMPACT_SECONDS,targetId,fromId:actorId || null,amount,heavy:false,light:true},
        ];
        return [
          { id, kind: 'attack', delay: 0, actorId, targetId, motion: 'slam', tier: 0, element: null, heavy, trap: false },
          { id, kind: 'hurt', delay: IMPACT_SECONDS, targetId, fromId: actorId || null, amount, heavy, light: false },
        ];
      }
      case 'dot': return [{ id, kind: 'hurt', delay: 0, targetId, fromId: null, amount, heavy: false, light: true }];
      case 'ko': return [{ id, kind: 'defeat', delay: struck.has(targetId) ? IMPACT_SECONDS : 0, targetId }];
      case 'down': return [{ id, kind: 'down', delay: struck.has(targetId) ? IMPACT_SECONDS : 0, targetId }];
      default: return [];
    }
  });
};

/** Events newer than `seen`, oldest first. A restarted battle numbers its events from the start again, so all of them are fresh. */
export const freshEvents = (events: readonly BattleEvent[], seen: number) => {
  const last = events[events.length - 1]?.id ?? 0;
  return events.filter((event) => last < seen || event.id > seen);
};

export const cueSeconds = (cue: BattleCue) => cue.delay + CUE_SECONDS[cue.kind === 'attack' && cue.motion === 'slam' ? 'slam' : cue.kind];

/** What the arena shows: every unit still on the field (fallen ones included) and the recent events to cue. */
export type BattleScene = {
  khadRoot?: boolean;
  sandboxSession?: string;
  weedOptions?: KhadWeedOptions;
  proceduralSlimeComparison?: boolean;
  /** Hero standing at the low camera tier uses the orbit v1 slice (docs/art/hero-orbit-v1.md). */
  heroOrbit?: boolean;
  paused?: boolean;
  ambushed?: boolean;
  units: { id: string; team: 'party' | 'enemy'; down: boolean; position?: readonly [number,number]; pose?: 'standing' | 'sitting' | 'flinch'; targeting?: 'valid' | 'focused'; markers?: ActorMarkerContent }[];
  events: readonly BattleEvent[];
};

export const sceneOf = (battle: BattleState, aim?: { actorId: string; foeId: string | null } | null): BattleScene => ({
  ambushed: Boolean(battle.ambush),
  units: [
    ...battle.party.map((actor) => {
      const preview = aim && !battle.result ? previewAttack(battle, aim.actorId, actor.id) : null;
      const focused = Boolean(preview && aim?.foeId === actor.id);
      return { id: actor.id, team: 'party' as const, down: actor.hp <= 0,
        targeting: preview ? focused ? 'focused' as const : 'valid' as const : undefined,
        markers: { health: { current: actor.hp, max: actor.maxHp, preview: focused ? preview!.hp.after : undefined } } };
    }),
    ...battle.foes.map((foe) => {
      const preview = aim && !battle.result ? previewAttack(battle, aim.actorId, foe.id) : null;
      const focused = Boolean(preview && aim?.foeId === foe.id);
      return { id: foe.id, team: 'enemy' as const, down: foe.hp <= 0,
        targeting: preview ? focused ? 'focused' as const : 'valid' as const : undefined,
        markers: { health: { current: foe.hp, max: foe.profile.maxHp, preview: focused ? preview!.hp.after : undefined } } };
    }),
  ],
  events: battle.events,
});
