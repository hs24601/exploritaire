import { memo } from 'react';

export type ShimmerTextConfig = {
  text: string;
  fontSize: string;
  duration: number;
  baseColor: string;
  glowColor: string;
  fontWeight: number;
};

export const DEFAULT_SHIMMER_TEXT_CONFIG: ShimmerTextConfig = {
  text: "Pure CSS Shimmer",
  fontSize: "3em",
  duration: 2,
  baseColor: "#222222",
  glowColor: "#ffffff",
  fontWeight: 300,
};

type Props = {
  config?: ShimmerTextConfig;
};

export const ShimmerTextEffect = memo(function ShimmerTextEffect({ 
  config = DEFAULT_SHIMMER_TEXT_CONFIG 
}: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <style>{`
        .shimmer-text {
          font-family: "Lato", sans-serif;
          display: inline-block;
          text-align: center;
          color: rgba(255, 255, 255, 0.1);
          background: linear-gradient(to right, ${config.baseColor} 0%, ${config.glowColor} 50%, ${config.baseColor} 100%);
          background-size: 125px 100%;
          background-clip: text;
          -webkit-background-clip: text;
          animation: shimmer-animation ${config.duration}s infinite linear;
          background-repeat: no-repeat;
          background-position: 0 0;
          background-color: ${config.baseColor};
        }

        @keyframes shimmer-animation {
          0% {
            background-position: -125px 0;
          }
          100% {
            background-position: 300px 0;
          }
        }
      `}</style>
      <h1 
        className="shimmer-text select-none"
        style={{ 
          fontSize: config.fontSize,
          fontWeight: config.fontWeight
        }}
      >
        {config.text}
      </h1>
    </div>
  );
});
