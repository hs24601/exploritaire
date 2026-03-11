import { memo, useMemo } from 'react';

export type DisassembledTextConfig = {
  text: string;
  inDuration: number;
  outDuration: number;
  inStagger: number;
  outStagger: number;
  rotationRange: number;
  gravity: number;
  velocityMin: number;
  velocityMax: number;
  delayBeforeExplosion: number;
  fontSize: string;
  fontFamily: string;
};

export const DEFAULT_DISASSEMBLED_TEXT_CONFIG: DisassembledTextConfig = {
  text: 'Disassembled',
  inDuration: 1,
  outDuration: 2.5,
  inStagger: 0.03,
  outStagger: 0.015,
  rotationRange: 2000,
  gravity: 800,
  velocityMin: 300,
  velocityMax: 600,
  delayBeforeExplosion: 3,
  fontSize: '4rem',
  fontFamily: '"Rubik Scribble", system-ui, sans-serif',
};

type Props = {
  className?: string;
  config?: DisassembledTextConfig;
};

type CharacterMotion = {
  char: string;
  id: string;
  driftX: number;
  driftY: number;
  rotation: number;
  delay: number;
  duration: number;
};

export const DisassembledTextEffect = memo(function DisassembledTextEffect({
  className,
  config = DEFAULT_DISASSEMBLED_TEXT_CONFIG,
}: Props) {
  const chars = useMemo<CharacterMotion[]>(() => {
    return config.text.split('').map((char, index) => {
      const spread = Math.max(config.velocityMin, config.velocityMax);
      const driftX = ((index % 2 === 0 ? 1 : -1) * (spread * 0.35 + index * 8));
      const driftY = Math.max(160, config.gravity * 0.35) + (index * 12);
      const rotation = ((index % 2 === 0 ? 1 : -1) * (config.rotationRange * 0.18 + index * 14));
      const delay = (index * config.inStagger) + config.delayBeforeExplosion;
      const duration = Math.max(0.6, config.outDuration + index * config.outStagger);
      return {
        char,
        id: `disassembled-${index}-${char}`,
        driftX,
        driftY,
        rotation,
        delay,
        duration,
      };
    });
  }, [config]);

  const totalCycleSeconds = useMemo(() => {
    if (chars.length === 0) return config.inDuration + config.outDuration + config.delayBeforeExplosion;
    const last = chars[chars.length - 1];
    return Math.max(
      config.inDuration + (chars.length * config.inStagger),
      last.delay + last.duration,
    );
  }, [chars, config.delayBeforeExplosion, config.inDuration, config.outDuration]);

  return (
    <h1
      className={`absolute left-1/2 top-1/2 m-0 w-max -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-white ${className ?? ''}`}
      style={{
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
      }}
    >
      {chars.map((entry, index) => (
        <span
          key={entry.id}
          className="inline-block whitespace-pre"
          style={{
            animationName: 'disassembled-text-cycle',
            animationDuration: `${totalCycleSeconds}s`,
            animationDelay: `${index * config.inStagger}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
            transformOrigin: 'center center',
            ['--disassembled-end-x' as string]: `${entry.driftX}px`,
            ['--disassembled-end-y' as string]: `${entry.driftY}px`,
            ['--disassembled-rotate' as string]: `${entry.rotation}deg`,
            ['--disassembled-in-duration' as string]: `${Math.max(0.2, config.inDuration)}s`,
            ['--disassembled-out-start' as string]: `${Math.max(0, entry.delay / totalCycleSeconds) * 100}%`,
          }}
        >
          {entry.char === ' ' ? '\u00A0' : entry.char}
        </span>
      ))}
      <style>
        {`
          @keyframes disassembled-text-cycle {
            0% {
              opacity: 0;
              transform: translate3d(0, 100px, 0) rotate(90deg);
            }
            12% {
              opacity: 1;
              transform: translate3d(0, 0, 0) rotate(0deg);
            }
            58% {
              opacity: 1;
              transform: translate3d(0, 0, 0) rotate(0deg);
            }
            100% {
              opacity: 0;
              transform: translate3d(var(--disassembled-end-x), var(--disassembled-end-y), 0) rotate(var(--disassembled-rotate));
            }
          }
        `}
      </style>
    </h1>
  );
});
