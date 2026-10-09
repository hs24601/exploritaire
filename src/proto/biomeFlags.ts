/** What a biome's flags mean for play. A biome tile carries `flags`; this is
 * the one place that says what each does to travel and to opening its
 * tableau. A new flag is one entry in BIOME_FLAG_RULES. */

export type BiomeFlag = 'unexplored' | 'rough' | 'danger' | 'impassable';

type FlagRule = {
  /** Travel cost multiplier for crossing the tile, or 'blocked'. Arriving on
   * a tile is always allowed; this is about passing through it. */
  travel: number | 'blocked';
  /** Whether tapping the tile opens its tableau. */
  opensTableau: boolean;
  /** Short reason shown when the tile won't open. */
  closedReason?: string;
};

export const BIOME_FLAG_RULES: Record<BiomeFlag, FlagRule> = {
  // Concealed until actor discovery; paths and roads require entry.
  unexplored: { travel: 'blocked', opensTableau: false, closedReason: 'Unexplored. Move an actor here to discover it.' },
  // Hard going: crossing costs three times as much, so routes only cut
  // through when that's still faster.
  impassable: { travel: 'blocked', opensTableau: false, closedReason: 'Impassable mountain. Find a route around it.' },
  rough: { travel: 3, opensTableau: true },
  // A foe prowls there (the Dark Woods): no passing through while it's about;
  // going there starts the fight. Beaten for the day, the tile drops the flag.
  danger: { travel: 'blocked', opensTableau: true },
};

/** Cost multiplier for crossing a tile with these flags (Infinity: can't). */
export const biomeTravelCost = (flags: readonly BiomeFlag[] = []) =>
  flags.reduce((cost, flag) => {
    const travel = BIOME_FLAG_RULES[flag]?.travel ?? 1;
    return travel === 'blocked' ? Infinity : cost * travel;
  }, 1);

/** Whether tapping a tile with these flags opens its tableau, and if not, why. */
export const biomeOpenState = (flags: readonly BiomeFlag[] = []): { opens: boolean; reason?: string } => {
  const closed = flags.find((flag) => BIOME_FLAG_RULES[flag] && !BIOME_FLAG_RULES[flag].opensTableau);
  return closed ? { opens: false, reason: BIOME_FLAG_RULES[closed].closedReason } : { opens: true };
};

/** The share of a biome explored on an actor's first arrival. */
export const FIRST_LOOK = 0.1;

/** Expedition work, independent of map discovery. This legacy progress
 * metric no longer masks the biome's art; discovered terrain is fully visible. */
export const biomeExploration = (flags: readonly BiomeFlag[] = [], progress = 0) =>
  flags.includes('unexplored') ? 0 : Math.min(1, FIRST_LOOK + (1 - FIRST_LOOK) * Math.max(0, Math.min(1, progress)));

/** Share of a dealt tableau cleared: cards gone from tableau and stock out of
 * those dealt. */
export const dealClearedShare = (dealt: number, remaining: number) =>
  dealt > 0 ? Math.max(0, Math.min(1, 1 - remaining / dealt)) : 0;

/** Discovery removes only fog; rough, danger and impassable rules survive. */
export const arriveAt = (flags: readonly BiomeFlag[] = []) => flags.filter((flag) => flag !== 'unexplored');
