import type { CSSProperties } from 'react';
import type { TableauPlan } from '../rules/battlePlans';
import type { Card } from '../protoState';
import './TableauPlanMarkers.css';

// Board plans drawn on the combat tableau (rules/battlePlans.ts): dashed
// bands over the row the party will move to, the whole tableau for a
// Withdraw redeal, and outlines on cards an enemy intends to take. Party plans
// use the party's mint, enemy plans the intent red.

/** One column's share of every plan: a band over a row, the full column, or single cards. */
export function PlanSegments({ plans, column }: { plans: readonly TableauPlan[]; column: Card[] }) {
  if (!plans.length || !column.length) return null;
  return <>{plans.flatMap(plan => {
    const { target } = plan;
    const depths = target.kind === 'tableau' ? [-1]
      : target.kind === 'row' ? (column.length > target.row ? [column.length - 1 - target.row] : [])
      : column.flatMap((card, depth) => target.ids.includes(card.id) ? [depth] : []);
    return depths.map(depth => <span key={`${plan.id}-${depth}`} className="tableau-plan" data-plan-by={plan.by} data-plan-kind={target.kind} data-front={depth === column.length - 1 || undefined} aria-hidden="true"
      style={depth < 0 ? undefined : { '--plan-depth': depth } as CSSProperties} />);
  })}</>;
}

/** Labels beside the rack, one per plan, colored like its band. */
export function PlanLegend({ plans }: { plans: readonly TableauPlan[] }) {
  if (!plans.length) return null;
  return <ul className="tableau-plan-legend" aria-label="Board plans">
    {plans.map(plan => <li key={plan.id} className="tableau-plan-legend__item" data-plan-by={plan.by} data-game-tooltip={plan.detail}>
      <span aria-hidden="true">{plan.by === 'party' ? '↶' : '⚔'}</span> {plan.label}
    </li>)}
  </ul>;
}
