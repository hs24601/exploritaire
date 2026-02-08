import { memo, useMemo } from 'react';
import type { TableauNode } from '../engine/types';
import { Card } from './Card';
import { CARD_SIZE } from '../engine/constants';

interface NodeEdgeTableauProps {
  nodes: TableauNode[];
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  showGraphics: boolean;
}

export const NodeEdgeTableau = memo(function NodeEdgeTableau({
  nodes,
  onNodeClick,
  selectedNodeId,
  canvasWidth,
  canvasHeight,
  showGraphics,
}: NodeEdgeTableauProps) {

  // Transform pattern positions (centered at 0,0) to canvas coords
  // Round to avoid subpixel rendering blur
  const transformPosition = (x: number, y: number) => ({
    x: Math.round(canvasWidth / 2 + x),
    y: Math.round(canvasHeight / 2 + y),
  });

  // Sort nodes by z-index for proper layering
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => a.position.z - b.position.z);
  }, [nodes]);

  return (
    <div
      className="relative"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'subpixel-antialiased',
      }}
    >
      {sortedNodes.map(node => {
        const pos = transformPosition(node.position.x, node.position.y);
        return (
          <NodeStack
            key={node.id}
            node={node}
            position={pos}
            isSelected={node.id === selectedNodeId}
            onClick={() => node.revealed && onNodeClick(node.id)}
            showGraphics={showGraphics}
          />
        );
      })}
    </div>
  );
});

interface NodeStackProps {
  node: TableauNode;
  position: { x: number; y: number };
  isSelected: boolean;
  onClick: () => void;
  showGraphics: boolean;
}

const NodeStack = memo(function NodeStack({
  node,
  position,
  isSelected,
  onClick,
  showGraphics,
}: NodeStackProps) {
  const cardCount = node.cards.length;
  const topCard = cardCount > 0 ? node.cards[cardCount - 1] : null;

  // Calculate z-index: revealed/playable cards should always be on top
  const zIndex = node.position.z * 100 + cardCount + (node.revealed && cardCount > 0 ? 10000 : 0);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        zIndex,
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'subpixel-antialiased',
        WebkitTransform: 'translate3d(0, 0, 0)',
        imageRendering: '-webkit-optimize-contrast',
      }}
    >
      {/* Depth indicator shadows */}
      {cardCount > 1 && (
        <>
          {[...Array(Math.min(cardCount - 1, 3))].map((_, i) => (
            <div
              key={`shadow-${i}`}
              className="absolute bg-gray-800 rounded-lg"
              style={{
                width: CARD_SIZE.width,
                height: CARD_SIZE.height,
                left: (i + 1) * 3,
                top: (i + 1) * 3,
                zIndex: -i - 1,
                opacity: 0.3 - i * 0.1,
              }}
            />
          ))}
        </>
      )}

      {/* Top card */}
      {topCard && (
        <Card
          key={`${node.id}-${topCard.id}-${node.revealed ? 'face-up' : 'face-down'}`}
          card={topCard}
          faceDown={!node.revealed}
          canPlay={node.revealed}
          isSelected={isSelected}
          onClick={node.revealed ? onClick : undefined}
          showGraphics={showGraphics}
        />
      )}

      {/* Card count badge */}
      {cardCount > 1 && (
        <div
          className="absolute -top-2 -right-2 bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
          style={{ zIndex: 10 }}
        >
          {cardCount}
        </div>
      )}
    </div>
  );
});
