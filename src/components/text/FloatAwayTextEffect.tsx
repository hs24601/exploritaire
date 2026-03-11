import { memo, useMemo } from 'react';

export type FloatAwayTextConfig = {
  text: string;
  fontSize: string;
  entranceDuration: number;
  entranceRotation: number;
  entranceEase: string;
  floatDelay: number;
  minSpeed: number;
  maxSpeed: number;
};

export const DEFAULT_FLOAT_AWAY_TEXT_CONFIG: FloatAwayTextConfig = {
  text: 'Floating!',
  fontSize: '80px',
  entranceDuration: 2.5,
  entranceRotation: 90,
  entranceEase: 'elastic.out(1, 0.3)',
  floatDelay: 1.5,
  minSpeed: 0.5,
  maxSpeed: 2.0,
};

type Props = {
  config?: FloatAwayTextConfig;
};

type FloatingChar = {
  char: string;
  id: string;
  driftX: number;
  driftY: number;
  rotation: number;
  delay: number;
  duration: number;
};

export const FloatAwayTextEffect = memo(function FloatAwayTextEffect({
  config = DEFAULT_FLOAT_AWAY_TEXT_CONFIG,
}: Props) {
  const chars = useMemo<FloatingChar[]>(() => {
    return config.text.split('').map((char, index) => {
      const speed = config.minSpeed + ((index % 5) / 4) * Math.max(0.01, config.maxSpeed - config.minSpeed);
      const duration = 10 + (1 / speed) * 15;
      const directionX = index % 2 === 0 ? 1 : -1;
      const directionY = index % 3 === 0 ? -1 : 1;
      return {
        char,
        id: `float-away-${index}-${char}`,
        driftX: directionX * (220 + index * 24),
        driftY: directionY * (140 + (index % 4) * 32),
        rotation: directionX * (360 + index * 55),
        delay: config.floatDelay + (index * 0.1),
        duration,
      };
    });
  }, [config]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <h1
        className="m-0 whitespace-nowrap text-center text-white select-none"
        style={{
          fontFamily: '"Rubik Scribble", "Arial Black", sans-serif',
          fontSize: config.fontSize,
          perspective: '1000px',
        }}
      >
        {chars.map((entry) => (
          <span
            key={entry.id}
            className="inline-block"
            style={{
              display: entry.char === ' ' ? 'inline' : 'inline-block',
              willChange: 'transform, opacity',
              animationName: 'float-away-char',
              animationDuration: `${Math.max(config.entranceDuration + entry.duration, 1)}s`,
              animationDelay: `${entry.delay}s`,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
              animationFillMode: 'both',
              ['--float-away-x' as string]: `${entry.driftX}px`,
              ['--float-away-y' as string]: `${entry.driftY}px`,
              ['--float-away-rotate' as string]: `${entry.rotation}deg`,
              ['--float-away-entrance-rotate' as string]: `${config.entranceRotation}deg`,
            }}
          >
            {entry.char === ' ' ? '\u00A0' : entry.char}
          </span>
        ))}
      </h1>
      <style>
        {`
          @keyframes float-away-char {
            0% {
              opacity: 0;
              transform: translate3d(0, 100px, 0) rotate(var(--float-away-entrance-rotate)) scale(0);
            }
            14% {
              opacity: 1;
              transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
            }
            36% {
              opacity: 1;
              transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate3d(var(--float-away-x), var(--float-away-y), 0) rotate(var(--float-away-rotate)) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
});
