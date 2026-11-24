// Simulated players for the daylight balance pass (tools/village-daylight-sim.ts)
// and for tests. Not used by the UI.
import { draw, legalPlays, play, runEnd, type Run } from './golf';

export type Policy = (run: Run) => number | 'draw';

/** Plays a random legal card, draws only when stuck. */
export function casual(rand: () => number): Policy {
  return run => {
    const legal = legalPlays(run);
    return legal.length ? legal[Math.floor(rand() * legal.length)] : 'draw';
  };
}

/** Searches ahead for the longest chain (and the most value) before drawing. */
export function planner(depthLimit = 7): Policy {
  const score = (run: Run, depth: number): number => {
    const legal = legalPlays(run);
    if (!legal.length || depth === 0) return run.earned * 100 + exposedPlayable(run);
    let best = -Infinity;
    for (const i of legal) best = Math.max(best, score(play(run, i), depth - 1));
    return best;
  };
  return run => {
    const legal = legalPlays(run);
    if (!legal.length) return 'draw';
    let bestI = legal[0], best = -Infinity;
    for (const i of legal) {
      const s = score(play(run, i), depthLimit - 1);
      if (s > best) { best = s; bestI = i; }
    }
    return bestI;
  };
}

function exposedPlayable(run: Run): number {
  // Tie-break: prefer leaving ripe, face-up cards exposed.
  return run.piles.reduce((n, p) => { const t = p.cards[p.cards.length - 1]; return n + (t && !t.unripe && !t.hidden ? 1 : 0); }, 0);
}

export interface RunStats { plays: number; draws: number; earned: number; cleared: boolean; bestChain: number; felled: number }

export function playOut(run: Run, policy: Policy): RunStats {
  let r = run;
  for (let guard = 0; guard < 500 && !runEnd(r); guard++) {
    const move = policy(r);
    r = move === 'draw' ? draw(r) : play(r, move);
  }
  return { plays: r.receipts, draws: r.draws, earned: r.earned, cleared: runEnd(r) === 'cleared', bestChain: r.bestChain, felled: r.felled };
}
