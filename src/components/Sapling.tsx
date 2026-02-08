import { memo } from 'react';
import { motion } from 'framer-motion';
import type { BuildPileProgress, Card } from '../engine/types';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay } from '../engine/constants';
import {
  getBuildPileDefinition,
  getCurrentElement,
  getSaplingGrowthLevel,
  canAddToBuildPile,
} from '../engine/buildPiles';
import { getRankDisplay } from '../engine/rules';
import { getSaplingLightColor } from '../engine/lighting';
import { getTileTitleLayout } from '../utils/tileTitle';
import { CardFrame } from './card/CardFrame';

interface SaplingProps {
  progress: BuildPileProgress;
  isDropTarget: boolean;
  draggedCard: Card | null;
  onClear: () => void;
  showGraphics: boolean;
  size?: { width: number; height: number };
}

export const Sapling = memo(function Sapling({
  progress,
  isDropTarget,
  draggedCard,
  onClear,
  showGraphics,
  size,
}: SaplingProps) {
  const definition = getBuildPileDefinition(progress);
  const growthLevel = getSaplingGrowthLevel(progress);
  const lightColor = getSaplingLightColor(growthLevel);
  const neededElement = getCurrentElement(progress);
  const neededRank = progress.currentRank;
  const neededDisplay = getSuitDisplay(neededElement, showGraphics);
  const displayName = (definition?.name || 'Sapling').toUpperCase();
  const frameSize = size ?? CARD_SIZE;
  const sizeScale = frameSize.height / CARD_SIZE.height;
  const { line1, line2, titleFontSize, titleLetterSpacing } = getTileTitleLayout(
    displayName,
    frameSize.width,
    1
  );

  // Check if dragged card is valid
  const canAcceptDrag = draggedCard && definition
    ? canAddToBuildPile(draggedCard, progress, definition)
    : false;

  // Calculate sapling size based on growth (scaled to fit in card)
  const baseHeight = 40 * sizeScale;
  const maxHeight = 60 * sizeScale;
  const height = Math.min(maxHeight, baseHeight + growthLevel * 3 * sizeScale);
  const trunkWidth = (3 + growthLevel * 0.3) * sizeScale;
  const canopySize = (12 + growthLevel * 3) * sizeScale;

  const getBorderColor = () => {
    if (isDropTarget && canAcceptDrag) return SUIT_COLORS[neededElement];
    return lightColor;
  };

  const getBoxShadow = () => {
    if (isDropTarget && canAcceptDrag) {
      return `0 0 20px ${SUIT_COLORS[neededElement]}, inset 0 0 15px ${SUIT_COLORS[neededElement]}22`;
    }
    return `0 0 15px ${lightColor}66, inset 0 0 15px ${lightColor}11`;
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Card container */}
      <CardFrame
        size={frameSize}
        borderColor={getBorderColor()}
        boxShadow={getBoxShadow()}
        whileHover={{ scale: 1.05, y: -5 }}
        dataAttributes={{
          'data-build-pile-target': 'true',
          'data-build-pile-id': progress.definitionId,
        }}
        className="flex flex-col items-center relative overflow-hidden transition-all duration-200 cursor-pointer p-2"
        style={{
          transform: isDropTarget && canAcceptDrag ? 'scale(1.05)' : 'scale(1)',
        }}
      >

        {/* Title at top */}
        <div
          data-tile-title
          className="w-full text-center font-bold mb-1"
          style={{
            padding: '2px 4px',
            backgroundColor: 'rgba(10, 10, 10, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            backdropFilter: 'blur(2px)',
            fontSize: `${titleFontSize}px`,
            color: lightColor,
            textShadow: `0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px ${lightColor}66`,
            lineHeight: '0.95',
            overflow: 'hidden',
            textOverflow: 'clip',
            letterSpacing: titleLetterSpacing,
            zIndex: 1,
          }}
        >
          <div>{line1}</div>
          {line2 && <div>{line2}</div>}
        </div>

        {/* Centered content wrapper */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {showGraphics ? (
            <svg
              width={canopySize * 2 + 10 * sizeScale}
              height={height + 10 * sizeScale}
              viewBox={`0 0 ${canopySize * 2 + 10 * sizeScale} ${height + 10 * sizeScale}`}
              className="mb-1"
              style={{
                filter: `drop-shadow(0 0 ${6 + growthLevel}px ${lightColor})`,
              }}
            >
              {/* Trunk */}
              <rect
                x={(canopySize + 5) - trunkWidth / 2}
                y={height - 20}
                width={trunkWidth}
                height={25}
                fill="#8B4513"
                rx={1}
              />

              {/* Canopy layers based on growth */}
              {growthLevel === 0 ? (
                // Seedling - just a sprout
                <>
                  <ellipse
                    cx={canopySize + 5}
                    cy={height - 22}
                    rx={6}
                    ry={8}
                    fill={lightColor}
                    opacity={0.9}
                  />
                  <path
                    d={`M${canopySize + 2} ${height - 20} Q${canopySize + 5} ${height - 32} ${canopySize + 8} ${height - 20}`}
                    fill={lightColor}
                    opacity={0.7}
                  />
                </>
              ) : (
                // Growing tree - multiple layers
                <>
                  {/* Bottom layer */}
                  <ellipse
                    cx={canopySize + 5}
                    cy={height - 25}
                    rx={canopySize * 0.9}
                    ry={canopySize * 0.4}
                    fill={lightColor}
                    opacity={0.7}
                  />
                  {/* Middle layer */}
                  <ellipse
                    cx={canopySize + 5}
                    cy={height - 25 - canopySize * 0.3}
                    rx={canopySize * 0.7}
                    ry={canopySize * 0.35}
                    fill={lightColor}
                    opacity={0.8}
                  />
                  {/* Top layer */}
                  <ellipse
                    cx={canopySize + 5}
                    cy={height - 25 - canopySize * 0.55}
                    rx={canopySize * 0.5}
                    ry={canopySize * 0.3}
                    fill={lightColor}
                    opacity={0.9}
                  />
                  {/* Highlight */}
                  <ellipse
                    cx={canopySize + 2}
                    cy={height - 25 - canopySize * 0.5}
                    rx={canopySize * 0.15}
                    ry={canopySize * 0.1}
                    fill="#ffffff"
                    opacity={0.3}
                  />
                </>
              )}
            </svg>
          ) : (
            <div
              data-tile-text
              className="text-xs font-bold tracking-widest mb-1"
              style={{
                color: lightColor,
                textShadow: `0 0 8px ${lightColor}`,
              }}
            >
              SAPLING
            </div>
          )}

          {/* Next needed indicator */}
          <div
            data-tile-text
            className="flex items-center gap-1 mb-1"
            style={{
              textShadow: `0 0 8px ${SUIT_COLORS[neededElement]}`,
            }}
          >
            <span className="text-xl">{neededDisplay}</span>
            <span
              className="text-lg font-bold"
              style={{ color: SUIT_COLORS[neededElement] }}
            >
              {getRankDisplay(neededRank)}
            </span>
          </div>

          {/* Growth level indicator */}
          {growthLevel > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              data-tile-text
              className="text-[10px] tracking-wider font-bold"
              style={{
                color: lightColor,
                textShadow: `0 0 6px ${lightColor}`,
              }}
            >
              LVL {growthLevel}
            </motion.div>
          )}
        </div>
      </CardFrame>

      {/* Clear button */}
      {progress.cards.length > 0 && (
        <button
          data-card-face
          onClick={onClear}
          className="mt-2 text-xs text-game-pink border border-game-pink px-2 py-1 rounded opacity-40 hover:opacity-100 transition-opacity z-10"
        >
          RESET
        </button>
      )}
    </div>
  );
});
