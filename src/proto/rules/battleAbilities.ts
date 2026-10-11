// Combat abilities and spirits as data. Pure: no React or DOM.
//
// Every party actor has one ability. Each card played onto the actor's
// foundation adds one charge (up to MAX_CHARGE); the ability's power and its
// form come from that charge. Forms upgrade in place at charge breakpoints
// (Nip > Bite > Takedown). Spirits that accompany an actor layer on top at
// their own breakpoint, adding an element (Cal: fire, so Bite > Inferno Bite).

export const MAX_CHARGE = 10;

export type AbilityEffect = { kind: 'burn' | 'bleed'; dps: number; seconds: number };

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
  tiers: readonly AbilityTier[];
};

export const ABILITIES: Record<string, AbilityDef> = {
  // Hero is the damage dealer: full combo damage, plain stagger.
  hero: {
    actorId: 'hero',
    damageScale: 1,
    staggerScale: 1,
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
  element: 'fire';
  /** Lowest charge the spirit joins in at ("combo > 3" is 4). */
  from: number;
  /** Prefix it gives the ability's name. */
  prefix: string;
  damageMul: number;
  effect?: AbilityEffect;
  /** Hook for spirits that loosen legal play (e.g. allow a gap of 2). Checked alongside golf adjacency. */
  playRule?: PlayRule;
};

/** Whether a card can go onto a foundation showing `foundationRank`. */
export type PlayRule = (cardRank: number, foundationRank: number) => boolean;

export const SPIRITS: Record<string, SpiritDef> = {
  cal: { id: 'cal', name: 'Cal', element: 'fire', from: 4, prefix: 'Inferno', damageMul: 1.5, effect: { kind: 'burn', dps: 1, seconds: 3 } },
};

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
  def.tiers.forEach((tier, i) => { if (charge >= tier.from) index = i; });
  return index;
};

/** The ability an actor would use right now, or null with no charge to spend. */
export const attackFor = (actorId: string, charge: number, spiritIds: readonly string[] = []): Attack | null => {
  const def = ABILITIES[actorId];
  const n = Math.min(MAX_CHARGE, Math.floor(charge));
  if (!def || n < 1) return null;
  const tierIndex = tierFor(def, n);
  const tier = def.tiers[tierIndex];
  const spirits = spiritIds.map((id) => SPIRITS[id]).filter((spirit): spirit is SpiritDef => Boolean(spirit) && n >= spirit.from);
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
    tags: [...(tier.note ? [tier.note] : []), ...spirits.map((spirit) => spirit.element === 'fire' ? 'Fire' : spirit.element)],
  };
};

/** The charge at which this actor's ability next changes form, for "next: Bite at 4". */
export const nextBreakpoint = (actorId: string, charge: number, spiritIds: readonly string[] = []) => {
  const def = ABILITIES[actorId];
  if (!def) return null;
  const points = [
    ...def.tiers.map((tier) => ({ at: tier.from, label: tier.name })),
    ...spiritIds.flatMap((id) => SPIRITS[id] ? [{ at: SPIRITS[id].from, label: SPIRITS[id].name }] : []),
  ].filter((point) => point.at > charge).sort((a, b) => a.at - b.at);
  return points[0] ?? null;
};
