import { moteEndTurn } from './lightMotes';
import { thornsRetaliation } from './thornsReward';
import { triggerPhoenix } from './phoenixReward';
import { golemFarewell, golemUpkeep } from './iceAbilities';
import { iceTier, themedGuard } from './iceRewards';
import { openSnowflakeEnemyTurn } from './snowflakeReward';
import { isAdjacentRank } from './setup';
import { partyDamageTarget } from './partyDamage';
import { enterKeruEncounter } from './keruLeadership';
import { splitCard } from './splitCards';
import { absorbTempHp, evadeCir } from './cirCompanion';
import { newActor, apCap, takeTop, foundationCardsOf, createStaggerSandbox, cirFireHit, enemyTarget, foeAlive, recoverDisarmed, returnPlayerTurn, CIR_EXPRESSIONS, type BattleFoe, type BattleState } from './battle';
import { STATUS_TUNING as T } from './battleStatusData';
import { tutorialById, type StrikeProfile, type TutorialDef, type TutorialFoeDef, type TutorialScenarioId } from './battleTutorialScenarios';
import { bleedFoe as bleed, chillFoe as chill, damageFoe, weakenedHit, expireEnemyTurn, expirePartyTurn, hasStatus, outcome, patchActor, pushEvents, statusOf, foeMomentumGain, scaleMomentumGain, withStatus, withoutStatus } from './battleStatuses';
import { stockCard } from './skirmish';
import { isTruefourstar } from './battleSandboxScenarios';
import { INVOKE_KERU } from './keruInvokeData';
import { keruInvokeSetup, payKeruUpkeep, wardenAfterTurn, wardenIntent, type KeruInvokeState } from './keruInvoke';
import type { Card } from '../protoState';
import { advanceIntent, armorOwner, startCharging, breathIntent, breathTurn, chokeIfBroken, dealIntent, intentEnemyPlayOne, intentOwnerSkips, intentPassiveAndFire, openPartyTurn, type BreathPhase, type IntentCard } from './battleDeadRun';

// Tutorial and focused combat-sandbox scenarios over the turn-based battle
// rules: scenario setup, endless backfill and the rounds counter, tableau
// receipt statuses, and the enemy turn with enemy Momentum and reactions.

/** A paced enemy turn's next step; `skips` is fixed when the turn opens (a staggered owner skips the intent). */
export type EnemyStep = { phase: 'strike' | 'breath' | 'play' | 'passive' | 'foundation' | 'end'; foe: number; plays: number; skips: boolean; foundationSkips?: string[] };

export type TutorialRuntime = {
  id: TutorialScenarioId;
  /** Foes defeated in an endless scenario: the "Rounds completed" counter. */
  cleared: number;
  /** Wave reached per foe slot (by authored key). */
  waves: Record<string, number>;
  /** The foundation that received the last card this turn (Sap). */
  lastReceiver?: string;
  /** Abilities played this party turn (Stifling Sap allows one). */
  abilitiesThisTurn?: number;
  /** Seconds left before a paced enemy turn's next step (TutorialDef.enemyTurnSeconds), and that step. */
  enemyClock?: number;
  enemyStep?: EnemyStep;
  /** Dead-run fixes (rules/battleDeadRun.ts): the intent card, parked cards by Kin, and this turn's pity flip. */
  intent?: IntentCard;
  /** Remaining permanent capacity of the enemy ability. */
  intentCap?: number;
  /** Positive ability progress already made this enemy turn. */
  intentProgressThisTurn?: number;
  /** Enemies that already skipped a turn and recover at the next party handoff. */
  staggerSkipped?: string[];
  /** A readying, armored intent's lifecycle (battleDeadRun BreathPhase). */
  breath?: BreathPhase;
  holds?: Partial<Record<string, Card>>;
  /** Kin whose Hold ability opened a hold slot for the rest of the fight. */
  holdsOpen?: string[];
  pity?: 'ready' | 'spent';
};

const FOE_RANKS = [9, 6, 12];
const ROWS = 4;

/** One foe at a given wave: endless scenarios grow HP, damage and gauge with each wave. */
export function spawnTutorialFoe(def: TutorialDef, foe: TutorialFoeDef, wave: number, slot: number, template: BattleFoe): BattleFoe {
  const grow = def.endless, step = wave - 1;
  const hp = foe.hp + (grow ? grow.hpStep * step : 0);
  const damage = foe.damage + (grow?.damageEvery ? Math.floor(step / grow.damageEvery) : 0);
  const staggerMax = Math.min(grow?.staggerCap ?? Infinity, foe.staggerMax + (grow?.staggerEvery ? Math.floor(step / grow.staggerEvery) : 0));
  const id = wave === 1 ? foe.key : `${foe.key}-${wave}`, rank = FOE_RANKS[slot % FOE_RANKS.length];
  return { ...template, id, name: foe.name, tutorialKey: foe.key, appearance: 'khad-root',
    intent: 'attack', frostKit: foe.frostKit, frostArmor: 0, frostHits: 0, frostReceipts: 0, thorns: 0, ironbark: false, hp, timer: 0, stagger: 0, staggered: 0, staggerStage: 0, effects: [], statuses: foe.statuses ? [...foe.statuses] : [],
    momentum: foe.noMomentum ? undefined : 0, inflicts: foe.inflicts, fed: 0, eye: null, rank, foundationCards: [{ id: `${id}-opening`, rank }],
    disarmed: false, turnSpent: false, profile: { ...template.profile, maxHp: hp, damage, staggerMax } };
}

export function createTutorialScenario(id: TutorialScenarioId): BattleState {
  const def = tutorialById(id)!, base = createStaggerSandbox(), COLUMNS = def.columns ?? 7, seed = def.randomSeed ? base.seed : def.seed;
  const spatial = id === '1001', rows = id === '1000' || spatial ? 3 : ROWS;
  const columns = def.deal ? def.deal.map((ranks, c) => ranks.map((rank, r) => ({ id: `tutorial-${id}-${c}-${r}`, rank })))
    : Array.from({ length: COLUMNS }, (_, c) => Array.from({ length: rows }, (_, r) => stockCard(seed, c * rows + r)));
  if(id==='1000')for(let c=0;c<columns.length;c++)columns[c]=columns[c].map(splitCard);
  const foes = def.foes.map((foe, slot) => spawnTutorialFoe(def, foe, 1, slot, base.foes[0]));
  // An armored caster starts with nothing on the table and casts its ability on its first turn.
  const deal = def.intentCard?.armored ? armorOwner : dealIntent;
  const state = openPartyTurn(deal({ ...base, sandboxScenario: id, cir: { status: 'available' }, round: 1, seed, effectSeed: seed,
    rules: { ...base.rules, columns: COLUMNS, spatialLanes: spatial, dualRanks: id === '1000', elementSuits: def.elementSuits, ...(id==='1000' || spatial ? { infinifillRows: 3 } : {}) },
    ...(def.elementSuits ? { elementPlay: 'ready' as const } : {}), columns, stock: [], dealt: COLUMNS * rows + (isTruefourstar(id) ? def.party!.length : 0) + (def.keru ? INVOKE_KERU.length : 0), foes,
    // Each Keru's starter value is the next seeded card after Hero's opening.
    ...(def.keru ? { keruInvoke: keruInvokeSetup(Object.fromEntries(INVOKE_KERU.map((keru, i) => [keru, stockCard(seed, COLUMNS * rows + def.party!.length + i).rank])) as KeruInvokeState['values'], def.keru) } : {}),
    tutorial: { id, cleared: 0, waves: Object.fromEntries(def.foes.map(foe => [foe.key, 1])) },
    momentum: { value: def.momentum ?? 0, earned: 0, spent: 0, sequence: 0, decayEnabled: def.decay ?? false },
    party: [...(id==='1002' ? [{...newActor('aldan-seed'),targetId:foes[0].id}] : []), ...(def.party ? def.party.map(id=>base.party.find(actor=>actor.id===id) ?? newActor(id)) : base.party).map(actor => ({ ...actor, targetId: foes[0].id, charge: def.ap ?? 0, hp: def.partyHp ?? actor.maxHp, maxHp: def.partyHp ?? actor.maxHp,
      ...(id==='1002' ? {rank:0,foundationCards:[]} : isTruefourstar(id) ? (() => { const card = stockCard(seed, COLUMNS * rows + (def.party as readonly string[]).indexOf(actor.id)); return {rank:card.rank,foundationCards:[card]}; })() : {}), statuses: [] }))] }));
  if (def.breathStart !== undefined) return startCharging(state, def.breathStart);
  return id==='1002'?enterKeruEncounter(state):state;
}

/** Rounds completed in an endless scenario, or null when the scenario is finite. */
export const tutorialRounds = (state: BattleState) => state.tutorial && tutorialById(state.tutorial.id)?.endless ? state.tutorial.cleared : null;

export const tutorialStrike = (state: BattleState, actorId: string): StrikeProfile =>
  actorId==='snow-golem' || state.tutorial?.id === '111' ? { name: 'Nip', damage: 1, stagger: 0 } : actorId==='aldan-seed' ? {name:'Seed pulse',damage:1,stagger:0} : tutorialById(state.tutorial?.id)?.strikes?.[actorId as 'hero' | 'mochi'] ?? { name: actorId === 'hero' ? 'Nip' : 'Claw', damage: 1, stagger: 1 };

/** Endless scenarios replace each defeated foe at once; everyone keeps a living target. */
export function settleTutorial(state: BattleState): BattleState {
  const def = tutorialById(state.tutorial?.id);
  if (!def || !state.tutorial) return state;
  let { cleared } = state.tutorial;
  const waves = { ...state.tutorial.waves }, replaced = new Map<string, string>();
  const foes = !def.endless ? state.foes : state.foes.map((foe, slot) => {
    if (foeAlive(foe) || !foe.tutorialKey) return foe;
    const authored = def.foes.find(entry => entry.key === foe.tutorialKey);
    if (!authored) return foe;
    const wave = (waves[foe.tutorialKey] ?? 1) + 1;
    waves[foe.tutorialKey] = wave; cleared += 1;
    const next = spawnTutorialFoe(def, authored, wave, slot, foe);
    replaced.set(foe.id, next.id);
    return next;
  });
  const living = foes.find(foeAlive);
  const party = state.party.map(actor => {
    const target = actor.targetId && (replaced.get(actor.targetId) ?? actor.targetId);
    const valid = foes.some(foe => foe.id === target && foeAlive(foe));
    const targetId = valid ? target : living?.id ?? actor.targetId;
    return targetId === actor.targetId ? actor : { ...actor, targetId };
  });
  const next = chokeIfBroken({ ...state, foes, party, tutorial: { ...state.tutorial, cleared, waves } });
  return { ...next, result: outcome(next) };
}

/** Sap forbids two receipts in a row on one foundation; Wild admits any rank. */
export function tutorialReceiptLegal(state: BattleState, actorId: string, legal: boolean) {
  const actor = state.party.find(unit => unit.id === actorId);
  if (hasStatus(actor, 'sap') && state.tutorial?.lastReceiver === actorId) return false;
  return legal || hasStatus(actor, 'wild');
}

/** After a tableau receipt and its hit: Haste (per card), Second Wind, Rime, Exposed and Bleed ticks. */
export function afterTutorialReceipt(state: BattleState, actorId: string): BattleState {
  if (!state.tutorial) return state;
  let next: BattleState = { ...state, tutorial: { ...state.tutorial, lastReceiver: actorId } };
  const actor = next.party.find(unit => unit.id === actorId);
  if (!actor) return next;
  next = patchActor(next, actorId, unit => withoutStatus(unit, 'wild'));
  const haste = statusOf(actor, 'haste');
  if (haste) next = patchActor(next, actorId, unit => (haste.stacks ?? 0) > 1 ? withStatus(unit, { ...haste, stacks: (haste.stacks ?? 0) - 1 }) : withoutStatus(unit, 'haste'));
  // Haste doubles this receipt's AP. Haste doubles and Slow halves its Momentum (the shared pool keeps fractions).
  if (haste) next = patchActor(next, actorId, unit => ({ ...unit, charge: Math.min(apCap(unit), unit.charge + 1) }));
  if ((haste || hasStatus(actor, 'slow')) && next.momentum) {
    const base = next.momentum.lastGain ?? 1, gain = scaleMomentumGain(actor, base, false), extra = gain - base;
    next = { ...next, momentum: { ...next.momentum, value: Math.max(0, next.momentum.value + extra), earned: next.momentum.earned + extra, lastGain: gain } };
  }
  if (hasStatus(actor, 'regen') && actor.hp > 0) next = patchActor(next, actorId, unit => ({ ...unit, hp: Math.min(unit.maxHp, unit.hp + 1) }));
  const target = next.foes.find(foe => foe.id === actor.targetId && foeAlive(foe));
  if (target && hasStatus(actor, 'rime')) next = chill(next, target.id);
  if (target && hasStatus(target, 'exposed')) next = bleed(next, target.id, 1);
  for (const foe of next.foes) {
    const stacks = statusOf(foe, 'bleed')?.stacks ?? 0;
    if (!foeAlive(foe) || stacks <= 0) continue;
    next = { ...next, foes: next.foes.map(unit => unit.id !== foe.id ? unit : stacks > 1 ? withStatus(unit, { id: 'bleed', stacks: stacks - 1 }) : withoutStatus(unit, 'bleed')) };
    next = damageFoe(next, foe.id, 1, 'Bleed', 'dot');
  }
  return next;
}

/** Next cards the infinifill will deal, in order (Foresight). */
export function upcomingRefills(state: BattleState, count: number = T.foresightCards): Card[] {
  return Array.from({ length: count }, (_, i) => i < state.stock.length ? state.stock[i] : stockCard(state.seed, state.dealt + i - state.stock.length));
}

/** A seeded coin flip from the effect stream; card deals are unaffected. */
const roll = (state: BattleState) => {
  // mulberry32: well mixed even for small consecutive seeds.
  const seed = (state.effectSeed + 0x6D2B79F5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state: { ...state, effectSeed: seed }, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};

/** Whether this foe's next action is a Heavy Strike: its banked Momentum plus this turn's gain reaches the cost. */
export const heavyStrikeNext = (foe: BattleFoe) => (foe.momentum ?? 0) + foeMomentumGain(foe) >= T.heavyStrikeCost;

/** One foe's enemy turn: bank Momentum, then Strike, or spend it on a Heavy Strike. Frozen, Stunned, Held and staggered foes skip. */
function foeTurn(state: BattleState, foeId: string): BattleState {
  let next = state, foe = next.foes.find(unit => unit.id === foeId);
  if (!foe || !foeAlive(foe) || foe.turnSpent || next.result) return next;
  const burn = statusOf(foe, 'burn');
  if (burn) { next = damageFoe(next, foeId, burn.stacks ?? T.burnDamage, 'Burn', 'dot'); foe = next.foes.find(unit => unit.id === foeId)!; if (!foeAlive(foe)) return next; }
  const set = (patch: (unit: BattleFoe) => BattleFoe) => { next = { ...next, foes: next.foes.map(unit => unit.id === foeId ? patch(unit) : unit) }; };
  // A counted stun (a backfire) holds the stagger until its last turn, which is also the recovery.
  const counted = statusOf(foe, 'stun');
  if (counted?.turns) { set(unit => (counted.turns ?? 0) > 1 ? withStatus(unit, { ...counted, turns: (counted.turns ?? 0) - 1 }) : { ...withoutStatus(unit, 'stun'), stagger: 0, staggered: 0, staggerStage: 0 }); return next; }
  if (foe.staggered > 0) return next;
  const dormant = statusOf(foe, 'dormant');
  if (dormant) { set(unit => (dormant.turns ?? 0) > 1 ? withStatus(unit, { ...dormant, turns: (dormant.turns ?? 0) - 1 }) : withoutStatus(unit, 'dormant')); return next; }
  if (hasStatus(foe, 'frozen') || hasStatus(foe, 'stun')) { set(unit => withoutStatus(unit, 'frozen', 'stun')); return next; }
  const grip = statusOf(foe, 'grip');
  if (grip) { set(unit => (grip.turns ?? 0) > 1 ? withStatus(unit, { ...grip, turns: (grip.turns ?? 0) - 1 }) : withoutStatus(unit, 'grip')); return next; }
  // Foes without Momentum never bank it or Heavy Strike; foes without a strike only use their abilities.
  const heavy = foe.momentum !== undefined && heavyStrikeNext(foe), momentum = (foe.momentum ?? 0) + foeMomentumGain(foe) - (heavy ? T.heavyStrikeCost : 0);
  if (foe.momentum !== undefined) set(unit => ({ ...unit, momentum }));
  if (foe.profile.damage <= 0) return next;
  const name = heavy ? `${foe.name} · Heavy Strike` : foe.name;
  const intended=enemyTarget(next);
  const target = intended && partyDamageTarget(next,intended.id);
  if (!target) return next;
  if (hasStatus(foe, 'blind')) {
    set(unit => withoutStatus(unit, 'blind'));
    const flip = roll(next); next = flip.state;
    if (flip.value < T.blindMiss) return pushEvents(next, [{ kind: 'enemy-hit', sourceId: foeId, targetId: target.id, amount: 0, label: `${name} · Missed` }]);
  }
  if (hasStatus(target, 'guard')) {
    next = patchActor(next, target.id, unit => withoutStatus(unit, 'guard'));
    return pushEvents(next, [{ kind: 'enemy-hit', sourceId: foeId, targetId: target.id, amount: 0, label: `${name} · Guarded` }]);
  }
  const dodge = evadeCir(next, target); next = dodge.state;
  if (dodge.evaded) return pushEvents(next, [{ kind: 'enemy-hit', sourceId: foeId, targetId: target.id, amount: 0, label: 'Swift Wings · Evaded' }]);
  const damage = weakenedHit(foe, foe.profile.damage * (heavy ? T.heavyStrikeMultiplier : 1)), hurtTarget = absorbTempHp(target, damage), hp = hurtTarget.hp;
  next = patchActor(next, target.id, unit => {
    const hurt = { ...unit, ...hurtTarget };
    if (hp <= 0 || !foe!.inflicts) return hurt;
    return withStatus(hurt, foe!.inflicts === 'sap' ? { id: 'sap', turns: 2 } : { id: 'silence', turns: 1 });
  });
  next = pushEvents(next, [{ kind: 'enemy-hit', sourceId: foeId, targetId: target.id, amount: damage, label: name },
    ...(hp === 0 ? [{ kind: 'down' as const, sourceId: foeId, targetId: target.id }] : [])]);
  if (damage>0) next=thornsRetaliation(next,target,foeId);
  next = triggerPhoenix(next);
  next = golemFarewell({ ...next, result: outcome(next) });
  if (next.cir?.status === 'bound' && next.cir.actorId === 'hero' && target.id === 'hero') next = cirFireHit(next, foeId, CIR_EXPRESSIONS.hero.damage, 'Hearthflame', 'hero');
  return next;
}

/** Regrowth: at the end of its turn a living foe at or above its threshold (stacks, % of max HP) heals to full. */
function regrow(state: BattleState, foeId: string): BattleState {
  const foe = state.foes.find(unit => unit.id === foeId), regrowth = statusOf(foe, 'regrowth');
  if (!foe || !regrowth || !foeAlive(foe) || foe.hp < foe.profile.maxHp * (regrowth.stacks ?? 40) / 100 || foe.hp === foe.profile.maxHp) return state;
  return { ...state, foes: state.foes.map(unit => unit.id === foeId ? { ...unit, hp: unit.profile.maxHp } : unit) };
}

/** The whole enemy team acts once, then control returns to the party. */
/** Real seconds between the steps of a paced enemy turn, so each action can animate before the next. */
export const ENEMY_STEP_SECONDS = { hold: 0.7, cast: 1, strike: 0.8, play: 0.75, passive: 0.6, fire: 1.1, end: 0.6 } as const;

/** Enemy-turn setup shared by the instant and paced turns: Keru upkeep is paid, party-turn statuses end, foes rearm. */
const openEnemyTurn = (state: BattleState) => {
  state = openSnowflakeEnemyTurn(state);
  // 1012: Keru upkeep is paid as the party turn ends, so AP earned this turn counts.
  const paid=golemUpkeep(payKeruUpkeep(state));
  const armored={...paid,party:paid.party.map(actor=>actor.hp>0 && actor.iceRewards?.includes('ice-armor') ? {...actor,iceArmorRestored:false,iceArmor:Math.min([5,8,12,12][iceTier(actor,'ice-armor')],(actor.iceArmor ?? 0)+actor.charge*(iceTier(actor,'ice-armor')>=2?2:1))} : actor)};
  const themed={...armored,party:armored.party.map(actor=>actor.hp>0?{...moteEndTurn(themedGuard(actor)),inciteHeat:actor.iceRewards?.includes('ember-cadence') && iceTier(actor,'ember-cadence')===3 ? Math.min(1,actor.inciteHeat ?? 0):0,rewardTurnMoves:0}:actor)};
  const expired = expirePartyTurn(themed), recovered = new Set(expired.tutorial?.staggerSkipped ?? []);
  const foes = expired.foes.map(foe => {
    const unit = recovered.has(foe.id) && !hasStatus(foe, 'stun') ? { ...foe, stagger: 0, staggered: 0, staggerStage: 0 } : foe;
    return unit.turnSpent ? { ...unit, turnSpent: false } : unit;
  });
  const ownerRecovered = recovered.has(expired.foes[0]?.id) && !foes[0]?.staggered;
  const tutorial = expired.tutorial && { ...expired.tutorial, intentProgressThisTurn: 0,
    staggerSkipped: foes.filter(foe => foe.staggered > 0 && !hasStatus(foe, 'stun')).map(foe => foe.id),
    ...(ownerRecovered && expired.tutorial.intentCap === 0 ? { intent: undefined } : {}) };
  return recoverDisarmed({ ...expired, tutorial, foes }, 'foes');
};
const foesAct = (state: BattleState) => {
  let next = state;
  for (const id of next.foes.map(foe => foe.id)) {
    if (next.result) break;
    next = wardenAfterTurn(regrow(foeTurn(next, id), id), id);
  }
  return next;
};
const closeEnemyTurn = (state: BattleState) => {
  const chilled={...state,party:state.party.map(actor=>({...actor,fossilTurns:Math.max(0,(actor.fossilTurns ?? 0)-1),thornsTurns:Math.max(0,(actor.thornsTurns ?? 0)-1)})),foes:state.foes.map(foe=>({...foe,frostArmor:foe.hp>0 && foe.frostKit==='armor' ? Math.min(2,(foe.frostArmor ?? 0)+2) : foe.frostArmor,rimeFrozen:false,iceVulnerable:Math.max(0,(foe.iceVulnerable ?? 0)-1),iceFrost:foe.iceFrost?.map(turns=>turns-1).filter(turns=>turns>0)}))};
  const next = settleTutorial(expireEnemyTurn(chilled));
  return next.result ? { ...next, turn: 'party' as const, tutorial: next.tutorial && { ...next.tutorial, enemyClock: undefined, enemyStep: undefined } } : openPartyTurn(returnPlayerTurn(next));
};

/**
 * The party hands off. Paced scenarios (enemyTurnSeconds) hold the board for
 * that long, then play the enemy turn one action at a time on the clock: the
 * foes' strikes, each card played onto the intent, its passive pip (and
 * firing), then the handoff, which lands any delayed Withdraw redeal.
 */
export function beginTutorialEnemyTurn(state: BattleState): BattleState {
  if (!state.rules.pacedEnemyTurns || !state.tutorial) return tutorialEnemyTurn(state);
  const next = openEnemyTurn(state), seconds = tutorialById(state.tutorial.id)?.enemyTurnSeconds ?? ENEMY_STEP_SECONDS.hold;
  return { ...next, turn: 'enemy', tutorial: { ...next.tutorial!, enemyClock: seconds, enemyStep: { phase: 'strike', foe: 0, plays: 0, skips: intentOwnerSkips(next.foes[0]), foundationSkips: next.foes.filter(intentOwnerSkips).map(foe=>foe.id) } } };
}

/** 1012: the dragon takes an adjacent exposed card onto its own foundation and chips Hero. */
export function dragonFoundationPlay(state: BattleState, foeIndex=0): BattleState | null {
  if (!['1012','100','101','102','103','104','105'].includes(state.tutorial?.id ?? '') || state.result) return null;
  const foe=state.foes[foeIndex], target=['100','101','102','103','104','105'].includes(state.tutorial?.id ?? '') ? enemyTarget(state) : state.party.find(actor=>actor.id==='hero' && actor.hp>0);
  if (!foe || !foeAlive(foe) || foe.rimeFrozen || !target) return null;
  const column=state.columns.findIndex(cards=>cards.length>0 && isAdjacentRank(cards[cards.length-1].rank,foe.rank) && !state.traps[cards[cards.length-1].id]);
  if (column<0) return null;
  const taken=takeTop(state,column)!;
  const dodge=evadeCir(state,target); state=dodge.state;
  const whiteout=foe.frostKit==='whiteout' && ((foe.frostReceipts ?? 0)+1)%4===0;
  const damage=weakenedHit(foe,whiteout?2:1), absorbed=dodge.evaded ? target : absorbTempHp(target,damage);
  const stacks=!dodge.evaded && target.iceRewards?.includes('rime-retort') ? (target.rimeRetort ?? 0)+1 : 0;
  const tier=iceTier(target,'rime-retort'),froze=stacks>=[6,5,4,4][tier];
  const hurt=stacks ? {...absorbed,rimeRetort:froze?0:stacks} : absorbed;
  let next: BattleState={...state,columns:taken.columns,stock:taken.stock,dealt:taken.dealt,foes:state.foes.map(unit=>unit.id===foe.id?{...unit,frostReceipts:(unit.frostReceipts ?? 0)+1,rank:taken.card.rank,foundationCards:[...foundationCardsOf(unit),taken.card],...(froze?{rimeFrozen:true,...(tier===3?{hp:Math.max(0,unit.hp-2)}:{})}:{})}:unit),party:state.party.map(actor=>actor.id===target.id?hurt:actor)};
  next=pushEvents(next,[{kind:'enemy-hit',sourceId:foe.id,targetId:target.id,amount:dodge.evaded?0:damage,chipDamage:!dodge.evaded,label:dodge.evaded?(target.lightMotes?.['gale-mote']?'Gale Mote · Evaded':'Whiteout · Evaded'):foe.name+(whiteout?' · Whiteout':' · Chip')},...(hurt.hp<=0?[{kind:'down' as const,sourceId:foe.id,targetId:target.id}]:[])]);
  if (!dodge.evaded && damage>0) next=thornsRetaliation(next,target,foe.id);
  next=triggerPhoenix(next);
  next=golemFarewell(next);
  return {...next,result:outcome(next)};
}

/** Advances a paced enemy turn by real seconds, one step each time its clock runs out. */
export function tickTutorialEnemyTurn(state: BattleState, dt: number): BattleState {
  const clock = state.tutorial?.enemyClock, step = state.tutorial?.enemyStep;
  if (clock === undefined || state.turn !== 'enemy') return state;
  if (clock - dt > 0) return { ...state, tutorial: { ...state.tutorial!, enemyClock: clock - dt } };
  if (!step) return tutorialEnemyTurn({ ...state, tutorial: { ...state.tutorial!, enemyClock: undefined } });
  const at = (next: BattleState, phase: EnemyStep['phase'], seconds: number, plays = step.plays): BattleState =>
    next.result ? closeEnemyTurn(next) : { ...next, tutorial: { ...next.tutorial!, enemyClock: seconds, enemyStep: { ...step, phase, plays } } };
  const def = tutorialById(state.tutorial!.id)?.intentCard, acts = Boolean(def && state.tutorial!.intent && !step.skips && foeAlive(state.foes[0]));
  switch (step.phase) {
    case 'strike': {
      // One foe per step; a foe that does nothing visible (dormant, frozen, recovering) passes straight on.
      const foe = state.foes[step.foe];
      if (!foe) { const next=at(state, ['100','101','102','103','104','105'].includes(state.tutorial?.id ?? '') ? 'foundation' : def?.readies ? 'breath' : acts ? 'play' : 'end', 0, 0); return tickTutorialEnemyTurn({...next,tutorial:{...next.tutorial!,enemyStep:{...next.tutorial!.enemyStep!,foe:0}}},0); }
      const after = wardenAfterTurn(regrow(foeTurn(state, foe.id), foe.id), foe.id), shown = after.nextEventId !== state.nextEventId;
      const next = at(after, 'strike', shown ? ENEMY_STEP_SECONDS.strike : 0);
      return { ...next, tutorial: next.tutorial && next.tutorial.enemyStep ? { ...next.tutorial, enemyStep: { ...next.tutorial.enemyStep, foe: step.foe + 1 } } : next.tutorial };
    }
    case 'breath': {
      // Cast, wind up, unleash or re-armor; only a charging ability goes on to its plays.
      const turn = breathTurn(state);
      return turn.plays && !step.skips ? at(turn.state, 'play', turn.acted ? ENEMY_STEP_SECONDS.cast : 0) : at(turn.state, state.tutorial?.id === '1012' && !step.skips && state.tutorial.breath !== 'readied' ? 'foundation' : 'end', turn.acted ? ENEMY_STEP_SECONDS.fire : 0, 0);
    }
    case 'play': {
      const played = step.plays < (def?.enemyPlays ?? 0) ? intentEnemyPlayOne(state) : null;
      return played ? at(played, 'play', ENEMY_STEP_SECONDS.play, step.plays + 1) : tickTutorialEnemyTurn(at(state, 'passive', 0), 0);
    }
    case 'passive': {
      const after = intentPassiveAndFire(state), fired = after.tutorial?.intent?.id !== state.tutorial!.intent?.id;
      return at(after, state.tutorial?.id === '1012' && !step.skips ? 'foundation' : 'end', fired ? ENEMY_STEP_SECONDS.fire : ENEMY_STEP_SECONDS.passive, 0);
    }
    case 'foundation': {
      const index=state.tutorial?.id==='1012' ? 0 : step.foe;
      const foe=state.foes[index];
      if (!foe) return tickTutorialEnemyTurn(at(state, 'end', 0), 0);
      const played=step.plays < 100 && !step.foundationSkips?.includes(foe.id) ? dragonFoundationPlay(state,index) : null;
      if (played) return at(played, 'foundation', ENEMY_STEP_SECONDS.play, step.plays + 1);
      if (state.tutorial?.id==='1012') return tickTutorialEnemyTurn(at(state, 'end', 0), 0);
      const next=at(state,'foundation',0,0);
      return tickTutorialEnemyTurn({...next,tutorial:{...next.tutorial!,enemyStep:{...next.tutorial!.enemyStep!,foe:index+1}}},0);
    }
    case 'end': return closeEnemyTurn({ ...state, tutorial: { ...state.tutorial!, enemyClock: undefined, enemyStep: undefined } });
  }
}

export function tutorialEnemyTurn(state: BattleState): BattleState {
  let next = openEnemyTurn(state);
  const ownerSkips = intentOwnerSkips(next.foes[0]), foundationSkips = new Set(next.foes.filter(intentOwnerSkips).map(foe=>foe.id));
  next = foesAct(next);
  const turn = breathTurn(next);
  next = turn.plays ? advanceIntent(turn.state, ownerSkips) : turn.state;
  if (state.tutorial?.breath !== 'readied' && ['1012','100','101','102','103','104','105'].includes(next.tutorial?.id ?? '')) { for (let f=0; f<next.foes.length; f++) { if (foundationSkips.has(next.foes[f].id)) continue; for (let i=0; i<100 && !next.result; i++) { const played=dragonFoundationPlay(next,f); if (!played) break; next=played; } } }
  return closeEnemyTurn(next);
}

/** `glyph` and `damage` override the badge's icon and number (abilities such as Deep Breath). */
export type TutorialIntent = { summary: string; detail: string; skips: boolean; heavy: boolean; glyph?: string; damage?: number };
/** Intent copy for a tutorial foe: its next strike, whether it is Heavy, and why it might skip. An armored caster's ability lifecycle takes priority. */
export function tutorialIntent(foe: BattleFoe, targetName: string | null, battle?: BattleState): TutorialIntent | null {
  const breath = battle && battle.foes[0]?.id === foe.id ? breathIntent(battle) ?? wardenIntent(battle) : null;
  if (breath) return breath;
  if (foe.momentum === undefined) return null;
  const extras = `${foe.inflicts === 'sap' ? ' Its hit Saps the Kin it strikes.' : foe.inflicts === 'silence' ? ' Its hit Silences the Kin it strikes for your next turn.' : ''} It targets the Kin holding the most AP; ties use party order.`;
  const skip = (summary: string, why: string): TutorialIntent => ({ summary, detail: `${foe.name} ${why}`, skips: true, heavy: false });
  const dormant = statusOf(foe, 'dormant');
  if (dormant) return skip(`Dormant · ${dormant.turns} turn${dormant.turns === 1 ? '' : 's'}`, `is dormant for ${dormant.turns} more enemy turn${dormant.turns === 1 ? '' : 's'}: it takes no action and banks no Momentum.`);
  if (foe.staggered > 0) return skip('Recovering', 'is staggered: it spends its next enemy turn recovering instead of striking, and banks no Momentum.');
  if (hasStatus(foe, 'frozen')) return skip('Frozen · skips', 'is Frozen: it skips its next enemy turn and banks no Momentum. Takedown now Shatters it.');
  if (hasStatus(foe, 'stun')) return skip('Stunned · skips', 'is Stunned: it skips its next enemy turn and banks no Momentum.');
  const grip = statusOf(foe, 'grip');
  if (grip) return skip(`Held · ${grip.turns} turn${grip.turns === 1 ? '' : 's'}`, `is held by Vice Grip for ${grip.turns} more enemy turn${grip.turns === 1 ? '' : 's'}: it cannot strike or bank Momentum.`);
  const heavy = heavyStrikeNext(foe), who = targetName ?? 'No target', gain = foeMomentumGain(foe);
  const damage = weakenedHit(foe, foe.profile.damage * (heavy ? T.heavyStrikeMultiplier : 1));
  return { summary: heavy ? `Heavy · ${who}` : who, skips: false, heavy,
    detail: `${foe.name} intends ${heavy ? 'a Heavy Strike' : 'to strike'} on ${who} for ${damage} damage. It has ${foe.momentum} Momentum and banks ${gain} on its turn; at ${T.heavyStrikeCost} it spends them on a Heavy Strike (×${T.heavyStrikeMultiplier} damage).${extras}` };
}
