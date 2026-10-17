// Combat abilities and spirits as data. Pure: no React or DOM.
//
// Foundation cards bank AP. Hero chooses fixed-cost moves; Mochi's existing
// charge curves remain available to simulations, with explicit tier selection
// spending only that tier's cost. MAX_CHARGE bounds Mochi's legacy curve, not AP.
export const MAX_CHARGE = 10;
/** Combat loadouts never grow beyond four selected abilities per actor. */
export const COMBAT_ABILITY_SLOTS = 4;

export type AbilityEffect = { kind: 'burn' | 'bleed' | 'stun' | 'grip' | 'exposed'; chance?: number; gripBudget?: number; dps: number; seconds: number };

export type AbilityTier = {
  name: string;
  /** Lowest charge this form appears at. */
  from: number;
  /** One-line flavour of what this form adds, for the card face. */
  note?: string;
  /** Flat stagger added on top of the charge-based stagger. */
  staggerBonus: number;
  /** Extra share of the target's attack timer knocked back (0-1). */
  knockback: number;
  effect?: AbilityEffect;
};

export type AbilityDef = {
  actorId: string;
  /** Multiplies comboPower(charge) to give damage. */
  damageScale: number;
  /** Stagger per point of charge. */
  staggerScale: number;
  /** How the attack looks when played: a lunging bite or a raking scratch. Presentation only. */
  motion: 'bite' | 'scratch';
  tiers: readonly AbilityTier[];
};

export const ABILITIES: Record<string, AbilityDef> = {
  banks: { actorId:'banks', damageScale:4, staggerScale:3, motion:'scratch', tiers:[{name:'Scratch',from:2,staggerBonus:4,knockback:.15},{name:'Bite',from:4,staggerBonus:8,knockback:.3}] },
  // Hero tier names remain animation profiles; HERO_MOVES defines gameplay.
  hero: {
    actorId: 'hero',
    damageScale: 1,
    staggerScale: 1,
    motion: 'bite',
    tiers: [
      { name: 'Nip', from: 1, staggerBonus: 0, knockback: 0 },
      { name: 'Bite', from: 4, staggerBonus: 1, knockback: 0.05 },
      { name: 'Takedown', from: 7, note: 'Knockdown', staggerBonus: 4, knockback: 0.25 },
    ],
  },
  // Mochi breaks guard: half damage, half again the stagger.
  mochi: {
    actorId: 'mochi',
    damageScale: 0.5,
    staggerScale: 1.5,
    motion: 'scratch',
    tiers: [
      { name: 'Scratch', from: 1, staggerBonus: 0, knockback: 0 },
      { name: 'Claw', from: 4, staggerBonus: 1, knockback: 0.05 },
      { name: 'Lacerate', from: 7, note: 'Bleed', staggerBonus: 2, knockback: 0.1, effect: { kind: 'bleed', dps: 1, seconds: 4 } },
    ],
  },
};

export type SpiritDef = {
  id: string;
  name: string;
  /** Icon for chips. */
  glyph: string;
  /** What the spirit does, for tooltips. */
  blurb: string;
  /** Element spirits join the attack; rule spirits (no element) only bend play. */
  element?: 'fire';
  /** Lowest charge the spirit joins in at ("combo > 3" is 4). */
  from: number;
  /** Prefix it gives the ability's name. */
  prefix: string;
  damageMul: number;
  effect?: AbilityEffect;
  /** Hook for spirits that loosen legal play (e.g. allow a gap of 2). Checked alongside golf adjacency. */
  playRule?: PlayRule;
  /** A fixed foundation value the spirit offers when its actor redraws (rules/redraw.ts), instead of a random one. */
  redrawRank?: number;
};

/** Whether a card can go onto a foundation showing `foundationRank`. */
export type PlayRule = (cardRank: number, foundationRank: number) => boolean;

export const SPIRITS: Record<string, SpiritDef> = {
  cal: { id: 'cal', name: 'Cal', glyph: '🔥', blurb: 'Fire spirit: above combo 3 the ability gains fire (Inferno), ×1.5 damage and a burn', element: 'fire', from: 4, prefix: 'Inferno', damageMul: 1.5, effect: { kind: 'burn', dps: 1, seconds: 3 } },
  // Rule spirits bend golf adjacency so the party can climb out of bad deals.
  wisp: { id: 'wisp', name: 'Wisp', glyph: '✧', blurb: 'Leaping spirit: cards two ranks away also play (A and K wrap)', from: 0, prefix: '', damageMul: 1, playRule: (card, foundation) => rankGap(card, foundation) === 2 },
  moss: { id: 'moss', name: 'Moss', glyph: '❦', blurb: 'Patient spirit: a card of the same rank also plays', from: 0, prefix: '', damageMul: 1, playRule: (card, foundation) => card === foundation },
};

/** Distance between ranks around the A-K loop. */
export const rankGap = (a: number, b: number) => { const d = Math.abs(a - b) % 13; return Math.min(d, 13 - d); };

/** Damage before scaling: grows faster than the card count so long combos pay. 1, 2, 3, 5, 7, 9, 11, 14, 17, 20. */
export const comboPower = (charge: number) => {
  const n = Math.max(0, Math.min(MAX_CHARGE, Math.floor(charge)));
  return n + Math.floor((n * n) / 10);
};

/** Share of the target's attack timer each point of stagger knocks back. */
export const KNOCKBACK_PER_STAGGER = 0.03;

export type Attack = {
  actorId: string;
  /** Full name with any spirit prefix, e.g. "Inferno Bite". */
  name: string;
  /** The base form, e.g. "Bite". */
  form: string;
  tier: number;
  charge: number;
  damage: number;
  stagger: number;
  /** Share of the target's attack timer knocked back (0-1). */
  knockback: number;
  element: SpiritDef['element'] | null;
  effects: AbilityEffect[];
  /** Tags for the card face: "Knockdown", "Fire", "Bleed". */
  tags: string[];
};

export const tierFor = (def: AbilityDef, charge: number) => {
  let index = 0;
  def.tiers.slice(0, COMBAT_ABILITY_SLOTS).forEach((tier, i) => { if (charge >= tier.from) index = i; });
  return index;
};

/** Resolve a chosen move, or the default move used by older simulations. */
export const attackFor = (actorId: string, charge: number, spiritIds: readonly string[] = [], choice?: string): Attack | null => {
  if (actorId === 'banks') {
    const move = BANKS_MOVES.find(m => m.name === (choice ?? 'Bite'));
    if (!move || charge < move.cost) return null;
    return {actorId,name:move.name,form:move.name,tier:move.name==='Bite'?1:0,charge:move.cost,damage:move.damage,stagger:move.name==='Scratch'?10:18,knockback:.3,element:null,effects:[],tags:[]};
  }
  if (actorId === "hero") return heroAttack(charge, choice, spiritIds);
  const def = ABILITIES[actorId];
  const selected = choice ? def?.tiers.slice(0, COMBAT_ABILITY_SLOTS).findIndex(t => t.name === choice) : undefined;
  if (choice && (selected === undefined || selected < 0)) return null;
  const cost = selected !== undefined ? def.tiers[selected].from : Math.min(MAX_CHARGE, Math.floor(charge));
  const n = cost;
  if (!def || n < 1 || charge < cost) return null;
  const tierIndex = selected ?? tierFor(def, n);
  const tier = def.tiers[tierIndex];
  const spirits = spiritIds.map((id) => SPIRITS[id]).filter((spirit): spirit is SpiritDef => Boolean(spirit?.element) && n >= spirit.from);
  const damageMul = spirits.reduce((mul, spirit) => mul * spirit.damageMul, 1);
  const stagger = n * def.staggerScale + tier.staggerBonus;
  const effects = [tier.effect, ...spirits.map((spirit) => spirit.effect)].filter((effect): effect is AbilityEffect => Boolean(effect));
  return {
    actorId,
    name: [...spirits.map((spirit) => spirit.prefix), tier.name].join(' '),
    form: tier.name,
    tier: tierIndex,
    charge: n,
    damage: Math.max(1, Math.round(comboPower(n) * def.damageScale * damageMul)),
    stagger,
    knockback: Math.min(1, stagger * KNOCKBACK_PER_STAGGER + tier.knockback),
    element: spirits[0]?.element ?? null,
    effects,
    tags: [...(tier.note ? [tier.note] : []), ...spirits.map(() => 'Fire')],
  };
};

/** The charge at which this actor's ability next changes form, for "next: Bite at 4". */
export const nextBreakpoint = (actorId: string, charge: number, spiritIds: readonly string[] = []) => {
  const def = ABILITIES[actorId];
  if (!def) return null;
  const points = [
    ...def.tiers.map((tier) => ({ at: tier.from, label: tier.name })),
    ...spiritIds.flatMap((id) => SPIRITS[id]?.element ? [{ at: SPIRITS[id].from, label: SPIRITS[id].name }] : []),
  ].filter((point) => point.at > charge).sort((a, b) => a.at - b.at);
  return points[0] ?? null;
};

export const MOCHI_MOVES = [
 {name:'Scratch',cost:1,description:'1 damage; 1.5 stagger.'},
 {name:'Claw',cost:4,description:'3 damage; 7 stagger and timer knockback.'},
 {name:'Lacerate',cost:7,description:'6 damage; 12.5 stagger and bleeding (1/s, 4s).'},
] as const;
export const HERO_MOVES = [
 {name:'Nip',cost:1,damage:1,description:'1 damage (+1 vs bleeding).'},
 {name:'Bite',cost:3,damage:2,description:'2 damage; 25% bleed chance. Exposed for 6s: direct hits from any source gain +10% bleed chance.'},
 {name:'Takedown',cost:3,damage:3,description:'3 damage + 2s stun; interrupts the current action.'},
 {name:'Vice Grip',cost:3,damage:1,description:'Sustained hold: 1 damage; 3s/AP. After 6s, each extra 3s contributes half as much as the previous. Other abilities release.'},
] as const;
function heroAttack(bank: number, choice = 'Nip', spirits: readonly string[] = []): Attack | null {
  const move = HERO_MOVES.slice(0, COMBAT_ABILITY_SLOTS).find(m => m.name === choice);
  if (!move || !Number.isFinite(bank) || bank < move.cost) return null;
  const committed = move.name === 'Vice Grip' ? Math.floor(bank) : move.cost;
  const effects: AbilityEffect[] = [];
  if (move.name === 'Bite') effects.push({ kind: 'bleed', dps: 1, seconds: 4, chance: 0.25 }, {kind:'exposed',dps:0,seconds:6});
  if (move.name === 'Takedown') effects.push({ kind: 'stun', dps: 0, seconds: 2 });
  if (move.name === 'Vice Grip') effects.push({ kind: 'grip', dps: 0, seconds: gripDuration(committed * 3), gripBudget: committed * 3 });
  const fire = spirits.includes('cal') && bank >= SPIRITS.cal.from;
  if (fire) effects.push(SPIRITS.cal.effect!);
  return {
    actorId: 'hero', name: fire ? 'Inferno ' + move.name : move.name,
    form: move.name, tier: HERO_MOVES.indexOf(move), charge: committed,
    damage: fire ? Math.round(move.damage * SPIRITS.cal.damageMul) : move.damage,
    stagger: 0, knockback: 0, element: fire ? 'fire' : null, effects, tags: [],
  };
}

/** First six seconds are full value; successive three-second blocks give 1.5, .75, .375... seconds. */
export function gripDuration(budget: number): number {
  if (budget <= 6) return Math.max(0,budget);
  const extra = budget - 6, blocks = Math.floor(extra / 3), remainder = extra % 3;
  return 6 + 3 * (1 - Math.pow(.5,blocks)) + remainder * Math.pow(.5,blocks+1);
}

/** Selected combat moves, distinct from any future learned-ability catalogue. */
/** Visiting mentor tuning; Hunt and Stealth remain unauthored. */
export const BANKS_MOVES = [{name:'Scratch',cost:2,damage:10,description:'10 damage and a heavy stagger.'},{name:'Bite',cost:4,damage:28,description:'28 damage; a decisive finishing bite.'}] as const;
export const combatMovesFor = (actorId: string) => (actorId === 'hero' ? HERO_MOVES : actorId === 'mochi' ? MOCHI_MOVES : actorId === 'banks' ? BANKS_MOVES : []).slice(0, COMBAT_ABILITY_SLOTS);

export type ActorMove = {name:string;cost:number;description:string;retrieval?:boolean;terrainTags?:readonly string[]};
export const HERO_RETRIEVAL_MOVES: readonly ActorMove[] = [
{name:'Fetch',cost:2,description:"Retrieve any card from the tableau's top row onto your foundation, regardless of rank.",retrieval:true},
{name:'Dig',cost:1,description:'Retrieve any tableau card onto your foundation. Costs 1 AP for the top row, 2 for the second row, and so on. Breach #buried terrain for its displayed AP cost to reveal the crossing.',retrieval:true,terrainTags:['buried']}];
export const availableMovesFor=(id:string):readonly ActorMove[]=>[...combatMovesFor(id),...(id==='hero'?HERO_RETRIEVAL_MOVES:[])];
