import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from '../rules/battleSandboxScenarios';
import { sceneRewardTheme, sceneRoutes } from '../rules/sceneRoutes';
import './CombatRouteTree.css';

const MOTIFS = { ice: '❄', fire: '✦', nature: '❧', earth: '◆', water: '≈', air: '〰', shock: 'ϟ', light: '☼', dark: '☾', chaos: '✺', order: '◇' } as const;
export function CombatRouteTree({ current, disabled = false, onSelect }: { current: CombatSandboxScenarioId; disabled?: boolean; onSelect: (id: CombatSandboxScenarioId) => void }) {
  const routes = sceneRoutes(current);
  if (!routes.length) return null;
  return <section className="combat-route-tree" aria-label="Choose the next encounter">
    <p>Choose your path <span>· reward theme shown on each destination</span></p>
    <div className="combat-route-tree__map">
      <div className="combat-route-tree__origin"><span>✧</span><b>Here</b></div>
      <div className="combat-route-tree__branches" role="group" aria-label="Available paths">
        {routes.map(id => {
          const scene = COMBAT_SANDBOX_SCENARIOS.find(option => option.id === id)!;
          const theme = sceneRewardTheme(id);
          return <button key={id} type="button" className="combat-route-tree__node" data-theme={theme} disabled={disabled} onClick={() => onSelect(id)}>
            <span className="combat-route-tree__motif" aria-hidden="true">{MOTIFS[theme]}</span><span><b>{scene.name.replace(/^\d+:\s*/, '')}</b><small>{theme} reward</small></span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}

