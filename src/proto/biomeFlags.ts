/** What a biome's flags mean for play. A biome tile carries `flags`; this is
 * the one place that says what each does to travel and to opening its
 * tableau. A new flag is one entry in BIOME_FLAG_RULES. */

export type BiomeFlag = 'unexplored' | 'rough';

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
  // Nobody has been there: it can't be crossed and its tableau stays hidden,
  // but an actor can go there, which explores it.
  unexplored: { travel: 'blocked', opensTableau: false, closedReason: 'Unexplored. Send an actor there first.' },
  // Hard going: crossing costs three times as much, so routes only cut
  // through when that's still faster.
  rough: { travel: 3, opensTableau: true },
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

/** How explored a biome is, 0-1: nothing while unexplored, a first look on
 * arrival, then the rest as its expedition progresses (`progress`, 0-1:
 * the tableau's cleared share, or the pond's catches). */
export const biomeExploration = (flags: readonly BiomeFlag[] = [], progress = 0) =>
  flags.includes('unexplored') ? 0 : Math.min(1, FIRST_LOOK + (1 - FIRST_LOOK) * Math.max(0, Math.min(1, progress)));

/** Share of a dealt tableau cleared: cards gone from tableau and stock out of
 * those dealt. */
export const dealClearedShare = (dealt: number, remaining: number) =>
  dealt > 0 ? Math.max(0, Math.min(1, 1 - remaining / dealt)) : 0;

/** Fish to land for the pond to count as fully explored. */
export const POND_EXPLORED_CATCHES = 10;

/** Flags after an actor arrives: the first look clears `unexplored`. */
export const arriveAt = (flags: readonly BiomeFlag[] = []) => flags.filter((flag) => flag !== 'unexplored');
