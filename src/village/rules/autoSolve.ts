import { activeAspen, aspenAcceptsRank, aspenPlay, aspenReceive, aspenTop, type AspenRun, type KinStamina } from './aspen';
import { DAYLIGHT } from './daylight';
import { daylightLeft, surfaceWorkers, type Action, type GameState } from './game';
import { berryBlocked, foundationTop, legalPlays, play, top, type Rank } from './golf';
import { digAccepts, digPlay, digRemaining } from './den';

type AspenReceipt = Extract<Action, { type: 'aspen-play' | 'aspen-play-card' }>;
type Receipt = AspenReceipt | Extract<Action, { type: 'play' | 'den-play' }>;

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
  if (game.night || game.view === 'village') return [];
  if (game.view === 'den') {
    const dig = game.den?.dig, kin = game.den?.worker;
    if (!dig || !kin) return [];
    const remaining = digRemaining(dig);
    const limit = Math.min(remaining, Math.ceil(daylightLeft(game) / DAYLIGHT.playMinutes));
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
    const stamina = aspen.foundations.reduce((total, { kin }) => total + game.stamina[kin], 0);
    return longest({ run: aspen, stamina: game.stamina, cards: game.aspenCards }, Math.min(aspen.hp, stamina), ({ run, stamina, cards }) =>
      run.piles.map(p => p.length).join(',') + '/' + run.foundations.map(f => `${f.rank}:${stamina[f.kin]}`).join(',') + '/' + cards.join(','),
    function* ({ run, stamina, cards }: { run: AspenRun; stamina: KinStamina; cards: Rank[] }): Iterable<AspenReceipt> {
      const seenCards = new Set<Rank>();
      for (let index = 0; index < run.piles.length + cards.length; index++) {
        const fromSpill = index >= run.piles.length;
        const card = index - run.piles.length;
        const value = fromSpill ? cards[card] : aspenTop(run, index);
        if (value === undefined || (fromSpill && seenCards.has(value))) continue;
        if (fromSpill) seenCards.add(value);
        const ranks = new Set<number>();
        for (let foundation = 0; foundation < run.foundations.length; foundation++) {
          const { rank, kin } = run.foundations[foundation];
          const signature = rank * 10 + stamina[kin];
          if (ranks.has(signature) || !aspenAcceptsRank(run, value, foundation, stamina)) continue;
          ranks.add(signature);
          yield fromSpill ? { type: 'aspen-play-card', card, foundation } : { type: 'aspen-play', pile: index, foundation };
        }
      }
    }, ({ run, stamina, cards }, move) => {
      const { kin } = run.foundations[move.foundation];
      const remaining = { ...stamina, [kin]: stamina[kin] - 1 };
      return move.type === 'aspen-play-card' ? {
        run: aspenReceive(run, cards[move.card], move.foundation), stamina: remaining,
        cards: cards.filter((_, index) => index !== move.card),
      } : { run: aspenPlay(run, move.pile, move.foundation), stamina: remaining, cards };
    }, true);
  }
  const active = game.active;
  if (!active || active.surface !== game.view) return [];
  const { run } = active;
  const knownCards = new Set(run.piles.flatMap(p => p.cards.filter(card => !card.hidden).map(card => card.id)));
  const workers = surfaceWorkers(game, active.surface);
  const stamina = workers.length ? workers.reduce((total, kin) => total + game.stamina[kin], 0) : Infinity;
  const limit = Math.min(knownCards.size, stamina, Math.ceil(daylightLeft(game) / DAYLIGHT.playMinutes));
  return longest(run, limit, node => node.piles.map(p => {
    const card = top(p);
    return card ? `${card.id}${berryBlocked(card) ? 'b' : ''}` : '-';
  }).join(',') + '/' + foundationTop(node)?.rank,
  node => legalPlays(node).filter(i => knownCards.has(top(node.piles[i])!.id)),
  (node, pile) => play(node, pile)).map(pile => ({ type: 'play', pile }));
}
