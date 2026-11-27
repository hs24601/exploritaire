import { useMemo, type CSSProperties } from 'react';
import type { GameState } from '../rules/game';
import { rng } from '../rules/golf';
import { dayLength } from '../rules/village';
import { DAY_CYCLE_MINUTES } from '../rules/daylight';

export type PuzzleClock = Pick<GameState, 'day' | 'minutes' | 'night' | 'village'>;
const TWILIGHT_MINUTES = 120;

const starRandom = rng(426);
const stars = Array.from({ length: 96 }, () => ({
  left: `${starRandom() * 100}%`, top: `${starRandom() * 100}%`, opacity: .33 + starRandom() * .65,
}));

function paintClouds(day: number) {
  const random = rng(Math.imul(day, 0x9e3779b1));
  const count = 9 + Math.floor(random() * 7);
  return Array.from({ length: count }, (_, index) => {
    const depth = random();
    const width = 13 + depth * 24 + random() * 6;
    const top = 8 + (1 - depth) * 30 + (random() - .5) * 22;
    const birth = (day - 1 + (index + random()) / count) * DAY_CYCLE_MINUTES;
    const lifetime = (11 + (1 - depth) * 7 + random() * 4) * 60;
    const strokes = Array.from({ length: 12 }, (_, i) => {
      const x = 9 + i * 7.4;
      const crown = Math.sin(Math.PI * x / 100);
      return {
        left: `${x + (random() - .5) * 9}%`,
        top: `${66 - crown * (12 + random() * 38)}%`,
        width: `${21 + random() * 23}%`,
        height: `${28 + crown * (20 + random() * 38)}%`,
        rotate: `${(random() - .5) * 26}deg`,
        opacity: .42 + random() * .56,
      };
    });
    return { key: `${day}:${index}`, depth, width, top, birth, lifetime, strokes };
  });
}

export function PuzzleAtmosphere({ clock, terrainStyle, aspen = false, shiftX = 0, shiftY = 0 }: {
  clock: PuzzleClock; terrainStyle?: CSSProperties; aspen?: boolean; shiftX?: number; shiftY?: number;
}) {
  // The previous day's clouds can still be crossing the sky at dawn.
  const clouds = useMemo(() => [...paintClouds(clock.day - 1), ...paintClouds(clock.day)]
    .sort((a, b) => a.depth - b.depth), [clock.day]);
  const skyTime = (clock.day - 1) * DAY_CYCLE_MINUTES + clock.minutes;
  const daylight = dayLength(clock.village);
  const progress = Math.max(0, Math.min(1, clock.minutes / daylight));
  const night = !!clock.night || clock.minutes >= daylight;
  const nightProgress = Math.max(0, Math.min(1, (clock.minutes - daylight) / (DAY_CYCLE_MINUTES - daylight)));
  const twilight = Math.max(0, 1 - Math.min(clock.minutes, (1 - progress) * daylight) / TWILIGHT_MINUTES);
  const warmSky = progress < .5 ? '#7598aa' : '#635f8a';
  const warmHorizon = progress < .5 ? '#f2bf88' : '#e3a07d';
  const style = {
    '--sky-top': night ? '#131e38' : `color-mix(in srgb, #528da8, ${warmSky} ${twilight * 100}%)`,
    '--sky-edge': night ? '#737c9c' : `color-mix(in srgb, #cadfc8, ${warmHorizon} ${twilight * 100}%)`,
    '--puzzle-light': night ? .49 : 1 - twilight * .18,
    '--sky-x': `${Math.max(-90, Math.min(90, shiftX * .16))}px`,
    '--sky-y': `${Math.max(-36, Math.min(36, shiftY * .11))}px`,
    '--sun-x': `${11 + progress * 78}%`,
    '--sun-y': `${71 - Math.sin(progress * Math.PI) * 52}%`,
    '--moon-x': `${11 + nightProgress * 78}%`,
    '--moon-y': `${66 - Math.sin(nightProgress * Math.PI) * 43}%`,
    '--stars-angle': `${(clock.day % 365) * 360 / 365 + clock.minutes * 360 / DAY_CYCLE_MINUTES}deg`,
    '--cloud-highlight': night ? '#b4c5e0' : `color-mix(in srgb, #fff9e8, ${warmHorizon} ${twilight * 65}%)`,
    '--cloud-body': night ? '#687d9f' : '#dce5df',
    '--cloud-shadow': night ? '#2d3c5b' : `color-mix(in srgb, #738fa7, ${warmSky} ${twilight * 55}%)`,
  } as CSSProperties;
  return <div className={`vg-puzzle-atmosphere${night ? ' is-night' : ''}`} style={style} aria-hidden="true">
    <div className="vg-puzzle-sky">
      <span className="vg-puzzle-sun" />
      <span className="vg-puzzle-moon" />
      <span className="vg-puzzle-stars">{stars.map((star, i) => <i key={i} style={star} />)}</span>
      <div className="vg-puzzle-clouds">{clouds.map(({ key, depth, width, top, birth, lifetime, strokes }) => {
        const age = (skyTime - birth) / lifetime;
        if (age <= 0 || age >= 1) return null;
        const position = -40 + age * 180;
        const parallax = Math.max(-90, Math.min(90, shiftX * (.07 + depth * .18)));
        return <div className="vg-puzzle-cloud" key={key} style={{
          left: `calc(${position}% + ${parallax}px)`, width: `${width}%`, top: `${top}%`,
          opacity: (.36 + depth * .52) * Math.min(1, age * 8, (1 - age) * 8),
          aspectRatio: 4.7 - depth * 1.5,
        }}>
          {strokes.map((stroke, i) => <i key={i} style={stroke} />)}
        </div>;
      })}</div>
    </div>
    <div className={`vg-puzzle-ground${aspen ? ' vg-aspen-ground' : ''}`} style={terrainStyle} />
    <div className="vg-puzzle-ridge" />
    <div className="vg-puzzle-mist" />
  </div>;
}
