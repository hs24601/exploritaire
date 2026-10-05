import { CARD_MODIFIER_DATA } from '../data/modifiers';
import type { ModifierId } from '../types';

interface RewardPanelProps {
  selectedModifierId: ModifierId;
  onSelectModifier: (modifierId: ModifierId) => void;
}

export function RewardPanel({ selectedModifierId, onSelectModifier }: RewardPanelProps) {
  return (
    <section className="proto-panel proto-reward-panel">
      <p className="proto-kicker">Reward</p>
      <h2>Choose Modifier Token</h2>
      <div className="proto-modifier-grid">
        {CARD_MODIFIER_DATA.map((modifier) => (
          <button
            key={modifier.id}
            type="button"
            className={selectedModifierId === modifier.id ? 'proto-mod-token selected' : 'proto-mod-token'}
            style={{ borderColor: modifier.color }}
            onClick={() => onSelectModifier(modifier.id)}
            title={modifier.description}
          >
            <span style={{ background: modifier.color }} />
            {modifier.name}
          </button>
        ))}
      </div>
      <p className="proto-muted">Click any remaining number card in the tableau to attach the selected modifier.</p>
    </section>
  );
}
