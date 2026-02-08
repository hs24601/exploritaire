import { memo, useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import type { Die as DieType } from '../engine/types';

interface DieProps {
  die: DieType;
  onToggleLock?: () => void;
  onClick?: () => void;
  size?: number; // Size in pixels
}

const DIE_FACE_DOTS: Record<number, number[][]> = {
  1: [[1, 1]], // Center dot
  2: [[0, 0], [2, 2]], // Diagonal
  3: [[0, 0], [1, 1], [2, 2]], // Diagonal with center
  4: [[0, 0], [0, 2], [2, 0], [2, 2]], // Four corners
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], // Four corners + center
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]], // Two columns
};

// Rotation angles for each face to be front-facing when that value is shown
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: 180 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

export const Die = memo(function Die({ die, onToggleLock, onClick, size = 60 }: DieProps) {
  const handleClick = () => {
    if (onClick) onClick();
    if (onToggleLock) onToggleLock();
  };

  // Generate random spin when rolling
  const rollAnimation = useMemo(() => {
    if (!die.rolling) return FACE_ROTATIONS[die.value];

    // Add multiple full rotations for dramatic effect
    const extraSpins = 3 + Math.floor(Math.random() * 2); // 3-4 full rotations
    const randomAxis = Math.random() > 0.5 ? 'x' : 'y';

    return {
      x: FACE_ROTATIONS[die.value].x + (randomAxis === 'x' ? extraSpins * 360 : 0),
      y: FACE_ROTATIONS[die.value].y + (randomAxis === 'y' ? extraSpins * 360 : 0),
    };
  }, [die.value, die.rolling]);

  return (
    <div
      className="relative inline-block cursor-pointer"
      style={{ width: size, height: size, perspective: size * 4 }}
      onClick={handleClick}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{
          rotateX: rollAnimation.x,
          rotateY: rollAnimation.y,
        }}
        transition={{
          duration: die.rolling ? 0.6 : 0.3,
          ease: die.rolling ? [0.34, 1.56, 0.64, 1] : 'easeOut',
        }}
      >
        {/* Render all 6 faces */}
        <DieFace value={1} size={size} transform="rotateY(0deg)" />
        <DieFace value={2} size={size} transform="rotateY(180deg)" />
        <DieFace value={3} size={size} transform="rotateY(90deg)" />
        <DieFace value={4} size={size} transform="rotateY(-90deg)" />
        <DieFace value={5} size={size} transform="rotateX(90deg)" />
        <DieFace value={6} size={size} transform="rotateX(-90deg)" />
      </motion.div>

      {/* Lock indicator overlay */}
      {die.locked && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
        >
          <div className="text-2xl drop-shadow-lg">🔒</div>
        </motion.div>
      )}
    </div>
  );
});

interface DieFaceProps {
  value: number;
  size: number;
  transform: string;
}

const DieFace = memo(function DieFace({ value, size, transform }: DieFaceProps) {
  const dots = DIE_FACE_DOTS[value] || [];
  const halfSize = size / 2;
  const maskId = useId();
  const glowId = useId();
  const pipCenters = useMemo(() => {
    const cell = 80 / 3;
    const offset = 10;
    return dots.map(([row, col]) => ({
      x: offset + (col + 0.5) * cell,
      y: offset + (row + 0.5) * cell,
    }));
  }, [dots]);
  const pipRadius = 6;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center border-2 border-gray-800 rounded-lg shadow-xl"
      style={{
        backgroundColor: '#14151a',
        transform: `${transform} translateZ(${halfSize}px)`,
        backfaceVisibility: 'hidden',
      }}
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox="0 0 100 100"
        style={{ zIndex: 1 }}
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
          <mask id={maskId}>
            <rect width="100" height="100" fill="white" />
            {pipCenters.map((pip, index) => (
              <circle key={index} cx={pip.x} cy={pip.y} r={pipRadius} fill="black" />
            ))}
          </mask>
        </defs>
        <g filter={`url(#${glowId})`} opacity={0.95}>
          {pipCenters.map((pip, index) => (
            <circle key={index} cx={pip.x} cy={pip.y} r={pipRadius} fill="rgba(250, 250, 255, 1)" />
          ))}
        </g>
        <rect width="100" height="100" fill="rgba(6, 6, 10, 0.85)" mask={`url(#${maskId})`} />
      </svg>
      <div className="relative w-4/5 h-4/5 grid grid-cols-3 grid-rows-3 gap-1">
        {Array.from({ length: 9 }).map((_, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          const hasDot = dots.some(([r, c]) => r === row && c === col);

          return (
            <div key={idx} className="flex items-center justify-center">
              {hasDot && (
                <div
                  className="rounded-full"
                  style={{
                    width: size * 0.12,
                    height: size * 0.12,
                    background: '#f9fafb',
                    boxShadow: '0 0 16px rgba(248, 250, 252, 1), inset 0 0 4px rgba(255,255,255,1)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
