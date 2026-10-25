import { applyAbilityOverrides } from './abilityOverrides';

// Tutorial statuses and ability cards as data. Pure and free of battle.ts so the
// battle rules can spread these skills into MOMENTUM_SKILLS without a cycle.
// Ability cards cost their owner's AP; shared Momentum only pays for Withdraw
// (and interrupting an enemy Withdraw).
//
// The combat sandbox is turn-based, so the draft's real-time timers are
// expressed in its own pacing currencies: durations count party or enemy
// turns or tableau receipts, and speed is Momentum. Each enemy now banks its
// own Momentum per enemy turn and spends it on a Heavy Strike; Haste doubles
// and Slow halves (rounded down) the Momentum a unit gains, on either side.

/** Display name of Hero's chain-rage ability and status; rename here only. */
export const EMBER_RAGE = 'Ember Rage';

export type StatusId =
  | 'insight' | 'ember-rage' | 'haste' | 'sap' | 'silence' | 'wild' | 'regen' | 'guard' | 'foresight' | 'rime'
  | 'dormant' | 'regrowth' | 'heavy-bark' | 'dry-bark' | 'stifling-sap'
  | 'slow' | 'chill' | 'frozen' | 'soaked' | 'burn' | 'bleed' | 'exposed' | 'blind' | 'stun' | 'grip';

/** turns: remaining turns (see STATUS_META.expires); stacks: Chill/Bleed/Burn amount; Haste: receipts left. */
export type UnitStatus = { id: StatusId; turns?: number; stacks?: number };

export type StatusMeta = {
  name: string;
  glyph: string;
  /** Buffs help their owner; debuffs hurt it. Drives the icon styling. */
  kind: 'buff' | 'debuff';
  /** When `turns` counts down: at the end of each party turn, or at the end of each enemy turn. */
  expires?: 'party-turn' | 'enemy-turn';
};

export const STATUS_META: Record<StatusId, StatusMeta> = {
  insight: { name: 'Insight', glyph: '💡', kind: 'buff' },
  'ember-rage': { name: EMBER_RAGE, glyph: '🌋', kind: 'buff' },
  haste: { name: 'Haste', glyph: '⚡', kind: 'buff', expires: 'enemy-turn' },
  sap: { name: 'Sapped', glyph: '🍯', kind: 'debuff', expires: 'party-turn' },
  silence: { name: 'Silenced', glyph: '🤐', kind: 'debuff', expires: 'party-turn' },
  wild: { name: 'Wild', glyph: '🃏', kind: 'buff' },
  regen: { name: 'Second Wind', glyph: '🌱', kind: 'buff', expires: 'party-turn' },
  guard: { name: 'Guard', glyph: '🛡️', kind: 'buff' },
  foresight: { name: 'Foresight', glyph: '🔮', kind: 'buff', expires: 'party-turn' },
  rime: { name: 'Rime', glyph: '🌨️', kind: 'buff' },
  // Enemy dispositions (permanent unless noted): reusable foe data flags.
  dormant: { name: 'Dormant', glyph: '☾', kind: 'buff' },
  regrowth: { name: 'Regrowth', glyph: '🌿', kind: 'buff' },
  'heavy-bark': { name: 'Heavy Bark', glyph: '🪵', kind: 'buff' },
  'dry-bark': { name: 'Dry Bark', glyph: '🍂', kind: 'debuff' },
  'stifling-sap': { name: 'Stifling Sap', glyph: '🍯', kind: 'buff' },
  slow: { name: 'Slowed', glyph: '🐌', kind: 'debuff', expires: 'enemy-turn' },
  chill: { name: 'Chill', glyph: '❄️', kind: 'debuff' },
  frozen: { name: 'Frozen', glyph: '🧊', kind: 'debuff' },
  soaked: { name: 'Soaked', glyph: '💧', kind: 'debuff', expires: 'enemy-turn' },
  burn: { name: 'Burning', glyph: '🔥', kind: 'debuff', expires: 'enemy-turn' },
  bleed: { name: 'Bleeding', glyph: '🩸', kind: 'debuff' },
  exposed: { name: 'Exposed', glyph: '🎯', kind: 'debuff', expires: 'enemy-turn' },
  blind: { name: 'Blinded', glyph: '🌫️', kind: 'debuff' },
  stun: { name: 'Stunned', glyph: '💫', kind: 'debuff' },
  grip: { name: 'Held', glyph: '🪢', kind: 'debuff' },
};

/** Tuning shared by rules, card copy and tooltips. */
export const STATUS_TUNING = {
  /** Haste: the next receipts on that foundation earn double AP and double Momentum. */
  hasteCards: 4,
  /** Enemy Momentum: earned per enemy turn, spent on a Heavy Strike that multiplies its damage. */
  enemyMomentumGain: 2,
  heavyStrikeCost: 4,
  heavyStrikeMultiplier: 2,
  chillToFreeze: 3,
  burnDamage: 2,
  burnTurns: 2,
  blindMiss: 0.5,
  lacerateBleed: 4,
  biteBleed: 1,
  shockDamage: 2,
  foresightCards: 6,
  /** Vice Grip: AP committed per enemy turn held. */
  gripPerTurn: 2,
} as const;

/** Ability cards belong to one Kin and cost that Kin's AP (banked by cards its foundation receives). */
export type StatusSkill = {
  actorId: 'hero' | 'mochi';
  name: string;
  cost: number;
  damage: number;
  stagger: number;
  /** Full rules text for inspection. */
  description: string;
  /** Short card-face effect. */
  card: string;
  glyph: string;
  /** Who the card is dropped on; 'card' targets a tableau card (`card:<id>`). */
  target: 'foe' | 'ally' | 'self' | 'card';
  /** Hand page in the Kin's radial. */
  group: 'attack' | 'support';
  /** Vice Grip commits every whole AP its owner holds (cost is the minimum). */
  spendsAll?: boolean;
};

const T = STATUS_TUNING;
const BASE_STATUS_SKILLS = {
  bite: { actorId: 'hero', group: 'attack', name: 'Bite', cost: 2, damage: 1, stagger: 0, glyph: '🎯', target: 'foe',
    card: `1 damage, +${T.biteBleed} Bleed. Exposed: tableau hits add Bleed.`,
    description: `Hero deals 1 damage and adds ${T.biteBleed} Bleed. The target is Exposed for 2 enemy turns: every tableau hit on it adds 1 more Bleed.` },
  takedown: { actorId: 'hero', group: 'attack', name: 'Takedown', cost: 3, damage: 2, stagger: 0, glyph: '💫', target: 'foe',
    card: '2 damage and Stun: it skips its next turn. Shatters Frozen foes.',
    description: 'Hero deals 2 damage and Stuns the target: it skips its next enemy turn. On a Frozen foe this is a Shatter: double damage and a full stagger gauge.' },
  'focus-fire': { actorId: 'hero', group: 'attack', name: 'Focus Fire', cost: 2, damage: 0, stagger: 0, glyph: '🎇', target: 'card',
    card: 'Pick a tableau card: every card of that rank burns. 1 fire to every foe per card.',
    description: 'Hero picks any tableau card: every card of that rank, buried or exposed, burns away and the columns refill from the stock. Each burned card deals 1 fire damage to every foe. Burned cards are not receipts: no chip hits, AP or Momentum.' },
  'vice-grip': { actorId: 'hero', group: 'attack', name: 'Vice Grip', cost: 2, damage: 0, stagger: 0, glyph: '🪢', target: 'foe', spendsAll: true,
    card: `Commit all Hero AP: held 1 enemy turn per ${T.gripPerTurn} AP.`,
    description: `Hero commits every whole AP she holds (minimum 2). The target is held for 1 enemy turn per ${T.gripPerTurn} AP committed: it cannot strike or bank Momentum. Hero's other abilities release the hold.` },
  'frost-fang': { actorId: 'hero', group: 'attack', name: 'Frost Fang', cost: 2, damage: 1, stagger: 0, glyph: '❄️', target: 'foe',
    card: `1 damage, +1 Chill. Rime: Hero's tableau hits add Chill this turn.`,
    description: `Hero deals 1 damage and adds 1 Chill, then gains Rime until the turn ends: each of Hero's tableau hits adds 1 Chill. Each Chill costs the foe 1 Momentum gain per enemy turn, delaying its Heavy Strike; ${T.chillToFreeze} Chill (or Chill on a Soaked foe) Freezes it.` },
  'thunder-bark': { actorId: 'hero', group: 'attack', name: 'Thunder Bark', cost: 2, damage: T.shockDamage, stagger: 0, glyph: '🌩️', target: 'foe',
    card: `${T.shockDamage} shock damage. Soaked: conducts to every Soaked foe.`,
    description: `Hero deals ${T.shockDamage} shock damage. If the target is Soaked, the shock Conducts: every other Soaked foe takes the same hit.` },
  'ember-rage': { actorId: 'hero', group: 'attack', name: EMBER_RAGE, cost: 0, damage: 0, stagger: 0, glyph: '🌋', target: 'self',
    card: 'Rage this turn: chip hits only, +1 fire per 3 AP. AP cap 12; over 6 burns off.',
    description: `Self-cast on Hero for 0 AP, once per turn. Until the turn ends Hero rages: she can’t use her other abilities, only chip hits, and each chip hit deals bonus fire equal to her AP ÷ 3, rounded down (counted after that card’s AP). Her AP cap rises from 6 to 12. Fire adds no stagger. When the turn ends ${EMBER_RAGE} fades and any AP above 6 burns off.` },
  guard: { actorId: 'hero', group: 'support', name: 'Guard', cost: 2, damage: 0, stagger: 0, glyph: '🛡️', target: 'ally',
    card: 'Ally: absorbs the next enemy hit and its effects.',
    description: 'Hero guards a Kin: the next enemy hit on it is absorbed completely, including any debuff the hit would inflict.' },
  regen: { actorId: 'hero', group: 'support', name: 'Second Wind', cost: 2, damage: 0, stagger: 0, glyph: '🌱', target: 'ally',
    card: 'Ally, 2 turns: each card it receives heals 1 HP.',
    description: 'For this turn and the next, each card that foundation receives heals its Kin 1 HP (up to maximum).' },
  foresight: { actorId: 'hero', group: 'support', name: 'Foresight', cost: 1, damage: 0, stagger: 0, glyph: '🔮', target: 'ally',
    card: `2 turns: inspect the buff to see the next ${T.foresightCards} refill cards.`,
    description: `For this turn and the next, inspect the Foresight buff to read the next ${T.foresightCards} cards that will refill the tableau, in order.` },
  lacerate: { actorId: 'mochi', group: 'attack', name: 'Lacerate', cost: 3, damage: 1, stagger: 0, glyph: '🩸', target: 'foe',
    card: `1 damage, +${T.lacerateBleed} Bleed. Each card played makes it bleed 1.`,
    description: `Mochi deals 1 damage and adds ${T.lacerateBleed} Bleed. Every card any Kin plays from the tableau makes a Bleeding foe lose 1 HP and 1 Bleed.` },
  'puddle-pounce': { actorId: 'mochi', group: 'attack', name: 'Puddle Pounce', cost: 1, damage: 0, stagger: 0, glyph: '💧', target: 'foe',
    card: 'Soak a foe for 2 turns. Frost freezes, fire steams, shock conducts.',
    description: 'Mochi splashes the target: Soaked for 2 enemy turns. Chill on a Soaked foe Freezes it at once; fire on it makes Steam (Blinded); shock on it Conducts to every other Soaked foe.' },
  'ember-swipe': { actorId: 'mochi', group: 'attack', name: 'Ember Swipe', cost: 2, damage: 1, stagger: 0, glyph: '🔥', target: 'foe',
    card: `1 fire damage + Burn ${T.burnDamage}/turn. Soaked: Blind. Bleeding: Cauterize.`,
    description: `Mochi deals 1 fire damage and sets Burn: ${T.burnDamage} damage at the start of each of the next ${T.burnTurns} enemy turns. Fire on a Soaked foe makes Steam instead: Blinded, no burn. Fire on a Bleeding foe Cauterizes: all remaining Bleed lands at once and the wound is sealed, so no burn.` },
  haste: { actorId: 'mochi', group: 'support', name: 'Haste', cost: 2, damage: 0, stagger: 0, glyph: '⚡', target: 'ally',
    card: `Ally, this turn: its next ${T.hasteCards} cards earn double AP and Momentum.`,
    description: `Mochi hastes a Kin: the next ${T.hasteCards} cards that foundation receives this turn earn 2 AP and 2 Momentum each instead of 1. Unused Haste ends with the turn.` },
  mire: { actorId: 'mochi', group: 'support', name: 'Mire', cost: 2, damage: 0, stagger: 0, glyph: '🐌', target: 'foe',
    card: 'Slow a foe for 2 turns: it gains half Momentum, so Heavy Strikes come later.',
    description: `Mochi mires a foe for 2 enemy turns: Slow mirrors Haste and halves all Momentum it gains, rounded down (${T.enemyMomentumGain} becomes ${Math.floor(T.enemyMomentumGain / 2)}), so it reaches its ${T.heavyStrikeCost}-Momentum Heavy Strike half as often.` },
  wild: { actorId: 'mochi', group: 'support', name: 'Wild Card', cost: 1, damage: 0, stagger: 0, glyph: '🃏', target: 'ally',
    card: 'Ally: its next card can be any rank.',
    description: 'The next card played onto that foundation may be any rank, ignoring golf adjacency. Its value becomes the new foundation value.' },
} as const satisfies Record<string, StatusSkill>;
/** Authored name/owner/description edits (src/data/combatAbilityOverrides.json) apply as the data loads. */
export const STATUS_SKILLS = applyAbilityOverrides(BASE_STATUS_SKILLS);
export type StatusSkillId = keyof typeof STATUS_SKILLS;
export const isStatusSkill = (id: string): id is StatusSkillId => id in STATUS_SKILLS;
