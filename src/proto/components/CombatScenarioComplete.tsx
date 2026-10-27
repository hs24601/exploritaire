import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SceneButton } from './SceneButton';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from '../rules/battleSandboxScenarios';
import './CombatScenarioComplete.css';

/** Native modal keeps keyboard focus and background interactions inside the result. */
export function CombatScenarioComplete({ scenarioId, won, onChoose, detail }: {
  scenarioId: CombatSandboxScenarioId; won: boolean; onChoose: (id: CombatSandboxScenarioId) => void;
  /** Extra result line, such as an endless scenario's rounds reached. */
  detail?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const index = COMBAT_SANDBOX_SCENARIOS.findIndex(scenario => scenario.id === scenarioId);
  const scenario = COMBAT_SANDBOX_SCENARIOS[index];
  const next = COMBAT_SANDBOX_SCENARIOS[(index + 1) % COMBAT_SANDBOX_SCENARIOS.length];
  const last = index === COMBAT_SANDBOX_SCENARIOS.length - 1;
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="combat-scenario-complete" aria-labelledby="combat-result-title"
    aria-describedby="combat-result-description" onCancel={event => event.preventDefault()}>
    <span className="combat-scenario-complete__eyebrow">COMBAT TRAINING</span>
    <h2 id="combat-result-title">{won ? 'Scenario complete' : 'Party defeated'}</h2>
    <p id="combat-result-description">{scenario.name}</p>
    {detail && <p className="combat-scenario-complete__detail">{detail}</p>}
    {last && won && <p>You’ve completed all {COMBAT_SANDBOX_SCENARIOS.length} training scenarios.</p>}
    <div className="combat-scenario-complete__actions">
      <SceneButton type="button" autoFocus onClick={() => onChoose(scenarioId)}>Replay scenario</SceneButton>
      <SceneButton type="button" onClick={() => onChoose(next.id)}>{last ? 'Back to scenario 001' : 'Next scenario'}</SceneButton>
    </div>
    <p className="combat-scenario-complete__next">{last ? 'Start again: ' : 'Up next: '}{next.name}</p>
  </dialog>, document.body);
}
