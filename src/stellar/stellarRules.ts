/** Noncombat star-tableau experiment. The shared grid owns legality and refill;
 * receipts grow a constellation and stock draws end its chain, without damage. */
export type StellarResult = 'complete' | null;
export type StellarEvent =
  | { kind: 'receipt'; chain: number; tier: number }
  | { kind: 'chain-end'; length: number };

export type StellarBattle = {
  /** Cards played since the last stock draw (or the foundation pick). */
  chain: number;
  bestChain: number;
  /** Stock draws in this night; these never cause a penalty. */
  draws: number;
  result: StellarResult;
};

/** Chain positions where star brightness and sound step up. */
export const TIER_STEPS = [3, 5, 8] as const;

export const chainTier = (position: number) => 1 + TIER_STEPS.filter(step => position >= step).length;

export const createStellarBattle = (): StellarBattle => ({chain:0,bestChain:0,draws:0,result:null});

/** One card played onto the foundation. */
export function stellarReceipt(state: StellarBattle): { state: StellarBattle; events: StellarEvent[] } {
  if (state.result) return { state, events: [] };
  const chain = state.chain + 1, tier = chainTier(chain);
  return {
    state: { ...state, chain, bestChain: Math.max(state.bestChain, chain) },
    events: [{ kind: 'receipt', chain, tier }],
  };
}

/** A stock draw settles the chain and begins another, without an attack. */
export function stellarDraw(state: StellarBattle): { state: StellarBattle; events: StellarEvent[] } {
  if (state.result) return { state, events: [] };
  const events: StellarEvent[] = [];
  if (state.chain > 0) events.push({ kind: 'chain-end', length: state.chain });
  const draws = state.draws + 1;
  return {state:{...state,chain:0,draws},events};
}

/** The grid ran out of plays with an empty stock: the night ends. */
export const stellarStuck = (state: StellarBattle): StellarBattle => state.result ? state : { ...state, result: 'complete' };
