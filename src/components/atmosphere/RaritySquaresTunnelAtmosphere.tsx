import { memo, useMemo } from 'react';
import { NEON_COLORS } from '../../utils/styles';

type Props = {
  className?: string;
};

const RARITIES = [
  { color: '#94a3b8', glow: '#94a3b8' }, // Common
  { color: NEON_COLORS.teal, glow: NEON_COLORS.teal }, // Uncommon
  { color: NEON_COLORS.blue, glow: NEON_COLORS.blue }, // Rare
  { color: NEON_COLORS.purple, glow: NEON_COLORS.purple }, // Epic
  { color: NEON_COLORS.gold, glow: NEON_COLORS.gold }, // Legendary
  { color: NEON_COLORS.pink, glow: NEON_COLORS.pink }, // Mythic
];

const LAYER_QUANTITY = 24;
const PARTICLES_PER_LAYER = 8;

export const RaritySquaresTunnelAtmosphere = memo(function RaritySquaresTunnelAtmosphere({ className }: Props) {
  const layerData = useMemo(() => {
    return Array.from({ length: LAYER_QUANTITY + 1 }).map((_, i) => ({
      particles: Array.from({ length: PARTICLES_PER_LAYER }).map(() => ({
        top: `${Math.random() * 200 - 50}%`,
        left: `${Math.random() * 200 - 50}%`,
        size: `${Math.random() * 4 + 1}px`,
        opacity: Math.random() * 0.8 + 0.2,
        delay: Math.random() * 2,
      }))
    }));
  }, []);

  return (
    <div className={`tunnel-root ${className}`}>
      <style>{`
        .tunnel-root {
          pointer-events: none;
          transform: translateZ(-1000px);
          transform-style: preserve-3d;
        }

        .tunnel-inner {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 25vmin;
          overflow: hidden;
          --animation-duration: ${LAYER_QUANTITY}s;
          --animation-delay-between-squares: 1s;
        }

        .tunnel-layer {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          animation: tunnel-rotation var(--animation-duration) infinite linear;
          animation-delay: calc(var(--delay) * var(--animation-delay-between-squares) * -1);
          pointer-events: none;
        }

        .tunnel-square {
          width: 35vmin;
          height: 35vmin;
          position: absolute;
          border-radius: 4vmin;
          border: 2px solid var(--color);
          box-shadow: 
            0 0 20px 2px var(--color),
            inset 0 0 15px var(--color);
          background: radial-gradient(circle at center, var(--color) 0%, transparent 70%);
          opacity: 0;
          animation: square-reveal var(--animation-duration) infinite linear;
          animation-delay: inherit;
        }

        .tunnel-particle {
          position: absolute;
          border-radius: 50%;
          background: var(--color);
          box-shadow: 0 0 8px var(--color);
          opacity: 0;
          animation: square-reveal var(--animation-duration) infinite linear;
          animation-delay: inherit;
        }

        @keyframes tunnel-rotation {
          0% {
            transform: translateZ(-100vmin) rotateZ(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateZ(25vmin) rotateZ(180deg);
            opacity: 0;
          }
        }

        @keyframes square-reveal {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      
      <div className="tunnel-inner">
        {layerData.map((data, i) => {
          const rarity = RARITIES[i % RARITIES.length];
          return (
            <div
              key={i}
              className="tunnel-layer"
              style={{
                '--color': rarity.color,
                '--delay': i,
              } as any}
            >
              <div className="tunnel-square" />
              {data.particles.map((p, pi) => (
                <div
                  key={pi}
                  className="tunnel-particle"
                  style={{
                    top: p.top,
                    left: p.left,
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                    animationDelay: `calc(${(i * -1)}s + ${p.delay}s)`,
                  }}
                />
              ))}
            </div>
          );
        })}
        <div className="absolute w-20 h-20 bg-black rounded-full blur-xl z-[-10]" />
      </div>
    </div>
  );
});
