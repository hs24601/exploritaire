import {gritFromEvents} from './grit';
import {hasSnowflake} from './snowflakeReward';
import { moteOnHit } from './lightMotes';
import { canUseCir, useCir, cirSkillCost, cirInvokeCost } from './cirCompanion';
import { canUseKeruAbilities } from './keruLeadership';
import { indominableAfterDamage } from './indominable';
import { newActor, AP_CAP, actorAP, defaultStrike, drawCard, tableauWidth, foeAlive, actorAlive, setActorTarget, spendAP, type BattleActor, type BattleEvent, type BattleFoe, type BattleState } from './battle';
import { foundationSummon, FOUNDATION_SUMMON_SLOT, STATUS_META, STATUS_SKILLS, STATUS_TUNING as T, type StatusId, type StatusSkillId, type UnitStatus } from './battleStatusData';
import { tutorialById } from './battleTutorialScenarios';

// Tutorial statuses as tableau mechanics. Pure: no React or DOM.
// Reactions: Chill on Soaked = Frozen; fire on Soaked = Steam (Blinded); fire on
// Bleeding = Cauterize (burst, no burn); shock on Soaked conducts to every other
// Soaked foe; Takedown on Frozen = Shatter (double damage, full stagger gauge).

type Unit = BattleActor | BattleFoe;
export const statusOf = (unit: Unit | undefined, id: StatusId) => unit?.statuses?.find(status => status.id === id);
export const hasStatus = (unit: Unit | undefined, id: StatusId) => Boolean(statusOf(unit, id));
export const withStatus = <U extends Unit>(unit: U, status: UnitStatus): U => ({ ...unit, statuses: [...(unit.statuses ?? []).filter(s => s.id !== status.id), status] });
export const withoutStatus = <U extends Unit>(unit: U, ...ids: StatusId[]): U => unit.statuses?.some(s => ids.includes(s.id))
  ? { ...unit, statuses: unit.statuses.filter(s => !ids.includes(s.id)) } : unit;

const patchFoe = (state: BattleState, id: string, patch: (foe: BattleFoe) => BattleFoe): BattleState =>
  ({ ...state, foes: state.foes.map(foe => foe.id === id ? patch(foe) : foe) });
export const patchActor = (state: BattleState, id: string, patch: (actor: BattleActor) => BattleActor): BattleState =>
  ({ ...state, party: state.party.map(actor => actor.id === id ? patch(actor) : actor) });

export const pushEvents = (state: BattleState, events: Omit<BattleEvent, 'id'>[]): BattleState => {
  if (!events.length) return state;
  let next = state;
  const party = gritFromEvents(state, events, (foeId, kinId) => {
    if (hasSnowflake(state, kinId, 'Grit')) next = chillFoe(next, foeId, 1, true);
  });
  return {
    ...next, party, events: [...state.events, ...events.map((event, i) => ({ ...event, id: state.nextEventId + i }))].slice(-12),
    nextEventId: state.nextEventId + events.length,
  };
};

export const outcome = (state: BattleState): BattleState['result'] =>
  state.party.some(actor => actor.id === 'aldan-seed' && actor.hp <= 0) ? 'lost' : state.foes.length && state.foes.every(foe => foe.hp <= 0) ? 'won' : state.party.length && state.party.every(actor => actor.hp <= 0) ? 'lost' : null;

/** Banks' Hex: a Weakened foe's hits deal half damage, rounded up. */
export const weakenedHit = (foe: BattleFoe | undefined, damage: number) => foe && hasStatus(foe, 'weakened') ? Math.ceil(damage / 2) : damage;

/** Direct HP loss from statuses and reactions: no stagger, receipts or Momentum. */
export const damageFoe = (state: BattleState, foeId: string, amount: number, label: string, kind: 'hit' | 'dot' = 'hit', sourceId?: string): BattleState => {
  const foe = state.foes.find(unit => unit.id === foeId);
  if (!foe || !foeAlive(foe) || amount <= 0) return state;
  const hp = Math.max(0, foe.hp - amount);
  const next = patchFoe(state, foeId, unit => hp > 0 ? { ...unit, ...indominableAfterDamage(unit,hp), hp } : { ...unit, ...indominableAfterDamage(unit,hp), hp, stagger: 0, staggered: 0, staggerStage: 0, statuses: [] });
  const events: Omit<BattleEvent, 'id'>[] = [{ kind, targetId: foeId, sourceId, amount, label }];
  if (hp === 0) events.push({ kind: 'ko', targetId: foeId, sourceId });
  const withHits = pushEvents(next, events);
  const resolved = { ...withHits, result: outcome(withHits) };
  return kind === 'hit' ? moteOnHit(resolved, sourceId, foeId, amount) : resolved;
};

/** Chill stacks cut enemy Momentum gain; enough stacks, or any Chill while Soaked, Freeze it. */
export const chillFoe = (state: BattleState, foeId: string, stacks = 1, appliedDuringEnemyTurn = false): BattleState => patchFoe(state, foeId, foe => {
  if (!foeAlive(foe) || hasStatus(foe, 'frozen')) return foe;
  if (hasStatus(foe, 'soaked')) return withStatus(withoutStatus(foe, 'soaked', 'chill'), { id: 'frozen' });
  const total = (statusOf(foe, 'chill')?.stacks ?? 0) + stacks;
  return total >= T.chillToFreeze ? withStatus(withoutStatus(foe, 'chill'), { id: 'frozen' }) : withStatus(foe, { id: 'chill', stacks: total, ...(appliedDuringEnemyTurn || statusOf(foe, 'chill')?.turns ? { turns: 1 } : {}) });
});

export const bleedFoe = (state: BattleState, foeId: string, stacks: number): BattleState => patchFoe(state, foeId, foe =>
  foeAlive(foe) ? withStatus(foe, { id: 'bleed', stacks: (statusOf(foe, 'bleed')?.stacks ?? 0) + stacks }) : foe);

/** Fire reacts with Soak (Steam) and Bleed (Cauterize) before it can set Burn. */
export const fireOn = (state: BattleState, foeId: string, setBurn: boolean): BattleState => {
  const foe = state.foes.find(unit => unit.id === foeId);
  if (!foe || !foeAlive(foe)) return state;
  if (hasStatus(foe, 'soaked')) return patchFoe(state, foeId, unit => withStatus(withoutStatus(unit, 'soaked'), { id: 'blind' }));
  const bleed = statusOf(foe, 'bleed')?.stacks ?? 0;
  if (bleed > 0) return damageFoe(patchFoe(state, foeId, unit => withoutStatus(unit, 'bleed', 'exposed')), foeId, bleed, 'Cauterize', 'hit');
  return setBurn ? patchFoe(state, foeId, unit => withStatus(unit, { id: 'burn', stacks: T.burnDamage, turns: T.burnTurns })) : state;
};

/** Soaking reacts with Chill (Frozen) and Burn (Steam) already on the foe. */
const soakFoe = (state: BattleState, foeId: string): BattleState => patchFoe(state, foeId, foe => {
  if (!foeAlive(foe)) return foe;
  if (hasStatus(foe, 'chill')) return withStatus(withoutStatus(foe, 'chill'), { id: 'frozen' });
  if (hasStatus(foe, 'burn')) return withStatus(withoutStatus(foe, 'burn'), { id: 'blind' });
  return withStatus(foe, { id: 'soaked', turns: 2 });
});

export const releaseHeroGrip = (state: BattleState): BattleState => state.foes.some(foe => hasStatus(foe, 'grip'))
  ? { ...state, foes: state.foes.map(foe => withoutStatus(foe, 'grip')) } : state;

export const isSilenced = (state: BattleState, actorId: string) => hasStatus(state.party.find(actor => actor.id === actorId), 'silence');
/** A raging Kin uses no abilities (including another Ember Rage) until the turn ends. */
export const isRaging = (state: BattleState, actorId: string) => hasStatus(state.party.find(actor => actor.id === actorId), 'ember-rage');

/** Allowed in this tutorial scenario's hand. Cir's shared card is allowed when any Cir expression is. */
export const tutorialAllowsSkill = (state: BattleState, id: string) => {
  const def = tutorialById(state.tutorial?.id);
  return Boolean(def && (def.skills as readonly string[]).some(skill => skill === id || id === 'cir' && skill.startsWith('cir-')));
};

export const statusSkillTargets = (state: BattleState, id: StatusSkillId) =>
  (id === 'summon-cir' ? [...state.foes, ...state.party.filter(a => a.id !== 'cir' && a.controller !== 'npc'), ...state.party.filter(a => a.id !== 'cir' && a.controller !== 'npc').map(a => ({ ...a, id: `familiar:${a.id}`, name: `${a.name} · Familiar` }))] : id === 'cir-emerge' ? state.party.filter(a => a.id === state.cirCompanion?.host) : STATUS_SKILLS[id].target === 'card' ? [] : STATUS_SKILLS[id].target === 'foe' ? state.foes : STATUS_SKILLS[id].target === 'self' ? state.party.filter(actor => actor.id === STATUS_SKILLS[id].actorId)
    : state.party.filter(actor => actor.controller !== 'npc')).filter(unit => unit.hp > 0);

/** Every tableau card sharing the picked card's rank (Focus Fire). */
export const focusFireCards = (state: BattleState, target: string) => {
  const cardId = target.startsWith('card:') ? target.slice(5) : target;
  const rank = state.columns.flat().find(card => card.id === cardId)?.rank;
  return rank === undefined ? [] : state.columns.flat().filter(card => card.rank === rank);
};

/** Burn the picked rank: columns close up and refill to their usual depth; each card is 1 fire to every foe. */
function burnRank(state: BattleState, target: string, caster: string): BattleState {
  const burned = new Set(focusFireCards(state, target).map(card => card.id));
  if (!burned.size) return state;
  let { stock, dealt } = state;
  const addedIds: string[] = [];
  const columns = state.columns.map((cards, column) => {
    const kept = cards.filter(card => !burned.has(card.id));
    if (column >= tableauWidth(state) || !state.rules.infinifillRows) return kept;
    const refill = [];
    while (refill.length + kept.length < state.rules.infinifillRows) { const next = drawCard({ ...state, stock, dealt }); refill.push(next.card); addedIds.push(next.card.id); stock = next.stock; dealt = next.dealt; }
    return [...refill, ...kept];
  });
  let next: BattleState = { ...state, columns, stock, dealt,
    spills: Object.fromEntries(Object.entries(state.spills ?? {}).filter(([cardId]) => !burned.has(cardId))),
    reposition: { serial: (state.reposition?.serial ?? 0) + 1, by: 'party', removedIds: [...burned], addedIds } };
  for (const foe of next.foes) if (foeAlive(foe)) next = damageFoe(next, foe.id, barkDamage(foe, 0, burned.size), 'Focus Fire · Fire', 'hit', caster);
  return next;
}

export const canUseStatusSkill = (state: BattleState, id: StatusSkillId, targetId?: string): boolean => {
  if (!canUseKeruAbilities(state, STATUS_SKILLS[id].actorId)) return false;
  // These collected Keru remain inspectable placeholders until their target effects are authored.
  if (state.sandboxScenario === '1002' && (id === 'hold' || id === 'summon-riv')) return false;
  const skill = STATUS_SKILLS[id];
  if (id === 'summon-cir' || id === 'cir-emerge' || skill.actorId === 'cir') return canUseCir(state, id, targetId) && !abilitySlotSpent(state);
  if (!state.tutorial || !tutorialAllowsSkill(state, id) || state.turn !== 'party' || state.result || abilitySlotSpent(state)) return false;
  const caster = state.party.find(actor => actor.id === skill.actorId);
  if (!caster || !actorAlive(caster) || caster.disarmed || caster.turnSpent || isSilenced(state, caster.id)) return false;
  if (actorAP(state, caster.id) < skill.cost) return false;
  // Ember Rage: once per turn, and while raging Hero has only her chip hits.
  if (isRaging(state, caster.id)) return false;
  // The temporary Hold card is now Summon: Dem; a summoned or downed Dem prevents recasting.
  const summon = foundationSummon(id);
  if (summon && state.party.some(actor => actor.id === summon)) return false;
  if (summon) return targetId === undefined || targetId === FOUNDATION_SUMMON_SLOT;
  if (skill.target === 'card') return targetId ? focusFireCards(state, targetId).length > 0 : state.columns.some(cards => cards.length > 0);
  const targets = statusSkillTargets(state, id);
  return targetId ? targets.some(unit => unit.id === targetId) : targets.length > 0;
};

/** AP this card would spend now: Vice Grip commits every whole AP its owner holds. */
export const statusSkillCost = (state: BattleState, id: StatusSkillId, target?: string | null) => {
  if (id === 'summon-cir') return cirInvokeCost(state, target);
  if (id === 'cir-emerge' || STATUS_SKILLS[id].actorId === 'cir') return cirSkillCost(state, id);
  const skill: { cost: number; spendsAll?: boolean; actorId: string } = STATUS_SKILLS[id];
  const held = actorAP(state, skill.actorId);
  return skill.spendsAll && Number.isFinite(held) ? Math.max(skill.cost, held) : skill.cost;
};

const strike = (state: BattleState, actorId: string, targetId: string, damage: number, stagger: number, name: string) =>
  defaultStrike(setActorTarget(state, actorId, targetId), actorId, { damage, stagger, name });

export const useStatusSkill = (state: BattleState, id: StatusSkillId, targetId?: string): BattleState => {
  if (!targetId || !canUseStatusSkill(state, id, targetId)) return state;
  if (id === 'summon-cir' || id === 'cir-emerge' || STATUS_SKILLS[id].actorId === 'cir') return useCir(state, id, targetId);
  const skill = STATUS_SKILLS[id], cost = statusSkillCost(state, id), caster: string = skill.actorId;
  let next = spendAP(state, skill.actorId, cost);
  // Any other Hero ability releases her hold.
  // The Vice Grip holder's other abilities release the hold.
  if (skill.actorId === STATUS_SKILLS['vice-grip'].actorId && id !== 'vice-grip') next = releaseHeroGrip(next);
  const foe = next.foes.find(unit => unit.id === targetId);
  switch (id) {
    case 'bite':
      next = strike(next, caster, targetId, skill.damage, 0, skill.name);
      next = patchFoe(bleedFoe(next, targetId, T.biteBleed), targetId, unit => foeAlive(unit) ? withStatus(unit, { id: 'exposed', turns: 2 }) : unit);
      break;
    case 'takedown': {
      if (foe && hasStatus(foe, 'frozen')) {
        // Shatter: double damage and a full gauge, which breaks the guard at once.
        next = patchFoe(next, targetId, unit => withoutStatus(unit, 'frozen'));
        next = strike(next, caster, targetId, skill.damage * 2, Math.max(0, foe.profile.staggerMax - foe.stagger), 'Takedown · Shatter');
      } else {
        next = strike(next, caster, targetId, skill.damage, 0, skill.name);
        next = patchFoe(next, targetId, unit => foeAlive(unit) ? withStatus(unit, { id: 'stun' }) : unit);
      }
      break;
    }
    case 'vice-grip':
      next = patchFoe(releaseHeroGrip(next), targetId, unit => withStatus(unit, { id: 'grip', turns: Math.floor(cost / T.gripPerTurn) }));
      break;
    case 'frost-fang':
      next = chillFoe(strike(next, caster, targetId, skill.damage, 0, skill.name), targetId);
      next = patchActor(next, caster, actor => withStatus(actor, { id: 'rime' }));
      break;
    case 'thunder-bark': {
      const conducts = Boolean(foe && hasStatus(foe, 'soaked'));
      next = strike(next, caster, targetId, skill.damage, 0, skill.name);
      if (conducts) for (const other of next.foes) if (other.id !== targetId && foeAlive(other) && hasStatus(other, 'soaked'))
        next = damageFoe(next, other.id, T.shockDamage, 'Thunder Bark · Conduct', 'hit', caster);
      break;
    }
    case 'lacerate': next = bleedFoe(strike(next, caster, targetId, skill.damage, 0, skill.name), targetId, T.lacerateBleed); break;
    case 'puddle-pounce': next = soakFoe(next, targetId); break;
    case 'ember-swipe': next = fireOn(strike(next, caster, targetId, skill.damage, 0, 'Ember Swipe · Fire'), targetId, true); break;
    case 'focus-fire': next = burnRank(next, targetId, caster); break;
    case 'ember-rage': next = patchActor(next, caster, actor => withStatus(actor, { id: 'ember-rage' })); break;
    case 'haste': next = patchActor(next, targetId, actor => withStatus(actor, { id: 'haste', stacks: T.hasteCards })); break;
    case 'mire': next = patchFoe(next, targetId, unit => withStatus(unit, { id: 'slow', turns: 2 })); break;
    case 'wild': next = patchActor(next, targetId, actor => withStatus(actor, { id: 'wild' })); break;
    case 'regen': next = patchActor(next, targetId, actor => withStatus(actor, { id: 'regen', turns: 2 })); break;
    case 'guard': next = patchActor(next, targetId, actor => withStatus(actor, { id: 'guard' })); break;
    case 'foresight': next = patchActor(next, targetId, actor => withStatus(actor, { id: 'foresight', turns: 2 })); break;
    case 'hold': case 'summon-riv': {
      const summoned = foundationSummon(id)!;
      const saved = state.sandboxScenario === '1002' ? state.keruSelection?.reserves[summoned] : undefined;
      const summonedActor = saved ?? { ...newActor(summoned), ...(summoned === 'riv' ? { foundationCards: [], statuses: [{ id: 'wild' as const }] } : {}), targetId: next.foes.find(foeAlive)?.id };
      next = { ...next, party: [...next.party, summonedActor] };
      break;
    }
  }
  return { ...next, started: true, result: outcome(next) };
};

/** Statuses that last "this turn" end, and party-turn countdowns advance. */
export const expirePartyTurn = (state: BattleState): BattleState => ({ ...state,
  foes: state.foes.map(foe => withoutStatus(foe, 'firelit')),
  tutorial: state.tutorial && { ...state.tutorial, lastReceiver: undefined, abilitiesThisTurn: 0 },
  party: state.party.map(actor => {
    // Ember Rage fades at the end of the turn and AP above the normal cap burns off.
    const faded = hasStatus(actor, 'ember-rage') ? { ...withoutStatus(actor, 'ember-rage'), charge: Math.min(actor.charge, AP_CAP[actor.id]) } : actor;
    return countDown(countDown(withoutStatus(faded, 'haste', 'rime'), 'party-turn'), 'enemy-turn');
  }) });

/** After the foes act: enemy-turn countdowns advance and Chill thaws by one stack. */
export const expireEnemyTurn = (state: BattleState): BattleState => ({ ...state, foes: state.foes.map(foe => {
  const next = countDown(foe, 'enemy-turn'), chill = statusOf(next, 'chill');
  if (!chill) return next;
  // Retaliatory Chill arrives after the attacker has banked Momentum.
  if (chill.turns) return withStatus(next, { id: 'chill', stacks: chill.stacks });
  return (chill.stacks ?? 0) > 1 ? withStatus(next, { ...chill, stacks: (chill.stacks ?? 0) - 1 }) : withoutStatus(next, 'chill');
}) });

function countDown<U extends Unit>(unit: U, phase: 'party-turn' | 'enemy-turn'): U {
  if (!unit.statuses?.some(status => STATUS_META[status.id].expires === phase)) return unit;
  return { ...unit, statuses: unit.statuses.flatMap(status => STATUS_META[status.id].expires !== phase ? [status]
    : (status.turns ?? 0) > 1 ? [{ ...status, turns: (status.turns ?? 0) - 1 }] : []) };
}

/** Heavy Bark halves physical hits of 3 or more; Dry Bark doubles fire. Both apply after vulnerability. */
export const barkDamage = (foe: BattleFoe, physical: number, fire: number) =>
  (hasStatus(foe, 'heavy-bark') && physical >= 3 ? Math.floor(physical / 2) : physical) + (hasStatus(foe, 'dry-bark') ? fire * 2 : fire);

/** Stifling Sap: while any living foe carries it, the party may play one ability per turn (Withdraw is exempt). */
export const abilitySlotSpent = (state: BattleState) => Boolean(state.tutorial && (state.tutorial.abilitiesThisTurn ?? 0) >= 1
  && state.foes.some(foe => foeAlive(foe) && hasStatus(foe, 'stifling-sap')));

/** Haste doubles and Slow halves (rounded down) Momentum gained, on either side; Chill takes 1 per stack from foes. */
export const scaleMomentumGain = (unit: Unit | undefined, gain: number, round = true) => {
  let scaled = hasStatus(unit, 'haste') ? gain * 2 : gain;
  if (hasStatus(unit, 'slow')) scaled = round ? Math.floor(scaled / 2) : scaled / 2;
  return scaled;
};
/** Momentum a foe banks on its enemy turn. Frozen, Stunned and Held foes bank nothing. */
export const foeMomentumGain = (foe: BattleFoe) => {
  if (hasStatus(foe, 'frozen') || hasStatus(foe, 'stun') || hasStatus(foe, 'grip') || foe.staggered > 0) return 0;
  return scaleMomentumGain(foe, Math.max(0, T.enemyMomentumGain - (statusOf(foe, 'chill')?.stacks ?? 0)));
};

