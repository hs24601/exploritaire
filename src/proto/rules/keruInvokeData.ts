// Keru invoke data: scenario 1005's placeholder buffs and the 1006–1010 rarity
// tiers. No imports, so battle.ts and cirCompanion.ts can read them without a cycle.

export const INVOKE_KERU = ['dem', 'cir', 'mochi', 'riv', 'banks'] as const;
export type InvokeKeruId = typeof INVOKE_KERU[number];

/** Persistent while invoked; removed when another Keru replaces it. Keru effects proper are not designed yet. */
export const INVOKE_BUFFS: Record<InvokeKeruId, { name: string; text: string }> = {
  dem: { name: 'Dem', text: '+4 max HP while invoked; heals 4 when invoked.' },
  cir: { name: 'Cir', text: '+1 damage on each chip hit.' },
  mochi: { name: 'Mochi', text: '+1 stagger on each chip hit.' },
  riv: { name: 'Riv', text: '+1 AP cap.' },
  banks: { name: 'Banks', text: 'Takes 2 less damage from each enemy hit.' },
};
export const INVOKE_MAX_HP = 4, INVOKE_CHIP_DAMAGE = 1, INVOKE_CHIP_STAGGER = 1, INVOKE_AP_CAP = 1, INVOKE_GUARD = 2;

/**
 * In-battle Keru rarity (scenarios 1006–1010). Feeding Hero AP into a Keru card
 * raises its tier for this battle only; nothing carries over and Restart resets it.
 * Tier index: 0 Common, 1 Rare, 2 Epic, 3 Legendary.
 */
export const RARITY_TIERS = ['common', 'rare', 'epic', 'legendary'] as const;
export type RarityTier = 0 | 1 | 2 | 3;
export const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary'] as const;
/** AP fed to reach the next tier: 1 to Rare, 2 more to Epic, 3 more to Legendary (6 in all). */
export const FEED_COSTS: readonly number[] = [1, 2, 3];
export const MAX_TIER: RarityTier = 3;

/**
 * Keru stacking (scenarios 1010–1011): each Keru on Hero uses load equal to its
 * rarity (Common 1 … Legendary 4) against her capacity of 6.
 */
export const LOAD_CAP = 6;
export const keruLoad = (tier: RarityTier) => tier + 1;
type Harness = Partial<Record<InvokeKeruId, RarityTier>>;
export const harnessLoad = (harness: Harness | undefined) => Object.values(harness ?? {}).reduce<number>((sum, tier) => sum + keruLoad(tier as RarityTier), 0);

/** Pair synergies, active while both Keru are on Hero. Pairs only; no set bonuses. */
export type SynergyId = 'feedback' | 'fortress' | 'shatter';
export const KERU_SYNERGIES: readonly { id: SynergyId; name: string; pair: readonly [InvokeKeruId, InvokeKeruId] }[] = [
  { id: 'feedback', name: 'Feedback', pair: ['riv', 'cir'] },
  { id: 'fortress', name: 'Fortress', pair: ['dem', 'banks'] },
  { id: 'shatter', name: 'Shatter', pair: ['mochi', 'cir'] },
];
/** Fortress's Ward while Dem is below Legendary absorbs up to this much of one hit. */
export const FORTRESS_WARD = 10;
/** Shatter: a stagger break deals this much bonus damage per Mochi tier number (Common 1 … Legendary 4). */
export const SHATTER_PER_TIER = 5;
/** Parked with 1011: no synergies in 1010's engine kit or 1012's upkeep kit (1006–1009 hold one Keru). */
export const activeSynergies = (harness: Harness | undefined, kit?: KeruKit) => kit === 'upkeep' || kit === 'engine' ? [] : KERU_SYNERGIES.filter(synergy => harness && synergy.pair.every(keru => keru in harness));
/** The Ward Fortress keeps on Hero (no cap: it absorbs the whole hit), or null without the pair. */
export const fortressWard = (harness: Harness | undefined, kit?: KeruKit): { cap?: number } | null =>
  kit !== 'upkeep' && kit !== 'engine' && harness && 'dem' in harness && 'banks' in harness ? (harness.dem === 3 ? {} : { cap: FORTRESS_WARD }) : null;
export function synergyText(id: SynergyId, harness?: Harness): string {
  switch (id) {
    case 'feedback': return 'Feedback (Riv + Cir): each AP Riv generates also adds +1 chip damage to Hero’s next hit.';
    case 'fortress': return harness?.dem === 3 ? 'Fortress (Dem + Banks): Legendary Dem’s Ward refreshes as each party turn opens, absorbing one whole enemy hit per turn.'
      : `Fortress (Dem + Banks): a 1-hit Ward absorbs up to ${FORTRESS_WARD} damage and refreshes as each party turn opens. With a Legendary Dem it absorbs the whole hit.`;
    case 'shatter': return `Shatter (Mochi + Cir): a stagger break deals ${SHATTER_PER_TIER} × Mochi’s tier number in bonus damage (${SHATTER_PER_TIER * ((harness?.mochi ?? 0) + 1)} now; Common 1 … Legendary 4).`;
  }
}

/** 'upkeep': 1012 Keru Upkeep (rarity buffs, but Banks and Riv are a bigger AP engine and every Keru costs upkeep). */
/** 'rarity': the 1006–1009 combat buffs. 'engine': 1010's AP engine kit (Riv, Banks and Cir change; Dem and Mochi keep their rarity buffs). */
export type KeruKit = 'rarity' | 'engine' | 'upkeep';

/** Everything the Keru on Hero add up to. Read from the actor alone so apCap and damage absorption need no state. */
export type KeruMods = {
  maxHp: number; chipDamage: number; chipFire: number; chipStagger: number; apCap: number;
  /** Flat damage removed from each enemy hit, after `halve`. */
  guard: number; halve: boolean; reflect: number;
  /** Chip hits per bonus AP (0 = none). */
  rivEvery: number; ignoreArmor: boolean; apMultiplier: number; pourRefund: boolean;
  /** Synergies: Riv's generated AP also queues chip damage (Feedback); a stagger break deals bonus damage (Shatter). */
  feedback: boolean; shatter: number;
  /** 1012 Legendary Riv: +1 AP whenever Hero breaks stagger. */
  rivStaggerAP: number;
};
const NONE: KeruMods = { maxHp: 0, chipDamage: 0, chipFire: 0, chipStagger: 0, apCap: 0, guard: 0, halve: false, reflect: 0, rivEvery: 0, ignoreArmor: false, apMultiplier: 1, pourRefund: false, feedback: false, shatter: 0, rivStaggerAP: 0 };

/** Tiered values, Common → Legendary. Legendary keeps Epic's number and adds its own effect. Placeholder tuning. */
export const RARITY_VALUES = {
  dem: [4, 8, 12, 12], banks: [2, 4, 8, 8], cir: [1, 2, 3, 3], mochi: [1, 2, 3, 3], riv: [4, 3, 2, 2],
  engineRiv: [4, 3, 2, 1], engineBanks: [2, 4, 6, 8], engineCir: [1, 1, 2, 2],
  upkeepBanks: [3, 6, 9, 12], upkeepRiv: [3, 2, 1, 1],
} as const;
/** Banks Legendary reflects this share of the damage it prevents. */
export const BANKS_REFLECT = 0.25;

type KeruCarrier = { invokedKeru?: InvokeKeruId; harness?: Partial<Record<InvokeKeruId, RarityTier>>; keruKit?: KeruKit;
  /** 1012 Banks farewell: enemy turns left with incoming damage halved. */
  farewellHalve?: number };

export function keruMods(actor: KeruCarrier): KeruMods {
  const mods = { ...NONE };
  if (!actor.harness) {
    // Scenario 1005's untiered placeholder buffs.
    switch (actor.invokedKeru) {
      case 'dem': mods.maxHp = INVOKE_MAX_HP; break;
      case 'cir': mods.chipDamage = INVOKE_CHIP_DAMAGE; break;
      case 'mochi': mods.chipStagger = INVOKE_CHIP_STAGGER; break;
      case 'riv': mods.apCap = INVOKE_AP_CAP; break;
      case 'banks': mods.guard = INVOKE_GUARD; break;
    }
    return mods;
  }
  const engine = actor.keruKit === 'engine';
  for (const [keru, tier] of Object.entries(actor.harness) as [InvokeKeruId, RarityTier][]) {
    const legendary = tier === 3, V = RARITY_VALUES;
    if (keru === 'dem') mods.maxHp += V.dem[tier];
    if (keru === 'mochi') { mods.chipStagger += V.mochi[tier]; if (legendary) mods.ignoreArmor = true; }
    if (actor.keruKit === 'upkeep' && (keru === 'banks' || keru === 'riv')) {
      if (keru === 'banks') mods.apCap += V.upkeepBanks[tier];
      if (keru === 'riv') { mods.rivEvery = V.upkeepRiv[tier]; if (legendary) mods.rivStaggerAP = 1; }
    } else if (engine) {
      if (keru === 'riv') mods.rivEvery = V.engineRiv[tier];
      if (keru === 'banks') mods.apCap += V.engineBanks[tier];
      if (keru === 'cir') { mods.apMultiplier = V.engineCir[tier]; if (legendary) mods.pourRefund = true; }
    } else {
      if (keru === 'banks') { mods.guard += V.banks[tier]; if (legendary) { mods.halve = true; mods.reflect = BANKS_REFLECT; } }
      if (keru === 'cir') { mods.chipDamage += V.cir[tier]; if (legendary) mods.chipFire += 1; }
      if (keru === 'riv') { mods.rivEvery = V.riv[tier]; if (legendary) mods.apCap += 1; }
    }
  }
  for (const synergy of activeSynergies(actor.harness, actor.keruKit)) {
    if (synergy.id === 'feedback') mods.feedback = true;
    if (synergy.id === 'shatter') mods.shatter = SHATTER_PER_TIER * ((actor.harness.mochi ?? 0) + 1);
  }
  return mods;
}

/** Damage a Keru-buffed actor takes from a raw enemy hit (before temporary HP). */
export const guardedDamage = (actor: KeruCarrier, raw: number) => {
  const mods = keruMods(actor);
  return Math.max(0, (mods.halve || (actor.farewellHalve ?? 0) > 0 ? Math.ceil(raw / 2) : raw) - mods.guard);
};

/** Buff copy for a Keru at a tier in a kit. */
export function rarityBuffText(keru: InvokeKeruId, tier: RarityTier, kit: KeruKit = 'rarity'): string {
  const V = RARITY_VALUES, legendary = tier === 3;
  if (kit === 'upkeep') {
    if (keru === 'riv') return `Generator: +1 AP every ${V.upkeepRiv[tier]} chip hit${V.upkeepRiv[tier] === 1 ? '' : 's'}.${legendary ? ' +1 AP whenever Hero breaks stagger.' : ''}`;
    if (keru === 'banks') return `Capacitor: +${V.upkeepBanks[tier]} AP cap.`;
  }
  if (kit === 'engine') {
    if (keru === 'riv') return `Generator: +1 AP every ${V.engineRiv[tier]} chip hit${V.engineRiv[tier] === 1 ? '' : 's'}.`;
    if (keru === 'banks') return `Capacitor: +${V.engineBanks[tier]} AP cap.`;
    if (keru === 'cir') return `Multiplier: ×${V.engineCir[tier]} AP from each card received.${legendary ? ' Refunds 1 AP for every 4 poured into a seal.' : ''}`;
  }
  switch (keru) {
    case 'dem': return `+${V.dem[tier]} max HP; heals ${V.dem[tier]} when invoked.${legendary ? ' Ward: the next enemy hit is fully absorbed (once per battle).' : ''}`;
    case 'banks': return `${legendary ? 'Halves each enemy hit, then takes' : 'Takes'} ${V.banks[tier]} less.${legendary ? ` Reflects ${BANKS_REFLECT * 100}% of the prevented damage.` : ''}`;
    case 'cir': return `+${V.cir[tier]} damage on each chip hit.${legendary ? ' Each chip hit also burns for 1 fire damage.' : ''}`;
    case 'mochi': return `+${V.mochi[tier]} stagger on each chip hit.${legendary ? ' Hero’s stagger ignores Duskscale Armor and Deep Breath.' : ''}`;
    case 'riv': return `+1 AP every ${V.riv[tier]} chip hits.${legendary ? ' +1 AP cap.' : ''}`;
  }
  return '';
}

/** 1012 upkeep: each Keru on Hero costs its tier number (Common 1 … Legendary 4) at the end of each party turn. */
export const keruUpkeep = (tier: RarityTier) => tier + 1;
/** Farewell durations (enemy turns) for Dem's Ward and Banks' halving. */
export const FAREWELL_TURNS = 2;
/** What a Keru does as it leaves Hero in 1012, intentionally or starved (the reverse of a warcry). n is its tier number. */
export function farewellText(keru: InvokeKeruId, tier: RarityTier): string {
  const n = tier + 1;
  switch (keru) {
    case 'dem': return `Farewell: heals ${3 * n} and leaves a Ward that absorbs the next enemy hit (${FAREWELL_TURNS} enemy turns).`;
    case 'banks': return `Farewell: incoming damage is halved for ${FAREWELL_TURNS} enemy turns.`;
    case 'cir': return `Farewell: a fire bolt for ${4 * n} damage to the enemy.`;
    case 'mochi': return `Farewell: ${2 * n} stagger to the enemy${tier === 3 ? ', through Duskscale Armor and Deep Breath' : ''}.`;
    case 'riv': return `Farewell: refunds ${n + 1} AP at once.`;
  }
}

/**
 * Immediate casts (1006 and 1012): each Keru has one cast, scaled by its tier
 * number n (Common 1 … Legendary 4). It costs no AP: casting exhausts the Keru
 * for the rest of the battle instead. Riv and Dem target an ally, the rest an enemy.
 */
export const KERU_CASTS: Record<InvokeKeruId, { name: string; target: 'ally' | 'enemy' }> = {
  riv: { name: 'Surge', target: 'ally' }, dem: { name: 'Mend', target: 'ally' },
  cir: { name: 'Flare', target: 'enemy' }, mochi: { name: 'Pounce', target: 'enemy' }, banks: { name: 'Hex', target: 'enemy' },
};
/** Per tier number: Surge 2n AP, Mend 6n HP, Flare 6n fire, Pounce 3n stagger, Hex n enemy turns Weakened. */
export const CAST_PER_TIER: Record<InvokeKeruId, number> = { riv: 2, dem: 6, cir: 6, mochi: 3, banks: 1 };
export const castAmount = (keru: InvokeKeruId, tier: RarityTier) => CAST_PER_TIER[keru] * (tier + 1);
/** What a cast does at a tier, for the gem tooltip, jumbo and 1012's ladder. */
export function castText(keru: InvokeKeruId, tier: RarityTier): string {
  const amount = castAmount(keru, tier), name = KERU_CASTS[keru].name;
  switch (keru) {
    case 'riv': return `${name}: target ally gains ${amount} AP at once (up to their cap).`;
    case 'dem': return `${name}: heal target ally ${amount}.`;
    case 'cir': return `${name}: ${amount} fire damage to target enemy.`;
    case 'mochi': return `${name}: ${amount} stagger to target enemy${tier === 3 ? ', through Duskscale Armor and Deep Breath' : ''}.`;
    case 'banks': return `${name}: target enemy is Weakened for ${amount} enemy turn${amount === 1 ? '' : 's'} (its hits deal half damage).`;
  }
}
/** The short amount shown on a hovered cast target, such as "+12 HP". */
export function castPreview(keru: InvokeKeruId, tier: RarityTier): string {
  const amount = castAmount(keru, tier);
  switch (keru) {
    case 'riv': return `+${amount} AP`;
    case 'dem': return `+${amount} HP`;
    case 'cir': return `${amount} fire`;
    case 'mochi': return `+${amount} stagger`;
    case 'banks': return `Weakened ${amount} turn${amount === 1 ? '' : 's'}`;
  }
}
