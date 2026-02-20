import { useState } from 'react';
import type { GameState, EventChoice } from '../engine/types';
import type { PuzzleCompletedPayload } from '../engine/types';
import { getBiomeDefinition } from '../engine/biomes';

// ── Element display helpers ──────────────────────────────────────────────────

const ELEMENT_SUIT: Record<string, string> = {
  W: '💧', E: '⛰️', A: '💨', F: '🔥', L: '⭐', D: '🌙', N: '☀️',
};

const ELEMENT_COLOR: Record<string, string> = {
  W: 'text-blue-300',
  E: 'text-amber-600',
  A: 'text-sky-300',
  F: 'text-orange-400',
  L: 'text-yellow-300',
  D: 'text-purple-400',
  N: 'text-slate-300',
};

function rankLabel(rank: number): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

// ── Minimal card tile ────────────────────────────────────────────────────────

interface EventCardProps {
  rank: number;
  element: string;
}

function EventCard({ rank, element }: EventCardProps) {
  const suit = ELEMENT_SUIT[element] ?? '?';
  const color = ELEMENT_COLOR[element] ?? 'text-slate-300';
  return (
    <div className="flex flex-col items-center justify-between w-10 h-14 rounded-lg bg-black/60 border border-white/10 px-1 py-1 select-none">
      <span className={`text-xs font-bold leading-none ${color}`}>{rankLabel(rank)}</span>
      <span className="text-base leading-none">{suit}</span>
      <span className={`text-xs font-bold leading-none ${color}`}>{rankLabel(rank)}</span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

interface EventEncounterActions {
  puzzleCompleted: (payload?: PuzzleCompletedPayload | null) => void;
  completeBiome: () => void;
}

interface EventEncounterProps {
  gameState: GameState;
  actions: EventEncounterActions;
}

export function EventEncounter({ gameState, actions }: EventEncounterProps) {
  const [resolved, setResolved] = useState(false);

  const biomeDef = gameState.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)
    : null;

  if (!biomeDef || biomeDef.biomeType !== 'event') return null;

  const choices: EventChoice[] = biomeDef.eventChoices ?? [];

  function handleChoice(choice: EventChoice) {
    if (resolved) return;
    setResolved(true);
    actions.puzzleCompleted({
      source: 'event',
      rewards: choice.rewards,
    });
    actions.completeBiome();
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-6 px-6 py-10">

      {/* Flavor header */}
      <div className="text-center space-y-2 max-w-lg">
        <div className="text-[10px] uppercase tracking-[0.4em] text-game-teal/70">
          Encounter
        </div>
        <h2 className="text-2xl font-bold text-game-white tracking-wide">
          {biomeDef.name}
        </h2>
        <p className="text-sm text-game-white/60 leading-relaxed">
          {biomeDef.description}
        </p>
      </div>

      {/* Tableau — visual only, no interaction */}
      {gameState.tableaus.length > 0 && (
        <div className="flex gap-3 flex-wrap justify-center">
          {gameState.tableaus.map((column, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1 items-center">
              {column.map((card) => (
                <EventCard key={card.id} rank={card.rank} element={card.element} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="w-48 h-px bg-game-teal/20" />

      {/* Choices */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {choices.map((choice) => (
          <button
            key={choice.id}
            disabled={resolved}
            onClick={() => handleChoice(choice)}
            className={[
              'w-full text-left rounded-xl border px-4 py-3 transition-all',
              'bg-black/50 border-white/10',
              resolved
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-white/5 hover:border-game-teal/40 active:scale-[0.98] cursor-pointer',
            ].join(' ')}
          >
            <div className="text-sm font-semibold text-game-white mb-0.5">
              {choice.label}
            </div>
            <div className="text-xs text-game-white/50 leading-snug">
              {choice.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
