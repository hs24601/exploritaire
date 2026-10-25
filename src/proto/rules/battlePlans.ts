import { tableauWidth, type BattleState } from './battle';
import { intentDef, intentEnemyPlays, intentOwnerSkips } from './battleDeadRun';

// Board plans: where the tableau is about to move, and which cards a side
// intends to take, drawn on the board by TableauPlanMarkers. One shape for
// the party's pending Withdraw, an enemy Withdraw and an enemy's card intent.
// Pure: no React or DOM.

export type TableauPlan = {
  id: string;
  by: 'party' | 'enemy';
  /** A row counted from the front (0 is the exposed row), the whole tableau, or named cards. */
  target: { kind: 'row'; row: number } | { kind: 'tableau' } | { kind: 'cards'; ids: string[] };
  label: string;
  detail: string;
};

export function tableauPlans(state: BattleState): TableauPlan[] {
  if (state.result) return [];
  const plans: TableauPlan[] = [];
  const redeal = state.pendingRedeal;
  if (redeal) plans.push(redeal.row === undefined
    ? { id: 'party-withdraw', by: 'party', target: { kind: 'tableau' }, label: 'Withdraw · new tableau',
      detail: 'Your Withdraw: the enemy acts on this board first, then your next turn opens on a fresh tableau.' }
    : { id: 'party-withdraw', by: 'party', target: { kind: 'row', row: redeal.row }, label: `Withdraw · row ${redeal.row + 1}`,
      detail: `Your Withdraw: the enemy acts on this board first, then your next turn opens on this row. Cards in front of it leave and the columns refill behind it.` });
  const foe = state.pendingWithdraw && state.foes.find(unit => unit.id === state.pendingWithdraw!.foeId);
  if (foe) plans.push({ id: `${foe.id}-withdraw`, by: 'enemy', target: { kind: 'tableau' }, label: `${foe.name} · Withdraw`,
    detail: `${foe.name} intends to Withdraw, replacing the whole tableau.` });
  // The intent's owner takes these exposed cards on its next turn if the board stays as it is.
  const def = intentDef(state), intent = state.tutorial?.intent;
  if (def && intent && state.turn === 'party' && !intentOwnerSkips(state.foes[0])) {
    const taken = intentEnemyPlays(state).intent!.cards.slice(intent.cards.length);
    const visible = new Set(state.columns.slice(0, tableauWidth(state)).flatMap(cards => cards.slice(-1).map(card => card.id)));
    const ids = taken.map(card => card.id).filter(id => visible.has(id));
    if (ids.length) plans.push({ id: 'intent-plays', by: 'enemy', target: { kind: 'cards', ids }, label: `${def.name} takes ${ids.length === 1 ? 'this card' : 'these cards'}`,
      detail: `On its next turn ${state.foes[0]?.name ?? 'the enemy'} plays the marked card${ids.length === 1 ? '' : 's'} onto ${def.name}, unless you take ${ids.length === 1 ? 'it' : 'them'} first.` });
  }
  return plans;
}
