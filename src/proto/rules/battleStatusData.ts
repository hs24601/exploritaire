import statusEdits from '../../data/protoStatusOverrides.json';
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
  | 'swift-wings' | 'firelit' | 'cir-burning'
  | 'every-dog-has-her-day' | 'ember-rage' | 'duskscale' | 'deep-breath' | 'haste' | 'sap' | 'silence' | 'wild' | 'regen' | 'guard' | 'foresight' | 'rime'
  | 'dormant' | 'regrowth' | 'heavy-bark' | 'dry-bark' | 'stifling-sap'
  | 'slow' | 'chill' | 'frostbite' | 'frozen' | 'soaked' | 'burn' | 'bleed' | 'exposed' | 'blind' | 'stun' | 'grip' | 'weakened';

/** turns: remaining turns (see STATUS_META.expires); stacks: Chill/Bleed/Burn amount; Haste: receipts left. */
export type UnitStatus = { id: StatusId; turns?: number; stacks?: number };

export type StatusMeta = {
  /** Authored inspection copy; absent uses the contextual rules tooltip. */
  description?: string;
  blocksStagger?: boolean;
  name: string;
  glyph: string;
  /** Buffs help their owner; debuffs hurt it. Drives the icon styling. */
  kind: 'buff' | 'debuff';
  /** When `turns` counts down: at the end of each party turn, or at the end of each enemy turn. */
  expires?: 'party-turn' | 'enemy-turn';
};

export const STATUS_META: Record<StatusId, StatusMeta> = {
  'swift-wings': { name: 'Swift Wings', glyph: '🪽', kind: 'buff' },
  firelit: { name: 'Firelit', glyph: '☀', kind: 'debuff', expires: 'party-turn' },
  'cir-burning': { name: 'Burning', glyph: '🔥', kind: 'debuff', expires: 'enemy-turn' },
  'every-dog-has-her-day': { name: '4 Leaf Clover', glyph: '🍀', kind: 'buff' },
  'ember-rage': { name: EMBER_RAGE, glyph: '🌋', kind: 'buff' },
  duskscale: { blocksStagger: true, name: 'Duskscale Armor', glyph: '🐉', kind: 'buff' },
  'deep-breath': { blocksStagger: true, name: 'Deep Breath', glyph: '🌬️', kind: 'buff' },
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
  frostbite: { name: 'Frostbite', glyph: '❄', kind: 'debuff' },
  frozen: { name: 'Frozen', glyph: '🧊', kind: 'debuff' },
  soaked: { name: 'Soaked', glyph: '💧', kind: 'debuff', expires: 'enemy-turn' },
  burn: { name: 'Burning', glyph: '🔥', kind: 'debuff', expires: 'enemy-turn' },
  bleed: { name: 'Bleeding', glyph: '🩸', kind: 'debuff' },
  exposed: { name: 'Exposed', glyph: '🎯', kind: 'debuff', expires: 'enemy-turn' },
  blind: { name: 'Blinded', glyph: '🌫️', kind: 'debuff' },
  stun: { name: 'Stunned', glyph: '💫', kind: 'debuff' },
  grip: { name: 'Held', glyph: '🪢', kind: 'debuff' },
  // Banks' Hex cast (1006, 1012): its hits deal half damage, rounded up.
  weakened: { name: 'Weakened', glyph: '🪶', kind: 'debuff', expires: 'enemy-turn' },
};

for (const [id, edit] of Object.entries(statusEdits)) {
  if (id in STATUS_META) Object.assign(STATUS_META[id as StatusId], edit);
}

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
export const FOUNDATION_SUMMON_SLOT = 'new-foundation';
export type StatusSkill = {
  createsFoundation?: 'dem' | 'riv' | 'cir';
  actorId: 'hero' | 'mochi' | 'cir';
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
  'cir-emerge': { actorId: 'hero', group: 'support', name: 'Cir · Emerge', cost: 0, damage: 0, stagger: 0, glyph: '🪽', target: 'ally', card: 'At 3 pips: leave the host and become a Fire/Air foundation. Host loses Cir’s bonuses.', description: 'Choose Cir’s living host. Preserve Cir’s HP and Wings; no AP refill. First receipt must be Fire/Air at any rank.' },
  'summon-cir': { actorId: 'hero', group: 'support', name: 'Cir', cost: 1, damage: 0, stagger: 0, glyph: '🔥', target: 'ally',
    card: 'Enemy: 0 AP, 3 Fire damage; Cir unavailable for 3 turns. Ally: 1 AP, dormant familiar. Awakens at 3 pips: receipts +1, Fire/Air +2.',
    description: 'Enemy: 0 AP for 3 Fire damage, then all Cir expressions recover for three subsequent party-turn openings. Ally: 1 Hero AP to attach dormant Cir. Each host tableau receipt grants 1 pip, Fire/Air grants 2 total. At 3 pips, awaken permanently for this battle: Fire/Air affinity, remaining fiery shield and +1 Fire damage on Fire receipts. Release preserves HP, pips, Wings and shield; no healing or shield refill.' },
  'cir-burn': { actorId: 'cir', group: 'attack', name: 'Burn', cost: 1, damage: 3, stagger: 0, glyph: '🔥', target: 'foe', card: '3 Fire damage. 25% chance of Burning for 3 enemy turns.', description: 'Deal 3 base Fire damage. 25% chance of Burning: whenever this creature receives a Fire tableau card, it takes 1 Fire damage. Refreshes without stacking. Lasts 3 enemy turns.' },
  'cir-flare': { actorId: 'cir', group: 'attack', name: 'Flare', cost: 1, damage: 1, stagger: 0, glyph: '☀', target: 'foe', card: '1 Fire damage. Firelit: +10 percentage points crit chance and ×2 stagger from subsequent hits this turn.', description: 'Deal 1 base Fire damage, then apply Firelit until this party turn ends. Subsequent direct hits from all allies have +10 percentage points critical chance and double stagger buildup. Does not stack.' },
  'cir-windstorm': { actorId: 'cir', group: 'attack', name: 'Windstorm', cost: 1, damage: 0, stagger: 1, glyph: '💨', target: 'foe', spendsAll: true, card: 'All AP: (AP × 2 + every Air tableau card) × Wings Air multiplier to all enemies.', description: 'Spend all Cir AP (minimum 1). Base Air damage to every enemy equals twice AP spent plus all Air cards in the tableau, including buried cards. Multiply by Swift Wings stacks, minimum ×1. Stock and foundations do not count.' },
  'swift-wings': { actorId: 'cir', group: 'support', name: 'Swift Wings', cost: 1, damage: 0, stagger: 0, glyph: '🪽', target: 'self', card: 'Gain 1 Wing (max 4). Cost equals the new stack count. Each grants 15% evasion; Air damage × stacks (min ×1).', description: 'Next stack costs 1, 2, 3 or 4 AP. Maximum 4 stacks (60% evasion). Air receipts preserve Wings; at 3+ stacks Fire receipts also preserve them. Every other receipt removes one stack. No passive gain. Cir starts with one stack.' },
  'meteor-launch': { actorId: 'cir', group: 'attack', name: 'Meteor · Ascend', cost: 0, damage: 0, stagger: 0, glyph: '☄', target: 'self', card: 'Requires 4 Wings. Consume Wings and leave combat to charge Meteor for 3 turns.', description: 'At 4 Swift Wings, commit Cir to Meteor for 0 AP. Consume her Wings and replace her creature foundation with an untargetable ability foundation. It accepts no tableau cards, gains one pip each subsequent party turn, and readies after three turns. Cannot be recalled while charging.' },
  'meteor-impact': { actorId: 'cir', group: 'attack', name: 'Meteor', cost: 0, damage: 22, stagger: 0, glyph: '☄', target: 'foe', card: 'After 3 charging turns: 22 base Fire damage to all enemies. Exhaust Cir for this battle.', description: 'Drag the ready Meteor to any enemy. Deal 22 base Fire damage to every enemy and exhaust Cir for the rest of the battle.' },
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
  'summon-riv': { actorId: 'hero', createsFoundation: 'riv', group: 'support', name: 'Summon: Riv', cost: 1, damage: 0, stagger: 0, glyph: 'R', target: 'self',
    card: 'Create Riv’s foundation. Her first card can be any rank.',
    description: 'Spend 1 Hero AP and place Riv in the adjacent new-foundation slot. Her empty foundation accepts any starter card; after that she follows normal rank matching. Once per fight. Placeholder: no artwork.' },
  hold: { createsFoundation: 'dem', actorId: 'hero', group: 'support', name: 'Summon: Dem', cost: 6, damage: 0, stagger: 0, glyph: '🐻‍❄️', target: 'self',
    card: 'Summon Dem beside Hero with an Ace foundation. Once per fight.',
    description: 'Drag Dem to the adjacent new-foundation slot for 6 Hero AP. Dem starts at Ace and has their own foundation for tableau cards. Once per fight; no Hold slot is opened.' },
  wild: { actorId: 'mochi', group: 'support', name: 'Wild Card', cost: 1, damage: 0, stagger: 0, glyph: '🃏', target: 'ally',
    card: 'Ally: its next card can be any rank.',
    description: 'The next card played onto that foundation may be any rank, ignoring golf adjacency. Its value becomes the new foundation value.' },
} as const satisfies Record<string, StatusSkill>;
/** Authored name/owner/description edits (src/data/combatAbilityOverrides.json) apply as the data loads. */
export const STATUS_SKILLS = applyAbilityOverrides(BASE_STATUS_SKILLS);
export type StatusSkillId = keyof typeof STATUS_SKILLS;
export const isStatusSkill = (id: string): id is StatusSkillId => id in STATUS_SKILLS;

/** Foundation creators target a new slot; existing-foundation effects are reserved. */
export const foundationSummon = (id: string): 'dem' | 'riv' | 'cir' | undefined => {
  const skill = isStatusSkill(id) ? STATUS_SKILLS[id] : null;
  return skill && 'createsFoundation' in skill ? skill.createsFoundation : undefined;
};
