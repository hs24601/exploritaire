import { memo } from 'react';
import type { Effect } from '../engine/types';

interface EffectsDisplayProps {
  effects: Effect[];
}

export const EffectsDisplay = memo(function EffectsDisplay({
  effects,
}: EffectsDisplayProps) {
  if (effects.length === 0) return null;

  return (
    <div className="mt-3 px-3 py-2 bg-transparent border border-game-purple-faded rounded shadow-neon-purple">
      <div className="text-[0.65rem] mb-1 opacity-70 uppercase tracking-wider text-game-purple">
        Active Effects
      </div>
      {effects.map((effect, idx) => (
        <div
          key={idx}
          className={`text-xs flex justify-between gap-2 ${
            effect.type === 'buff' ? 'text-game-teal' : 'text-game-red'
          }`}
          style={{ textShadow: '0 0 8px currentColor' }}
        >
          <span>{effect.name}</span>
          <span>{effect.duration === -1 ? '\u221E' : effect.duration}</span>
        </div>
      ))}
    </div>
  );
});
