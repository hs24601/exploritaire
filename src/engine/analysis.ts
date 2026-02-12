import type { Card, Effect, Move } from './types';
import { canPlayCard, canPlayCardWithWild } from './rules';

export type AnalysisMode = 'standard' | 'wild';

export interface AnalysisRequest {
  tableaus: Card[][];
  foundations: Card[][];
  activeEffects?: Effect[];
  mode: AnalysisMode;
}

export interface AnalysisResult {
  key: string;
  sequence: Move[];
  maxCount: number;
}

type MemoEntry = {
  len: number;
  move?: Move;
  nextKey?: string;
  nextLengths?: number[];
  nextFoundationTops?: Array<Card | undefined>;
};

function getCardKey(card: Card | undefined): string {
  if (!card) return 'none';
  return card.id || `${card.rank}-${card.suit}-${card.element}`;
}

export function computeAnalysisKey(
  tableaus: Card[][],
  foundations: Card[][],
  activeEffects: Effect[] = [],
  mode: AnalysisMode = 'standard'
): string {
  const tableauKey = tableaus
    .map((t) => t.map((card) => getCardKey(card)).join('.'))
    .join('|');
  const tableauLens = tableaus.map((t) => t.length).join(',');
  const foundationTops = foundations.map((f) => getCardKey(f[f.length - 1])).join(',');
  const effectsKey = activeEffects.map((e) => `${e.id}:${e.duration}`).join('|');
  return `${mode}|${tableauKey}|${tableauLens}|${foundationTops}|${effectsKey}`;
}

export function analyzeOptimalSequence(request: AnalysisRequest): AnalysisResult {
  const { tableaus, foundations, activeEffects = [], mode } = request;
  const baseTableaus = tableaus;
  const foundationTops = foundations.map((f) => f[f.length - 1]);
  const canPlay = mode === 'wild' ? canPlayCardWithWild : canPlayCard;

  const initialLengths = baseTableaus.map((t) => t.length);
  const memo = new Map<string, MemoEntry>();

  const makeKey = (lengths: number[], tops: Array<Card | undefined>): string => {
    const tableauKey = baseTableaus
      .map((t) => t.map((card) => getCardKey(card)).join('.'))
      .join('|');
    const tableauLens = lengths.join(',');
    const foundationKeys = tops.map(getCardKey).join(',');
    const effectsKey = activeEffects.map((e) => `${e.id}:${e.duration}`).join('|');
    return `${mode}|${tableauKey}|${tableauLens}|${foundationKeys}|${effectsKey}`;
  };
  const initialKey = makeKey(initialLengths, foundationTops);

  const dfs = (lengths: number[], tops: Array<Card | undefined>): MemoEntry => {
    const key = makeKey(lengths, tops);
    const cached = memo.get(key);
    if (cached) return cached;

    let bestLen = 0;
    let bestMove: Move | undefined;
    let bestNextKey: string | undefined;
    let bestNextLengths: number[] | undefined;
    let bestNextTops: Array<Card | undefined> | undefined;

    for (let tIdx = 0; tIdx < lengths.length; tIdx += 1) {
      const len = lengths[tIdx];
      if (len <= 0) continue;
      const topCard = baseTableaus[tIdx][len - 1];

      for (let fIdx = 0; fIdx < tops.length; fIdx += 1) {
        const foundationTop = tops[fIdx];
        if (!foundationTop) continue;
        if (!canPlay(topCard, foundationTop, activeEffects)) continue;

        const nextLengths = lengths.slice();
        nextLengths[tIdx] -= 1;
        const nextTops = tops.slice();
        nextTops[fIdx] = topCard;

        const nextEntry = dfs(nextLengths, nextTops);
        const candidateLen = 1 + nextEntry.len;
        if (candidateLen > bestLen) {
          bestLen = candidateLen;
          bestMove = { tableauIndex: tIdx, foundationIndex: fIdx, card: topCard };
          bestNextKey = makeKey(nextLengths, nextTops);
          bestNextLengths = nextLengths;
          bestNextTops = nextTops;
        }
      }
    }

    const entry: MemoEntry = {
      len: bestLen,
      move: bestMove,
      nextKey: bestNextKey,
      nextLengths: bestNextLengths,
      nextFoundationTops: bestNextTops,
    };
    memo.set(key, entry);
    return entry;
  };

  dfs(initialLengths, foundationTops);

  const sequence: Move[] = [];
  let currentKey = initialKey;
  let currentLengths = initialLengths;
  let currentTops = foundationTops;

  while (true) {
    const entry = memo.get(currentKey);
    if (!entry || !entry.move || !entry.nextKey || !entry.nextLengths || !entry.nextFoundationTops) break;
    sequence.push(entry.move);
    currentKey = entry.nextKey;
    currentLengths = entry.nextLengths;
    currentTops = entry.nextFoundationTops;
  }

  return {
    key: initialKey,
    sequence,
    maxCount: sequence.length,
  };
}
