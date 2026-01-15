import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { BuildPileProgress, Card } from '../engine/types';
import { SUIT_COLORS, CARD_SIZE } from '../engine/constants';
import {
  getBuildPileDefinition,
  getCurrentElement,
  getRankDisplay,
  getSaplingGrowthLevel,
  canAddToBuildPile,
} from '../engine/buildPiles';
import { getSaplingLightColor } from '../engine/lighting';

interface SaplingProps {
  progress: BuildPileProgress;
  isDropTarget: boolean;
  draggedCard: Card | null;
  onClear: () => void;
}

export const Sapling = memo(function Sapling({
  progress,
  isDropTarget,
  draggedCard,
  onClear,
}: SaplingProps) {
  const definition = getBuildPileDefinition(progress);
  const growthLevel = getSaplingGrowthLevel(progress);
  const lightColor = getSaplingLightColor(growthLevel);
  const neededElement = getCurrentElement(progress);
  const neededRank = progress.currentRank;

  // Check if dragged card is valid
  const canAcceptDrag = draggedCard && definition
    ? canAddToBuildPile(draggedCard, progress, definition)
    : false;

  // Flicker animation state
  const [flickerIntensity, setFlickerIntensity] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFlickerIntensity(0.9 + Math.random() * 0.2);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Calculate sapling size based on growth (scaled to fit in card)
  const baseHeight = 40;
  const maxHeight = 60;
  const height = Math.min(maxHeight, baseHeight + growthLevel * 3);
  const trunkWidth = 3 + growthLevel * 0.3;
  const canopySize = 12 + growthLevel * 3;

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
      {/* Light glow effect behind card */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 160,
          height: 160,
          left: '50%',
          top: CARD_SIZE.height / 2,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${lightColor}${Math.round(0.25 * flickerIntensity * 255).toString(16).padStart(2, '0')} 0%, ${lightColor}00 70%)`,
          zIndex: 0,
        }}
      />

      {/* Cards count above */}
      <div className="text-xs text-game-white opacity-60 mb-2 z-10">
        {progress.cards.length} cards
        {progress.cyclesCompleted > 0 && (
          <span className="ml-1 text-game-gold">
            ({progress.cyclesCompleted} {progress.cyclesCompleted === 1 ? 'cycle' : 'cycles'})
          </span>
        )}
      </div>

      {/* Card container */}
      <motion.div
        data-build-pile-target
        data-build-pile-id={progress.definitionId}
        whileHover={{ scale: 1.05, y: -5 }}
        style={{
          width: CARD_SIZE.width,
          height: CARD_SIZE.height,
          borderColor: getBorderColor(),
          boxShadow: getBoxShadow(),
          transform: isDropTarget && canAcceptDrag ? 'scale(1.05)' : 'scale(1)',
        }}
        className="
          bg-game-bg-dark border-2 rounded-lg
          flex flex-col items-center
          relative overflow-hidden z-10
          transition-all duration-200 cursor-pointer
          p-1
        "
      >
        {/* Title at top */}
        <div
          className="text-[8px] font-bold tracking-wide opacity-60 mb-1"
          style={{
            color: lightColor,
            textShadow: `0 0 6px ${lightColor}66`,
          }}
        >
          {definition?.name.toUpperCase() || 'SAPLING'}
        </div>

        {/* Centered content wrapper */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Sapling SVG */}
          <svg
          width={canopySize * 2 + 10}
          height={height + 10}
          viewBox={`0 0 ${canopySize * 2 + 10} ${height + 10}`}
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

          {/* Next needed indicator */}
          <div
            className="flex items-center gap-1 mb-1"
            style={{
              textShadow: `0 0 8px ${SUIT_COLORS[neededElement]}`,
            }}
          >
            <span className="text-xl">{neededElement}</span>
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
      </motion.div>

      {/* Clear button */}
      {progress.cards.length > 0 && (
        <button
          onClick={onClear}
          className="mt-2 text-xs text-game-pink border border-game-pink px-2 py-1 rounded opacity-40 hover:opacity-100 transition-opacity z-10"
        >
          RESET
        </button>
      )}
    </div>
  );
});
