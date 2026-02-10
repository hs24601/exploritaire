import { memo } from 'react';
import type { ActorDefinition } from '../engine/types';
import { getActorDisplayGlyph, getActorValueDisplay } from '../engine/actors';

interface PartyBenchProps {
  benchActors: Array<{ actorId: string; definition: ActorDefinition }>;
  showGraphics: boolean;
  onBenchActorClick?: (actorId: string) => void;
  swapCount?: number;
  infiniteSwapsEnabled?: boolean;
  onToggleInfiniteSwaps?: () => void;
  freeSwapActorIds?: Set<string>;
  actorComboCounts?: Record<string, number>;
}

export const PartyBench = memo(function PartyBench({
  benchActors,
  showGraphics,
  onBenchActorClick,
  swapCount = 0,
  infiniteSwapsEnabled = false,
  onToggleInfiniteSwaps,
  freeSwapActorIds,
  actorComboCounts,
}: PartyBenchProps) {
  const benchSlots = Array.from({ length: 5 }, (_, idx) => benchActors[idx] ?? null);
  const renderCard = (entry: { actorId: string; definition: ActorDefinition } | null) => {
    const cardSize = 'w-16 h-24';
    const glyphSize = 'text-2xl';
    const value = entry ? getActorValueDisplay(entry.definition.value) : '—';
    const isClickable = Boolean(entry && onBenchActorClick);
    const isFreeSwap = !!entry && !!freeSwapActorIds?.has(entry.actorId);
    const comboCount = entry ? (actorComboCounts?.[entry.actorId] ?? 0) : 0;

    return (
      <button
        type="button"
        className={`${cardSize} rounded-2xl border flex flex-col items-center justify-center px-2 py-2 relative ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{
          borderColor: isFreeSwap ? 'rgba(230, 179, 30, 0.9)' : 'rgba(127, 219, 202, 0.5)',
          backgroundColor: 'rgba(10, 10, 10, 0.6)',
          boxShadow: isFreeSwap ? '0 0 12px rgba(230, 179, 30, 0.5)' : 'none',
        }}
        onClick={() => {
          if (!entry || !onBenchActorClick) return;
          onBenchActorClick(entry.actorId);
        }}
        disabled={!isClickable}
      >
        <div
          className="absolute top-1 left-0 right-0 text-center font-bold"
          style={{
            color: '#050505',
            textShadow: `
              0 0 1px rgba(255, 255, 255, 0.85),
              0 0 2px rgba(255, 255, 255, 0.6),
              1px 0 0 rgba(255, 255, 255, 0.95),
              -1px 0 0 rgba(255, 255, 255, 0.95),
              0 1px 0 rgba(255, 255, 255, 0.95),
              0 -1px 0 rgba(255, 255, 255, 0.95)
            `,
          }}
        >
          {value}
        </div>
        <div className={`${glyphSize}`}>
          {entry ? getActorDisplayGlyph(entry.definition.id, showGraphics) : '·'}
        </div>
        {comboCount > 0 && (
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full text-[9px] font-bold px-2 py-1 border"
            style={{
              color: '#0a0a0a',
              backgroundColor: 'rgba(230, 179, 30, 0.95)',
              borderColor: 'rgba(255, 229, 120, 0.9)',
              boxShadow: '0 0 8px rgba(230, 179, 30, 0.6)',
            }}
          >
            {comboCount}
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 text-[11px] text-game-white/70 text-center truncate">
          {entry?.definition.name ?? 'Empty'}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3 pointer-events-auto w-full relative" data-party-bench>
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center">
        <div />
        <div className="flex items-center gap-2 justify-center">
          <div className="text-[10px] tracking-[3px] text-game-teal/80">PARTY BENCH</div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <div
            className="rounded-full flex items-center justify-center font-bold"
            style={{
              width: 22,
              height: 22,
              fontSize: 12,
              color: '#f4e9ff',
              backgroundColor: 'rgba(165, 110, 255, 0.9)',
              boxShadow: '0 0 12px rgba(165, 110, 255, 0.55)',
              border: '1px solid rgba(220, 190, 255, 0.85)',
            }}
            title="Party swap counter"
          >
            {swapCount}
          </div>
          {onToggleInfiniteSwaps && (
            <button
              type="button"
              className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider border ${
                infiniteSwapsEnabled
                  ? 'text-game-gold border-game-gold'
                  : 'text-game-teal border-game-teal/60'
              }`}
              style={{
                backgroundColor: 'rgba(10, 10, 10, 0.75)',
                boxShadow: infiniteSwapsEnabled
                  ? '0 0 10px rgba(230, 179, 30, 0.5)'
                  : '0 0 8px rgba(127, 219, 202, 0.4)',
              }}
              onClick={onToggleInfiniteSwaps}
              title="Toggle infinite swaps"
            >
              ∞
            </button>
          )}
        </div>
      </div>
      <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center">
        <div />
        <div className="flex items-center gap-2 justify-center">
          {benchSlots.map((actor, idx) => (
            <div key={actor?.definition.id ?? `bench-slot-${idx}`} className="flex flex-col items-center gap-1">
              {renderCard(actor)}
            </div>
          ))}
        </div>
        <div />
      </div>
    </div>
  );
});
