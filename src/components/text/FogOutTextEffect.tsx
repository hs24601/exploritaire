import { memo } from 'react';

export type FogOutTextConfig = {
  text: string;
  fontSize: string;
  duration: number;
  color: string;
  blurSize: string;
};

export const DEFAULT_FOG_OUT_TEXT_CONFIG: FogOutTextConfig = {
  text: "Fog Field...",
  fontSize: "32px",
  duration: 5,
  color: "#ffffff",
  blurSize: "20px",
};

type Props = {
  config?: FogOutTextConfig;
};

export const FogOutTextEffect = memo(function FogOutTextEffect({ 
  config = DEFAULT_FOG_OUT_TEXT_CONFIG 
}: Props) {
  const characters = config.text.split('').map(char => char === ' ' ? '\u00A0' : char);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <style>{`
        .fog-out-container {
          display: inline-block;
          text-align: center;
          font-family: sans-serif;
        }

        .fog-out-char {
          display: inline-block;
          text-shadow: 0 0 0 ${config.color};
          color: transparent;
          font-size: ${config.fontSize};
          transition: ease all .5s;
          animation: fogOutEffect ${config.duration}s infinite;
        }

        @keyframes fogOutEffect {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            text-shadow: 0 0 0 ${config.color};
            opacity: 1;
          }
          40% {
            opacity: .35;
          }
          50% {
            transform: translate3d(.5em, 0, 0) scale(1.1);
            text-shadow: 0 0 ${config.blurSize} ${config.color};
          }
          75% {
            transform: translate3d(0, 0, 0) scale(1);
            text-shadow: 0 0 0 ${config.color};
            opacity: 1;
          }
        }
      `}</style>
      <div className="fog-out-container select-none">
        {characters.map((char, i) => (
          <span 
            key={i} 
            className="fog-out-char"
            style={{ animationDelay: `${i / 10}s` }}
          >
            {char}
          </span>
        ))}
      </div>
    </div>
  );
});
