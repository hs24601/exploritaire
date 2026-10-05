import { memo, useMemo } from 'react';

export type StarsTwinkleConfig = {
  starCount: number;
  glowColor: string;
};

export const DEFAULT_STARS_TWINKLE_CONFIG: StarsTwinkleConfig = {
  starCount: 500,
  glowColor: '#1effad',
};

type Props = {
  className?: string;
  config?: StarsTwinkleConfig;
};

export const StarsTwinklePerformantAtmosphere = memo(function StarsTwinklePerformantAtmosphere({
  className,
  config = DEFAULT_STARS_TWINKLE_CONFIG,
}: Props) {
  const stars = useMemo(() => {
    return Array.from({ length: config.starCount }).map((_, i) => ({
      id: i,
      top: Math.random() * 100, // Using percentage for responsiveness
      left: Math.random() * 100,
      duration: Math.random() * 10 + 0.2,
    }));
  }, [config.starCount]);

  // Extract RGB for the hover box-shadow effect
  const rgb = useMemo(() => {
    const hex = config.glowColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
  }, [config.glowColor]);

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden ${className ?? ''}`}>
      <style>{`
        .stp-star {
          position: absolute;
          padding: 20px;
          border-radius: 64px;
          display: flex;
          justify-content: center;
          align-items: center;
          transform: translate(-50%, -50%);
          cursor: pointer;
        }
        .stp-glow {
          width: 2px;
          height: 2px;
          border-radius: 50%;
          transition: box-shadow 1s, background-color 0.3s;
        }
        @keyframes stp-twinkle {
          0% { background-color: #000000; }
          100% { background-color: #ffffff; }
        }
        .stp-star:hover .stp-glow {
          background-color: white !important;
          animation: none !important;
          box-shadow: 
            rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5) 0px 0px 0 0,
            rgba(${Math.round(rgb.r * 5/6)}, ${Math.round(rgb.g * 5/6)}, ${Math.round(rgb.b * 5/6)}, 0.5) 0px 0px 20px 20px,
            rgba(${Math.round(rgb.r * 4/6)}, ${Math.round(rgb.g * 4/6)}, ${Math.round(rgb.b * 4/6)}, 0.5) 0px 0px 40px 40px,
            rgba(${Math.round(rgb.r * 3/6)}, ${Math.round(rgb.g * 3/6)}, ${Math.round(rgb.b * 3/6)}, 0.5) 0px 0px 80px 80px,
            rgba(${Math.round(rgb.r * 2/6)}, ${Math.round(rgb.g * 2/6)}, ${Math.round(rgb.b * 2/6)}, 0.5) 0px 0px 160px 160px,
            rgba(${Math.round(rgb.r * 1/6)}, ${Math.round(rgb.g * 1/6)}, ${Math.round(rgb.b * 1/6)}, 0.5) 0px 0px 320px 320px,
            rgba(0, 0, 0, 0.5) 0px 0px 640px 640px;
          z-index: 100;
        }
      `}</style>
      {stars.map((star) => (
        <div
          key={star.id}
          className="stp-star"
          style={{ top: `${star.top}%`, left: `${star.left}%` }}
        >
          <div
            className="stp-glow"
            style={{
              animation: `stp-twinkle ${star.duration}s infinite alternate`,
            }}
          />
        </div>
      ))}
    </div>
  );
});
