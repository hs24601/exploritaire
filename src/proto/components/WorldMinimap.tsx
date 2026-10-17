import { useState } from 'react';
import { TABLE_GRID } from '../gridCoordinates';
import { CLEAR_AREA } from '../worldBounds';
import type { ProtoState } from '../protoState';

/** A stable overhead overview, independent of the player's live scene camera. */
export function WorldMinimap({ tiles, actors, selectedBiomeId, onViewMap }: {
  tiles: ProtoState['biomeTiles']; actors: ProtoState['worldActors'];
  selectedBiomeId: string | null; onViewMap: () => void;
}) {
  const size = CLEAR_AREA.right - CLEAR_AREA.left;
  const cell = TABLE_GRID.cellSize;
  const [zoom, setZoom] = useState(1);
  const extent = size / zoom;
  const focus = tiles.find(tile => tile.id === selectedBiomeId)?.position ?? { x: 0, y: 0 };
  const left = Math.max(CLEAR_AREA.left, Math.min(focus.x - extent / 2, CLEAR_AREA.right - extent));
  const top = Math.max(CLEAR_AREA.top, Math.min(focus.y - extent / 2, CLEAR_AREA.bottom - extent));
  const labelSize = extent / 140 * 10;
  const ruler = labelSize * 1.3;
  const indices = Array.from({ length: 15 }, (_, i) => i - 7);
  const step = zoom === 1 ? 2 : 1;
  const positions = actors.map(actor => (actor.location === 'foundation' ? tiles.find(tile => tile.id === actor.biomeId)?.position : null) ?? actor.position);
  return <aside className="proto-world-minimap" aria-label="World minimap">
    <div className="proto-world-minimap__header">
      <button type="button" aria-label="Zoom out minimap" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - 1))}>−</button>
      <button type="button" onClick={onViewMap}>View map</button>
      <button type="button" aria-label="Zoom in minimap" disabled={zoom === 5} onClick={() => setZoom(value => Math.min(5, value + 1))}>+</button>
    </div>
    <svg viewBox={`${left} ${top} ${extent} ${extent}`} role="img" aria-label={`Overhead map of discovered places and actors, ${zoom}× zoom; column coordinates across top, row coordinates down left`}>
      <defs><pattern id="minimap-grid" width={cell} height={cell} x={-cell / 2} y={-cell / 2} patternUnits="userSpaceOnUse"><path d={`M ${cell} 0 H 0 V ${cell}`} fill="none" stroke="#6c887c" strokeOpacity=".16" strokeWidth="2" /></pattern></defs>
      <rect x={CLEAR_AREA.left} y={CLEAR_AREA.top} width={size} height={size} fill="#101b19" />
      <rect x={CLEAR_AREA.left} y={CLEAR_AREA.top} width={size} height={size} fill="url(#minimap-grid)" />
      {tiles.map(tile => {
        const columns = Math.max(1, Math.round(tile.gridSize.columns)), rows = Math.max(1, Math.round(tile.gridSize.rows));
        const first = TABLE_GRID.offset(TABLE_GRID.atWorld(tile.position), -Math.floor(columns / 2), -Math.floor(rows / 2));
        const area = TABLE_GRID.region(first, columns, rows);
        const unknown = tile.flags?.includes('unexplored');
        const color = unknown ? '#202526' : tile.tileType === 'impassable-mountain' ? '#647078' : tile.terrain === 'water' ? '#508da2' : tile.tileType === 'hero-den' ? '#b49b72' : tile.flags?.includes('danger') ? '#884853' : '#62866b';
        return <g key={tile.id}><title>{unknown ? 'Unexplored' : tile.title}</title><rect x={area.left} y={area.top} width={area.width} height={area.height} rx="5" fill={color} stroke={tile.id === selectedBiomeId ? '#ffd166' : '#0a1310'} strokeWidth={tile.id === selectedBiomeId ? 6 : 3} /></g>;
      })}
      {actors.map((actor, index) => {
        const point = positions[index];
        const occupants = positions.map((p, i) => p.x === point.x && p.y === point.y ? i : -1).filter(i => i >= 0);
        const offset = (occupants.indexOf(index) - (occupants.length - 1) / 2) * 20;
        return <g key={actor.id} data-minimap-actor={actor.id}><title>{actor.label}</title><circle cx={point.x + offset} cy={point.y} r="15" fill={actor.id === 'hero' ? '#ffd166' : '#9bded2'} stroke="#07110e" strokeWidth="5" /></g>;
      })}
      <g className="proto-world-minimap__coordinates" fontSize={labelSize} fill="#d9e9df" textAnchor="middle" pointerEvents="none">
        <rect x={left} y={top} width={extent} height={ruler} fill="#07110e" />
        <rect x={left} y={top} width={ruler} height={extent} fill="#07110e" />
        {indices.filter(i => i % step === 0).map(i => {
          const point = TABLE_GRID.center(TABLE_GRID.cell(i, i));
          return <g key={i}>
            {point.x > left + ruler && point.x < left + extent - labelSize / 2 && <text x={point.x} y={top + labelSize}>{i}</text>}
            {point.y > top + ruler && point.y < top + extent - labelSize / 2 && <text x={left + ruler / 2} y={point.y} dominantBaseline="middle">{i}</text>}
          </g>;
        })}
      </g>
    </svg>
  </aside>;
}
