import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  className?: string;
};

type BatSpec = {
  duration: number;
  delay: number;
  scale: number;
  yOffset: number;
};

const BAT_PIXELS = `
  45px 15px var(--b), 46px 15px var(--b), 47px 15px var(--a),
  10px 16px var(--a), 11px 16px var(--a), 12px 16px var(--b),
  13px 16px var(--b), 14px 16px var(--b), 15px 16px var(--b),
  16px 16px var(--b), 17px 16px var(--a), 35px 16px var(--a),
  36px 16px var(--a), 37px 16px var(--b), 38px 16px var(--b),
  39px 16px var(--b), 40px 16px var(--b), 41px 16px var(--b),
  42px 16px var(--b), 43px 16px var(--b), 44px 16px var(--b),
  45px 16px var(--b), 46px 16px var(--b), 47px 16px var(--a),
  9px 17px var(--a), 10px 17px var(--b), 11px 17px var(--b),
  12px 17px var(--b), 13px 17px var(--b), 14px 17px var(--b),
  15px 17px var(--b), 16px 17px var(--b), 17px 17px var(--a),
  37px 17px var(--a), 38px 17px var(--a), 39px 17px var(--b),
  40px 17px var(--b), 41px 17px var(--b), 42px 17px var(--b),
  43px 17px var(--b), 44px 17px var(--b), 45px 17px var(--b),
  46px 17px var(--b), 47px 17px var(--b), 48px 17px var(--a),
  49px 17px var(--a), 51px 17px var(--a), 7px 18px var(--a),
  8px 18px var(--a), 9px 18px var(--a), 10px 18px var(--b),
  11px 18px var(--b), 12px 18px var(--b), 13px 18px var(--b),
  14px 18px var(--b), 15px 18px var(--b), 16px 18px var(--b),
  17px 18px var(--a), 20px 18px var(--a), 37px 18px var(--a)
`;

export const BatFlyEffect = memo(function BatFlyEffect({ className }: Props) {
  const bats = useMemo<BatSpec[]>(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        duration: 4 + Math.random() * 6,
        delay: -(Math.random() * 20),
        scale: 0.6 + Math.random() * 1.2,
        yOffset: Math.random() * 80,
      })),
    []
  );

  return (
    <div className={`bat-root w-full h-full relative overflow-hidden ${className ?? ''}`}>
      <style>{`
        .bat-root {
          background: radial-gradient(circle at 50% 50%, #12121a 0%, #050508 100%);
        }
        @keyframes bat-fly-path {
          0% { 
            left: -100px;
            top: var(--bat-y-start);
            opacity: 0;
          }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { 
            left: calc(100% + 100px);
            top: var(--bat-y-end);
            opacity: 0;
          }
        }
        @keyframes bat-flap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.3) skewX(10deg); }
        }
        .bat-container {
          position: absolute;
          animation: bat-fly-path var(--bat-duration) linear infinite;
          animation-delay: var(--bat-delay);
          pointer-events: none;
        }
        .bat {
          width: 1px;
          height: 1px;
          --a: #000;
          --b: #1a1a1a;
          box-shadow: ${BAT_PIXELS};
          transform: scale(var(--bat-scale));
          animation: bat-flap 0.25s ease-in-out infinite;
        }
      `}</style>
      
      {bats.map((bat, i) => (
        <div
          key={i}
          className="bat-container"
          style={
            {
              '--bat-duration': `${bat.duration}s`,
              '--bat-delay': `${bat.delay}s`,
              '--bat-scale': bat.scale,
              '--bat-y-start': `${100 - bat.yOffset}%`,
              '--bat-y-end': `${bat.yOffset - 20}%`,
            } as CSSProperties
          }
        >
          <div className="bat" />
        </div>
      ))}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-20">Active Effect: bat_fly</span>
      </div>
    </div>
  );
});
