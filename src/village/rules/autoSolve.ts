import { activeAspen, aspenAcceptsRank, aspenPlay, aspenReceive, aspenTop, type AspenRun } from './aspen';
import { RECEIPT_MINUTES } from './daylight';
import { daylightLeft, type Action, type GameState } from './game';
import { berryBlocked, foundationTop, legalPlays, play, top, type Rank } from './golf';
import { digAccepts, digPlay, digRemaining } from './den';
import { INSPIRATION_COLUMN, playSapling, saplingAccepts } from './sapling';

type AspenReceipt = Extract<Action, { type: 'aspen-play' | 'aspen-play-card' }>;
type Receipt = AspenReceipt | Extract<Action, { type: 'play' | 'den-play' | 'sapling-play' }>;

function longest<State, Move>(
  state: State, limit: number, keyOf: (state: State) => string,
  options: (state: State) => Iterable<Move>, apply: (state: State, move: Move) => State,
  preferOpenings = false,
): Move[] {
  const memo = new Map<string, Move[]>();
  const search = (node: State, remaining: number): Move[] => {
    if (remaining === 0) return [];
    const key = keyOf(node);
    const known = memo.get(key);
    if (known) return known;
    let best: Move[] = [];
    const available = options(node);
    const choices = preferOpenings && remaining === limit
      ? Array.from(available, move => ({ move, flexibility: Array.from(options(apply(node, move))).length }))
        .sort((a, b) => b.flexibility - a.flexibility).map(choice => choice.move)
      : available;
    for (const move of choices) {
      const rest = search(apply(node, move), remaining - 1);
      if (rest.length + 1 > best.length) best = [move, ...rest];
      if (best.length === remaining) break;
    }
    memo.set(key, best);
    return best;
  };
  return search(state, limit);
}

export function planVillageReceipts(game: GameState): Receipt[] {
  const light = daylightLeft(game);
  if (game.night || !light || game.view === 'village') return [];
  const beforeDark = (site: keyof typeof RECEIPT_MINUTES) => Math.ceil(light / RECEIPT_MINUTES[site]);
  if (game.view === 'sapling') {
    const run = game.sapling;
    if (!run?.inspiration) return [];
    const choices = (state: typeof run) => state.piles.flatMap((_, column) => saplingAccepts(state, column) ? [column] : []);
    let frontier = [{ state: run, path: [] as number[] }];
    const visited = new Set<string>();
    // Prefer the next inspiration card, using nearby rank bridges when needed.
    for (let depth = 0; depth < Math.min(4, beforeDark('sapling')) && frontier.length; depth++) {
      const next: typeof frontier = [];
      for (const { state, path } of frontier) {
        if (saplingAccepts(state, INSPIRATION_COLUMN)) return [...path, INSPIRATION_COLUMN].map(column => ({ type: 'sapling-play', column }));
        for (const column of choices(state)) {
          const played = playSapling(state, column);
          const signature = `${played.foundation}/${played.piles.join('/')}`;
          if (visited.has(signature)) continue;
          visited.add(signature);
          next.push({ state: played, path: [...path, column] });
        }
      }
      frontier = next;
    }
    return choices(run).slice(0, 1).map(column => ({ type: 'sapling-play', column }));
  }
  if (game.view === 'den') {
    const dig = game.den?.dig, kin = game.den?.worker;
    if (!dig || !kin) return [];
    const remaining = digRemaining(dig);
    const limit = Math.min(remaining, beforeDark('den'));
    return longest(dig, limit, node => `${digRemaining(node)}/${node.foundation}/${node.piles.join('/')}`, node => {
      const seen = new Set<string>();
      return node.piles.flatMap((pile, column) => {
        const signature = pile.join(',');
        if (seen.has(signature) || !digAccepts(node, column)) return [];
        seen.add(signature);
        return [column];
      });
    }, digPlay)
      .map(column => ({ type: 'den-play', column }));
  }
  const aspen = game.view === 'forest' ? activeAspen(game.aspen) : null;
  if (aspen) {
    return longest({ run: aspen, cards: game.aspenCards }, Math.min(aspen.hp, beforeDark('forest')), ({ run, cards }) =>
      run.piles.map(p => p.length).join(',') + '/' + run.foundations.map(f => f.rank).join(',') + '/' + cards.join(','),
    function* ({ run, cards }: { run: AspenRun; cards: Rank[] }): Iterable<AspenReceipt> {
      const seenCards = new Set<Rank>();
      for (let index = 0; index < run.piles.length + cards.length; index++) {
        const fromSpill = index >= run.piles.length;
        const card = index - run.piles.length;
        const value = fromSpill ? cards[card] : aspenTop(run, index);
        if (value === undefined || (fromSpill && seenCards.has(value))) continue;
        if (fromSpill) seenCards.add(value);
        const ranks = new Set<number>();
        for (let foundation = 0; foundation < run.foundations.length; foundation++) {
          const { rank } = run.foundations[foundation];
          if (ranks.has(rank) || !aspenAcceptsRank(run, value, foundation)) continue;
          ranks.add(rank);
          yield fromSpill ? { type: 'aspen-play-card', card, foundation } : { type: 'aspen-play', pile: index, foundation };
        }
      }
    }, ({ run, cards }, move) => {
      return move.type === 'aspen-play-card' ? {
        run: aspenReceive(run, cards[move.card], move.foundation),
        cards: cards.filter((_, index) => index !== move.card),
      } : { run: aspenPlay(run, move.pile, move.foundation), cards };
    }, true);
  }
  const active = game.active;
  if (!active || active.surface !== game.view) return [];
  const { run } = active;
  const knownCards = new Set(run.piles.flatMap(p => p.cards.filter(card => !card.hidden).map(card => card.id)));
  const limit = Math.min(knownCards.size, beforeDark(active.surface));
  return longest(run, limit, node => node.piles.map(p => {
    const card = top(p);
    return card ? `${card.id}${berryBlocked(card) ? 'b' : ''}` : '-';
  }).join(',') + '/' + foundationTop(node)?.rank,
  node => legalPlays(node).filter(i => knownCards.has(top(node.piles[i])!.id)),
  (node, pile) => play(node, pile)).map(pile => ({ type: 'play', pile }));
}
