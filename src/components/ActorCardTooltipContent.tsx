import { useMemo } from 'react';
import type { Actor, ActorDefinition, ActorDeckState, OrimInstance, OrimDefinition } from '../engine/types';
import { getSuitDisplay, ELEMENT_TO_SUIT, SUIT_COLORS } from '../engine/constants';

const ORIM_ELEMENT_PRIORITY: Array<keyof typeof ELEMENT_TO_SUIT> = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

const getOrimPrimaryElement = (definition?: OrimDefinition | null) => {
  if (!definition?.affinity) return null;
  let best: keyof typeof ELEMENT_TO_SUIT | null = null;
  let bestValue = -Infinity;
  for (const element of ORIM_ELEMENT_PRIORITY) {
    const value = definition.affinity[element];
    if (value === undefined) continue;
    if (value > bestValue) {
      bestValue = value;
      best = element;
    }
  }
  return best;
};

interface ActorCardTooltipContentProps {
  actor: Actor;
  definition: ActorDefinition;
  actorDeck?: ActorDeckState;
  orimInstances: Record<string, OrimInstance>;
  orimDefinitions: OrimDefinition[];
  showGraphics: boolean;
  isPartied?: boolean;
}

export function ActorCardTooltipContent({
  actor,
  definition,
  actorDeck,
  orimInstances,
  orimDefinitions,
  showGraphics,
  isPartied = false,
}: ActorCardTooltipContentProps) {
  const suitDisplay = definition.suit ? getSuitDisplay(definition.suit, showGraphics) : '—';
  const elementDisplay = definition.element ?? '—';
  const titleLine = definition.titles?.length ? definition.titles.join(' · ') : '';
  const orimLookup = useMemo(
    () => new Map<string, OrimDefinition>(orimDefinitions.map((def) => [def.id, def])),
    [orimDefinitions]
  );
  const deckCards = actorDeck?.cards ?? [];
  const powerUsed = deckCards.reduce((sum, deckCard) => {
    return sum + deckCard.slots.reduce((slotSum, slot) => {
      const instance = slot.orimId ? orimInstances[slot.orimId] : null;
      const definition = instance ? orimLookup.get(instance.definitionId) : null;
      return slotSum + (definition?.powerCost ?? 0);
    }, 0);
  }, 0);

  return (
    <div className="flex flex-col gap-2 text-game-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-game-teal">{definition.name}</div>
          {titleLine && (
            <div className="text-[11px] text-game-white/70">{titleLine}</div>
          )}
        </div>
        <div className="text-[10px] text-game-white/40">ID {actor.id}</div>
      </div>

      <div className="text-[11px] text-game-white/70 leading-snug">
        {definition.description}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <span className="text-game-white/50">Type:</span> {definition.type}
        </div>
        <div>
          <span className="text-game-white/50">Level:</span> {actor.level}
        </div>
        <div>
          <span className="text-game-white/50">Value:</span> {actor.currentValue} (base {definition.value})
        </div>
        <div>
          <span className="text-game-white/50">Stamina:</span> {actor.stamina}/{actor.staminaMax}
        </div>
        <div>
          <span className="text-game-white/50">Energy:</span> {actor.energy}/{actor.energyMax}
        </div>
        <div>
          <span className="text-game-white/50">Suit:</span> {suitDisplay}
        </div>
        <div>
          <span className="text-game-white/50">Element:</span> {elementDisplay}
        </div>
        <div>
          <span className="text-game-white/50">Power:</span>{' '}
          <span className={powerUsed > (actor.powerMax ?? 0) ? 'text-game-pink' : 'text-game-teal'}>
            {powerUsed}/{actor.powerMax ?? 0}
          </span>
        </div>
      </div>

      {isPartied && (
        <div className="text-[11px] text-game-gold/90">Status: Partied</div>
      )}

      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-wider text-game-teal/80 mb-1">
          Deck Orim
        </div>
        {deckCards.length === 0 ? (
          <div className="text-[11px] text-game-white/50">No deck assigned</div>
        ) : (
          <div className="flex flex-col gap-2">
            {deckCards.map((deckCard) => (
              <div key={deckCard.id} className="border border-game-teal/20 rounded-md p-2 bg-game-bg-dark/60">
                <div className="text-[11px] font-bold text-game-white mb-1">Card {deckCard.value}</div>
                <div className="flex flex-wrap gap-2">
                  {deckCard.slots.map((slot) => {
                    const instance = slot.orimId ? orimInstances[slot.orimId] : null;
                    const definition = instance ? orimLookup.get(instance.definitionId) : null;
                    const primaryElement = getOrimPrimaryElement(definition);
                    const slotColor = primaryElement
                      ? SUIT_COLORS[ELEMENT_TO_SUIT[primaryElement]]
                      : '#7fdbca';
                    const label = definition
                      ? primaryElement
                        ? getSuitDisplay(ELEMENT_TO_SUIT[primaryElement], showGraphics)
                        : definition.name
                      : 'Empty';
                    return (
                      <div
                        key={slot.id}
                        className="px-2 py-1 rounded text-[10px] border"
                        style={{
                          borderColor: definition ? slotColor : 'rgba(127, 219, 202, 0.3)',
                          color: definition ? slotColor : 'rgba(127, 219, 202, 0.6)',
                        }}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
