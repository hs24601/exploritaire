import type { ReactNode } from 'react';
import { COMBAT_ABILITY_SLOTS } from '../rules/battleAbilities';
import './AbilityTray.css';
/** Four stable slots: selected abilities precede inert, empty rectangles. */
export function AbilityTray({ actorName, abilities }: { actorName: string; abilities: readonly ReactNode[] }) {
  const selected = abilities.filter(ability => ability !== null && ability !== undefined && ability !== false).slice(0, COMBAT_ABILITY_SLOTS);
  return <div className="ability-tray" role="group" aria-label={actorName + ' ability tray'}>
    {Array.from({ length: COMBAT_ABILITY_SLOTS }, (_, index) => selected[index] ??
      <span key={'empty-' + index} className="ability-tray__empty" role="img" aria-label={'Empty ability slot ' + (index + 1)} />)}
  </div>;
}
