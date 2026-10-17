import { ROAD_PATHS, type RoadTile } from '../roadTiles';
import { Reveal } from './Reveal';

export function RoadTileArt({ road, exploration, brightness = 1 }: { road: RoadTile; exploration: number; brightness?: number }) {
  const art = <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
    <rect width="48" height="48" fill="#384338" />
    <path d="M3 5h5M36 7h7M5 38h5M37 42h6M6 13h3M40 33h3" stroke="#586044" strokeWidth="2" />
    <g transform={`rotate(${road.rotation} 24 24)`} fill="none" strokeLinecap="butt" strokeLinejoin="round">
      <path d={ROAD_PATHS[road.shape]} stroke="#242b27" strokeWidth="18" />
      <path d={ROAD_PATHS[road.shape]} stroke="#8f8060" strokeWidth="15" />
      <path d={ROAD_PATHS[road.shape]} stroke="#c2ad7d" strokeWidth="11" />
      <path d={ROAD_PATHS[road.shape]} stroke="#9c8861" strokeWidth="1" strokeDasharray="2 5" />
    </g>
  </svg>;
  return <span className="proto-biome-topdown" data-road-shape={road.shape} data-road-rotation={road.rotation} style={{ filter: `brightness(${brightness})` }}>
    <Reveal fraction={exploration} width={48} height={48}
      shade={<span style={{ display: 'block', width: '100%', height: '100%', filter: 'grayscale(1) brightness(0.55) sepia(0.3) hue-rotate(145deg)' }}>{art}</span>}>{art}</Reveal>
  </span>;
}
