import { memo, useMemo } from 'react';
import type { Card as CardType } from '../../engine/types';
import { CARD_SIZE } from '../../engine/constants';
import { Card } from '../Card';
import { useCardScalePreset } from '../../contexts/CardScaleContext';

interface DedicatedEnemyTableauProps {
  tableaus: CardType[][];
  showGraphics: boolean;
  cardScale?: number;
  className?: string;
  startIndex?: number;
}

const STACK_PEEK_PX = 8;

export const DedicatedEnemyTableau = memo(function DedicatedEnemyTableau({
  tableaus,
  showGraphics,
  cardScale = 0.75,
  className,
  startIndex = 0,
}: DedicatedEnemyTableauProps) {
  const tableGlobalScale = useCardScalePreset('table');
  const cardSize = useMemo(() => ({
    width: Math.round(CARD_SIZE.width * cardScale * tableGlobalScale),
    height: Math.round(CARD_SIZE.height * cardScale * tableGlobalScale),
  }), [cardScale, tableGlobalScale]);

  return (
    <div className={className}>
      <div className="flex w-full items-start justify-center gap-3 overflow-hidden px-1 py-2">
        {tableaus.length === 0 ? (
          <div className="h-[1px] w-[1px]" />
        ) : (
          tableaus.map((stack, idx) => {
            const tableauIndex = startIndex + idx;
            const stackHeight = cardSize.height + Math.max(0, stack.length - 1) * STACK_PEEK_PX;
            return (
              <div
                key={`enemy-tableau-stack-${tableauIndex}`}
                className="relative rounded bg-transparent px-1.5 pt-1.5 pb-1"
                style={{ minWidth: cardSize.width + 12 }}
              >
                <div
                  className="relative pointer-events-none select-none"
                  style={{ width: cardSize.width, height: stackHeight }}
                  aria-label={`Hidden enemy stack ${idx + 1}`}
                >
                  {stack.length === 0 ? (
                    <div
                      className="rounded border border-dashed border-game-white/20"
                      style={{ width: cardSize.width, height: cardSize.height }}
                    />
                  ) : (
                    stack.map((card, cardIndex) => (
                      <div
                        key={card.id}
                        className="absolute left-0"
                        style={{
                          top: (stack.length - 1 - cardIndex) * STACK_PEEK_PX,
                          zIndex: cardIndex + 1,
                        }}
                      >
                        <Card
                          card={card}
                          faceDown={true}
                          showGraphics={showGraphics}
                          size={cardSize}
                          disableTilt={true}
                          disableHoverLift={true}
                          disableLegacyShine={true}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
