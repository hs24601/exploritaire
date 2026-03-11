import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  className?: string;
};

type BlossomSpec = {
  cx: string;
  cy: string;
  r: number;
  delay: number;
  duration: number;
};

export const FlowerFallEffect = memo(function FlowerFallEffect({ className }: Props) {
  const center_x = 500;
  const center_y = 350;
  const radius = 350;
  const angle = 0.5;

  const blossoms = useMemo<BlossomSpec[]>(() => {
    return Array.from({ length: 12 }, (_, n) => {
      const r = 100 - 5 * n;
      const cx = (center_x + Math.cos(angle * n) * (radius - 20 * n)).toFixed(1);
      const cy = (center_y + Math.sin(angle * n) * (radius - 20 * n)).toFixed(1);
      return {
        cx,
        cy,
        r,
        delay: Math.random() * 5 * -0.6,
        duration: (Math.random() * 3 + 1) * 4,
      };
    });
  }, []);

  return (
    <div className={`flower-fall-root w-full h-full relative overflow-hidden flex flex-col items-center justify-center ${className ?? ''}`}>
      <style>{`
        .flower-fall-root {
          background: hsl(200, 60%, 20%);
        }
        .peddle-center {
          stop-color: hsl(320, 100%, 95%);
        }
        .peddle-outside {
          stop-color: hsl(320, 100%, 85%);
        }
        .peddle {
          transform: rotateY(0deg) rotateZ(0deg) scale(1);
          animation: bloom 5s ease-in-out infinite;
        }
        .blossom {
          animation: blossom 5s ease-in-out infinite;
        }
        @keyframes blossom {
          0% {
            transform: translate(-100px, -100px);
          }
          100% {
            transform: translate(100px, 100px) rotate(20deg);
          }
        }
        @keyframes bloom {
          0% {
            transform: rotateY(90deg) rotateZ(72deg) scale(0);
          }
          50% {
            transform: rotateY(0deg) rotateZ(0deg) scale(1);
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(40px, 40px) rotate3d(1, 0.5, 1, 90deg);
          }
        }
        .title-bloom {
          height: 10vh;
          line-height: 10vh;
          font-size: 8vh;
          padding: 2.5vh;
          margin: 0;
          color: hsl(200, 20%, 90%);
          border-top: 1px solid;
          border-bottom: 1px solid;
          font-family: 'Unica One', cursive;
          z-index: 10;
        }
      `}</style>

      <svg viewBox="0 0 1000 1000" className="w-full h-[80vh]">
        <defs>
          <radialGradient id="blossom-gradient" cx="0.25" cy="-44" r="61.5081" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="peddle-center" />
            <stop offset="1" className="peddle-outside" />
          </radialGradient>
          <symbol id="blossom-symbol" viewBox="-32.2 -55.9 64.5 111.7">
            <path
              fill="url(#blossom-gradient)"
              className="peddle-gradient"
              d="M32.2,0c0-23.9-13-44.7-32.2-55.9C-19.3-44.7-32.2-23.9-32.2,0s13,44.7,32.2,55.9C19.3,44.7,32.2,23.9,32.2,0z"
            />
          </symbol>
        </defs>

        {blossoms.map((b, i) => (
          <g
            key={i}
            className="blossom"
            style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.duration}s` } as CSSProperties}
          >
            {[0, 72, 144, 216, 288].map((rot, p) => (
              <g key={p} transform={`rotate(${rot},${b.cx},${b.cy})`} className="peddle-group">
                <use
                  xlinkHref="#blossom-symbol"
                  className="peddle"
                  x={parseFloat(b.cx) - b.r / 2}
                  y={b.cy}
                  width={b.r}
                  height={b.r}
                  style={
                    {
                      transformOrigin: `${b.cx}px ${b.cy}px`,
                      animationDelay: `${b.delay}s`,
                      animationDuration: `${b.duration}s`,
                    } as CSSProperties
                  }
                />
              </g>
            ))}
          </g>
        ))}
      </svg>

      <div className="title-bloom">bloom</div>

      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center pointer-events-none">
        <span className="text-white font-mono text-[10px] uppercase tracking-widest opacity-20">Active Effect: flower_fall</span>
      </div>
    </div>
  );
});
