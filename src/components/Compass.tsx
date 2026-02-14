import { memo, useMemo, useState } from 'react';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import type { WatercolorConfig } from '../watercolor/types';

export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Direction = (typeof DIRECTIONS)[number];

const FULL_TURN_DEG = 360;
const STEP_DEG = FULL_TURN_DEG / DIRECTIONS.length;
const ROTATION_ANIMATION_MS = 1200;
const SHOW_COMPASS_PAINT = false;
const COMPASS_SIZE = 131;

// Watercolor backdrop extends beyond the 154px compass on all sides
const COMPASS_WC_SIZE = 221;

const noop = { count: 0, lengthMin: 0, lengthMax: 0, strokeWidth: 0, swayDuration: 0, swayAngle: 0 };
const noSat = { count: 0, radiusMin: 0, radiusMax: 0, orbitRadius: 0, driftDuration: 0 };
const noAnim = { breatheDuration: 9999, breatheScale: 1.0, highlightShiftDuration: 9999 };

function g(mid: string, mo: number, o: number): WatercolorConfig['splotches'][number] {
  return {
    gradient: { light: mid, mid, dark: mid, lightOpacity: mo, midOpacity: mo, darkOpacity: mo },
    scale: 0,
    offset: [0, 0],
    blendMode: 'screen',
    opacity: o,
    shape: 'circle',
    tendrils: noop,
    satellites: noSat,
    animation: noAnim,
  };
}

// Static rainbow watercolor backdrop config: N=blue, E=pink, S=orange, W=green
const compassWatercolorConfig: WatercolorConfig = {
  splotches: [
    // Central body — soft purple base tying all arms together
    { ...g('#9060c8', 0.75, 0.65), scale: 0.38, offset: [0, 0] },
    // North arm — sky blue
    { ...g('#42b8e8', 0.85, 0.85), scale: 0.32, offset: [0.015, -0.22] },
    // North tip — blue-purple extension
    { ...g('#7848cc', 0.75, 0.70), scale: 0.19, offset: [0.035, -0.32] },
    // Upper-right blend — cyan meets purple
    { ...g('#60a8d8', 0.65, 0.55), scale: 0.2, offset: [0.1, -0.19] },
    // East arm — hot pink / rose
    { ...g('#e85882', 0.85, 0.85), scale: 0.28, offset: [0.23, 0.015] },
    // East extension — lighter pink bleed
    { ...g('#f098b8', 0.70, 0.60), scale: 0.18, offset: [0.32, 0.05] },
    // East-center lavender bridge
    { ...g('#c070d8', 0.65, 0.55), scale: 0.22, offset: [0.1, -0.07] },
    // South arm — vivid orange
    { ...g('#f08028', 0.90, 0.85), scale: 0.32, offset: [0.015, 0.22] },
    // South tip — golden yellow
    { ...g('#f0c030', 0.80, 0.70), scale: 0.2, offset: [0.0, 0.32] },
    // South-west blend — warm amber meets green
    { ...g('#d8a020', 0.65, 0.55), scale: 0.19, offset: [-0.08, 0.2] },
    // West arm — fresh green
    { ...g('#48c868', 0.85, 0.85), scale: 0.28, offset: [-0.23, -0.015] },
    // West lower — yellow-green accent
    { ...g('#90c830', 0.70, 0.65), scale: 0.18, offset: [-0.14, 0.12] },
    // West upper — teal hint blending into blue
    { ...g('#38b8a0', 0.65, 0.55), scale: 0.19, offset: [-0.15, -0.14] },
  ],
  grain: { enabled: true, intensity: 0.04, frequency: 0.08, blendMode: 'soft-light' },
  overallScale: 1.0,
  luminous: false,
};

interface CompassProps {
  value?: Direction;
  onChange?: (direction: Direction) => void;
  mapAlignmentMode?: 'compass' | 'north';
  onMapAlignmentToggle?: () => void;
}

export const Compass = memo(function Compass({
  value,
  onChange,
  mapAlignmentMode,
  onMapAlignmentToggle,
}: CompassProps) {
  const [uncontrolledDirection, setUncontrolledDirection] = useState<Direction>('N');
  const topDirection = value ?? uncontrolledDirection;
  const setTopDirection = (direction: Direction) => {
    if (value === undefined) {
      setUncontrolledDirection(direction);
    }
    onChange?.(direction);
  };
  const topIndex = DIRECTIONS.indexOf(topDirection);
  const rotationDeg = useMemo(() => -(topIndex * STEP_DEG), [topIndex]);
  const center = 50;
  const labelRadius = 46;

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="relative"
        style={{
          width: COMPASS_SIZE,
          height: COMPASS_SIZE,
        }}
      >
        {SHOW_COMPASS_PAINT && (
          <div
            className="absolute pointer-events-none"
            style={{
              width: COMPASS_WC_SIZE,
              height: COMPASS_WC_SIZE,
              left: (COMPASS_SIZE - COMPASS_WC_SIZE) / 2,
              top: (COMPASS_SIZE - COMPASS_WC_SIZE) / 2,
            }}
          >
            <WatercolorOverlay config={compassWatercolorConfig} />
          </div>
        )}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="compass-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f3d7a2" />
              <stop offset="45%" stopColor="#d3aa67" />
              <stop offset="100%" stopColor="#9a723c" />
            </linearGradient>
            <filter id="compass-glow">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g
            style={{
              transformOrigin: '50px 50px',
              transform: `rotate(${rotationDeg}deg)`,
              transition: `transform ${ROTATION_ANIMATION_MS}ms ease`,
            }}
          >
            <circle cx="50" cy="50" r="42" fill="none" stroke="url(#compass-gold)" strokeWidth="1.8" filter="url(#compass-glow)" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="url(#compass-gold)" strokeWidth="1.3" />
            <polygon
              points="50,9 56,43 91,50 56,57 50,91 44,57 9,50 44,43"
              fill="url(#compass-gold)"
              stroke="rgba(75,50,22,0.5)"
              strokeWidth="0.4"
            />
            <polygon
              points="50,17 53,44 83,50 53,56 50,83 47,56 17,50 47,44"
              fill="rgba(255,255,255,0.2)"
            />
            <polygon
              points="50,23 61,39 77,50 61,61 50,77 39,61 23,50 39,39"
              fill="rgba(10, 10, 10, 0.75)"
            />
            <circle cx="50" cy="50" r="2.3" fill="#cda164" />
          </g>
        </svg>
        <div
          className="absolute inset-0"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: `transform ${ROTATION_ANIMATION_MS}ms ease`,
          }}
        >
          {DIRECTIONS.map((direction, index) => {
            const angleDeg = (index * STEP_DEG) - 90;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = center + (Math.cos(angleRad) * labelRadius);
            const y = center + (Math.sin(angleRad) * labelRadius);
            const isTop = direction === topDirection;
            const isMajor = direction.length === 1;
            return (
              <button
                key={direction}
                type="button"
                onClick={() => setTopDirection(direction)}
                className="absolute -translate-x-1/2 -translate-y-1/2 px-[2px] py-[1px] font-bold leading-none"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  borderRadius: 4,
                  border: 'none',
                  color: isTop ? '#fff2d5' : '#e2c086',
                  textShadow: isTop
                    ? '0 0 8px rgba(255, 226, 173, 0.85), 0 1px 2px rgba(0,0,0,0.85)'
                    : '0 0 6px rgba(210, 158, 83, 0.55), 0 1px 2px rgba(0,0,0,0.8)',
                  fontFamily: '"Times New Roman", serif',
                  fontSize: isMajor ? 20 : 9,
                  letterSpacing: isMajor ? '0.03em' : '0.06em',
                  transform: `translate(-50%, -50%) rotate(${-rotationDeg}deg)`,
                  transition: `color 220ms ease, text-shadow 220ms ease, transform ${ROTATION_ANIMATION_MS}ms ease`,
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                }}
                aria-label={`Set ${direction} to 12 o'clock`}
                title={`Set ${direction} to 12 o'clock`}
              >
                {direction}
              </button>
            );
          })}
        </div>
        {mapAlignmentMode && onMapAlignmentToggle && (
          <button
            type="button"
            onClick={onMapAlignmentToggle}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[8px] font-bold tracking-[0.5px] leading-none"
            style={{
              width: 34,
              height: 34,
              borderColor: 'rgba(211, 170, 103, 0.72)',
              color: '#f3d7a2',
              backgroundColor: 'rgba(10, 10, 10, 0.66)',
              textShadow: '0 0 6px rgba(243, 215, 162, 0.45)',
              boxShadow: '0 0 10px rgba(154, 114, 60, 0.35)',
            }}
            aria-label={`Map alignment ${mapAlignmentMode === 'north' ? 'true north' : 'aligned with compass'}. Click to toggle.`}
            title={mapAlignmentMode === 'north'
              ? 'Map alignment: TRUE NORTH. Click to switch to ALIGNED WITH COMPASS.'
              : 'Map alignment: ALIGNED WITH COMPASS. Click to switch to TRUE NORTH.'}
          >
            <span>{mapAlignmentMode === 'north' ? 'TN' : 'AC'}</span>
          </button>
        )}
      </div>
    </div>
  );
});
