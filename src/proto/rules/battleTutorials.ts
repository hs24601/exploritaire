import { apCap, createStaggerSandbox, cirFireHit, enemyTarget, foeAlive, recoverDisarmed, returnPlayerTurn, CIR_EXPRESSIONS, type BattleFoe, type BattleState } from './battle';
import { STATUS_TUNING as T } from './battleStatusData';
import { tutorialById, type StrikeProfile, type TutorialDef, type TutorialFoeDef, type TutorialScenarioId } from './battleTutorialScenarios';
import { bleedFoe as bleed, chillFoe as chill, damageFoe, expireEnemyTurn, expirePartyTurn, hasStatus, outcome, patchActor, pushEvents, statusOf, foeMomentumGain, scaleMomentumGain, withStatus, withoutStatus } from './battleStatuses';
import { stockCard } from './skirmish';
import type { Card } from '../protoState';
import { advanceIntent, dealIntent, intentOwnerSkips, openPartyTurn, type IntentCard } from './battleDeadRun';

// Tutorial and focused combat-sandbox scenarios over the turn-based battle
// rules: scenario setup, endless backfill and the rounds counter, tableau
// receipt statuses, and the enemy turn with enemy Momentum and reactions.

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
  /** Dead-run fixes (rules/battleDeadRun.ts): the intent card, parked cards by Kin, and this turn's pity flip. */
  intent?: IntentCard;
  holds?: Partial<Record<string, Card>>;
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
    intent: 'attack', thorns: 0, ironbark: false, hp, timer: 0, stagger: 0, staggered: 0, staggerStage: 0, effects: [], statuses: foe.statuses ? [...foe.statuses] : [],
    momentum: 0, inflicts: foe.inflicts, fed: 0, eye: null, rank, foundationCards: [{ id: `${id}-opening`, rank }],
    disarmed: false, turnSpent: false, profile: { ...template.profile, maxHp: hp, damage, staggerMax } };
}

export function createTutorialScenario(id: TutorialScenarioId): BattleState {
  const def = tutorialById(id)!, base = createStaggerSandbox(), COLUMNS = def.columns ?? 7;
  const columns = def.deal ? def.deal.map((ranks, c) => ranks.map((rank, r) => ({ id: `tutorial-${id}-${c}-${r}`, rank })))
    : Array.from({ length: COLUMNS }, (_, c) => Array.from({ length: ROWS }, (_, r) => stockCard(def.seed, c * ROWS + r)));
  const foes = def.foes.map((foe, slot) => spawnTutorialFoe(def, foe, 1, slot, base.foes[0]));
  return openPartyTurn(dealIntent({ ...base, sandboxScenario: id, cir: { status: 'available' }, round: 1, seed: def.seed, effectSeed: def.seed,
    rules: { ...base.rules, columns: COLUMNS }, columns, stock: [], dealt: COLUMNS * ROWS, foes,
    tutorial: { id, cleared: 0, waves: Object.fromEntries(def.foes.map(foe => [foe.key, 1])) },
    momentum: { value: def.momentum ?? 0, earned: 0, spent: 0, sequence: 0, decayEnabled: def.decay ?? true },
    party: base.party.filter(actor => !def.party || def.party.includes(actor.id as 'hero' | 'mochi')).map(actor => ({ ...actor, targetId: foes[0].id, charge: def.ap ?? 0, hp: def.partyHp ?? actor.maxHp, maxHp: def.partyHp ?? actor.maxHp,
      statuses: actor.id === def.insight.actorId ? [{ id: 'insight' as const }] : [] })) }));
}

/** Rounds completed in an endless scenario, or null when the scenario is finite. */
export const tutorialRounds = (state: BattleState) => state.tutorial && tutorialById(state.tutorial.id)?.endless ? state.tutorial.cleared : null;

export const tutorialStrike = (state: BattleState, actorId: string): StrikeProfile =>
  tutorialById(state.tutorial?.id)?.strikes?.[actorId as 'hero' | 'mochi'] ?? { name: actorId === 'hero' ? 'Nip' : 'Claw', damage: 1, stagger: 1 };

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
  const next = { ...state, foes, party, tutorial: { ...state.tutorial, cleared, waves } };
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
  if (foe.staggered > 0) { set(unit => ({ ...unit, stagger: 0, staggered: 0, staggerStage: 0 })); return next; }
  const dormant = statusOf(foe, 'dormant');
  if (dormant) { set(unit => (dormant.turns ?? 0) > 1 ? withStatus(unit, { ...dormant, turns: (dormant.turns ?? 0) - 1 }) : withoutStatus(unit, 'dormant')); return next; }
  if (hasStatus(foe, 'frozen') || hasStatus(foe, 'stun')) { set(unit => withoutStatus(unit, 'frozen', 'stun')); return next; }
  const grip = statusOf(foe, 'grip');
  if (grip) { set(unit => (grip.turns ?? 0) > 1 ? withStatus(unit, { ...grip, turns: (grip.turns ?? 0) - 1 }) : withoutStatus(unit, 'grip')); return next; }
  const heavy = heavyStrikeNext(foe), momentum = (foe.momentum ?? 0) + foeMomentumGain(foe) - (heavy ? T.heavyStrikeCost : 0);
  set(unit => ({ ...unit, momentum }));
  const name = heavy ? `${foe.name} · Heavy Strike` : foe.name;
  const target = enemyTarget(next);
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
  const damage = foe.profile.damage * (heavy ? T.heavyStrikeMultiplier : 1), hp = Math.max(0, target.hp - damage);
  next = patchActor(next, target.id, unit => {
    const hurt = { ...unit, hp };
    if (hp <= 0 || !foe!.inflicts) return hurt;
    return withStatus(hurt, foe!.inflicts === 'sap' ? { id: 'sap', turns: 2 } : { id: 'silence', turns: 1 });
  });
  next = pushEvents(next, [{ kind: 'enemy-hit', sourceId: foeId, targetId: target.id, amount: damage, label: name },
    ...(hp === 0 ? [{ kind: 'down' as const, sourceId: foeId, targetId: target.id }] : [])]);
  next = { ...next, result: outcome(next) };
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
export function tutorialEnemyTurn(state: BattleState): BattleState {
  let next = recoverDisarmed({ ...expirePartyTurn(state), foes: state.foes.map(foe => foe.turnSpent ? { ...foe, turnSpent: false } : foe) }, 'foes');
  const ownerSkips = intentOwnerSkips(next.foes[0]);
  for (const id of next.foes.map(foe => foe.id)) {
    if (next.result) break;
    next = regrow(foeTurn(next, id), id);
  }
  next = settleTutorial(expireEnemyTurn(advanceIntent(next, ownerSkips)));
  return next.result ? { ...next, turn: 'party' } : openPartyTurn(returnPlayerTurn(next));
}

export type TutorialIntent = { summary: string; detail: string; skips: boolean; heavy: boolean };
/** Intent copy for a tutorial foe: its next strike, whether it is Heavy, and why it might skip. */
export function tutorialIntent(foe: BattleFoe, targetName: string | null): TutorialIntent | null {
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
  const damage = foe.profile.damage * (heavy ? T.heavyStrikeMultiplier : 1);
  return { summary: heavy ? `Heavy · ${who}` : who, skips: false, heavy,
    detail: `${foe.name} intends ${heavy ? 'a Heavy Strike' : 'to strike'} on ${who} for ${damage} damage. It has ${foe.momentum} Momentum and banks ${gain} on its turn; at ${T.heavyStrikeCost} it spends them on a Heavy Strike (×${T.heavyStrikeMultiplier} damage).${extras}` };
}
