import type { BattleState } from './battle';

// Board plans: where the tableau is about to move, and which cards a side
// intends to take, drawn on the board by TableauPlanMarkers. One shape for
// the party's pending Withdraw and an enemy Withdraw; card targets are
// available for future plans.
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
  // Which cards an intent owner will take is left for the player to read (Eric, 2026-10-25): no card plans for intents.
  return plans;
}
