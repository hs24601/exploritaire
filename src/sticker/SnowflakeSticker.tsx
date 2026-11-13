import { memo, useState, type CSSProperties } from 'react';
import {FlurryFace} from './FlurryFace';
import { TradingCard } from '../proto/components/TradingCard';
import './snowflakeSticker.css';

const assets = `${import.meta.env.BASE_URL}assets/runtime/`;
const sticker = `${assets}ui/stickers/snowflake-v1/`;
const body = `${sticker}ice.png`;
export const FLURRY_PRINT = { body, face: `${sticker}face.png` };
const flakesPerPlane = 7;

function Snowfall({ plane }: { plane: 'rear' | 'front' }) {
  const [flakes] = useState(() => Array.from({ length: flakesPerPlane }, (_, index) => {
    const duration = 4.5 + Math.random() * 5;
    const x = 18 + Math.random() * 64;
    const drift = Math.random() * 46 - 23;
    const sway = (5 + Math.random() * 9) * (index % 2 ? -1 : 1);
    const opacity = (plane === 'front' ? .55 : .25) + Math.random() * .3;
    const intensityAt = (offset: number, y: number) => opacity *
      (2 - Math.min(1, Math.hypot(x + offset - 50, y - 50) / 50));
    return {
      '--fall-duration': `${duration}s`,
      '--fall-delay': `-${duration * (index + Math.random()) / flakesPerPlane}s`,
      '--fall-x': `${x}%`,
      '--fall-drift': `${drift}%`,
      '--fall-sway': `${sway}%`,
      '--fall-spin': `${(90 + Math.random() * 170) * (index % 2 ? -1 : 1)}deg`,
      '--flake-size': `${2.8 + Math.random() * (plane === 'front' ? 3.5 : 2.4)}%`,
      // Match the flutter positions at the three inner animation keyframes.
      '--flake-opacity': opacity,
      '--flake-opacity-upper': intensityAt(drift * .25 + sway, 22),
      '--flake-opacity-middle': intensityAt(drift * .5 - sway * .5, 50),
      '--flake-opacity-lower': intensityAt(drift * .75 + sway * .65, 78),
    } as CSSProperties;
  }));

  return <div className={`flurry-snow flurry-snow--${plane}`} aria-hidden="true">
    {flakes.map((style, index) => <span className="flurry-flake" key={index} style={style} />)}
  </div>;
}

export const FlurryAmbiance = memo(function FlurryAmbiance() {
  return <div className="flurry-ambiance" aria-hidden="true">
    <Snowfall plane="rear" />
    <Snowfall plane="front" />
  </div>;
});

export const SnowflakeSticker = memo(function SnowflakeSticker({ floating = false, interactive = true }: { floating?: boolean; interactive?: boolean }) {
  return (
    <div className="snowflake-surface" data-floating={floating || undefined} style={{ '--sticker-mask': `url("${body}")` } as CSSProperties}>
      <TradingCard
        id="snowflake-sticker"
        title="Flurry"
        state="jumbo"
        hideBody
        lenticular={false}
        interactive={interactive}
        className="snowflake-sticker"
        art={<img src={body} alt="" draggable={false} />}
        cornerAdornment={<FlurryFace className="snowflake-sticker__expression"/>}
      />
    </div>
  );
});
