import type { EnemyState } from '../types';
import { enemiesById } from '../engine/catalog';

interface EnemyPanelProps {
  enemy: EnemyState | null;
  mode: string;
  onEnemyAttack: () => void;
}

export function EnemyPanel({ enemy, mode, onEnemyAttack }: EnemyPanelProps) {
  if (!enemy) {
    return (
      <section className="proto-panel proto-enemy-panel">
        <div>
          <p className="proto-kicker">Enemy</p>
          <h1>Exploration</h1>
        </div>
        <p className="proto-muted">Reveal enemy tokens by chaining through the tableau.</p>
      </section>
    );
  }

  const data = enemiesById[enemy.id];
  const hpPercent = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;

  return (
    <section className="proto-panel proto-enemy-panel">
      <div>
        <p className="proto-kicker">Enemy</p>
        <h1>{data.name}</h1>
      </div>
      <div className="proto-meter">
        <span style={{ width: hpPercent }} />
      </div>
      <div className="proto-enemy-stats">
        <strong>{enemy.hp}/{enemy.maxHp} HP</strong>
        <span>{data.intent}</span>
      </div>
      <button type="button" className="proto-button danger" onClick={onEnemyAttack} disabled={mode !== 'combat'}>
        Resolve Enemy Intent
      </button>
    </section>
  );
}
