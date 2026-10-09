import type { BiomeTileState } from '../protoState';
import { biomeOpenState, biomeTravelCost } from '../biomeFlags';
import { biomeTileSprite } from '../protoData';
import { TABLE_GRID } from '../gridCoordinates';
import type { DetailsCardObject } from './DetailsCardViewer';
import { RoadTileArt } from './RoadTileArt';

/** Tile summaries use the same card face and inspection behavior as actors. */
export function tileDetailsCard(tile: BiomeTileState, day: number, onOpen: () => void): DetailsCardObject {
  const flags = tile.clearedDay === day ? tile.flags?.filter(flag => flag !== 'danger') : tile.flags;
  const travel = biomeTravelCost(flags);
  const open = biomeOpenState(flags);
  const mountain = tile.tileType === 'impassable-mountain';
  const den = tile.tileType === 'hero-den';
  const water = tile.terrain === 'water';
  const danger = flags?.includes('danger');
  const kind = mountain ? 'Mountain' : den ? 'Den' : tile.road ? 'Road' : tile.tileType === 'path' ? 'Path' : water ? 'Pond' : danger ? 'Dark woods' : 'Woods';
  const travelText = mountain ? 'Impassable mountain. Find a route around it.'
    : danger ? 'A foe blocks passage. Arriving here starts a fight.'
    : `Crossable at ${travel === 1 ? 'normal' : `${travel} times normal`} movement cost.`;
  const workText = mountain ? 'This terrain has no tableau.' : water ? 'Visit with an actor to fish.'
    : `A ${tile.tableauSize}-card exploration deal. Station an actor here to work its tableau.`;
  const reference = TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position));
  const sprite = biomeTileSprite(tile);
  return {
    id: tile.id, name: tile.title, badge: '◇', badgeLabel: 'Tile',
    art: <div className={`tile-card-art${danger ? ' tile-card-art--danger' : ''}`} data-tile-card-art={tile.id}>
      {tile.road ? <RoadTileArt road={tile.road} exploration={1} /> : sprite
        ? <img src={sprite} alt={`${tile.title} terrain`} draggable={false} />
        : <svg viewBox="0 0 160 220" role="img" aria-label={`${kind} terrain`} shapeRendering="crispEdges">
          <path fill="#233b33" d="M0 0h160v220H0z" />
          <path fill="#415447" d="M0 80h160v140H0z" />
          <path fill="#8e8060" d="M64 220h48l-18-87 10-53H77l-12 55z" />
          <path fill="#a9956e" d="M75 220h25l-16-85 10-55H84l-11 55z" />
          <path fill="#63735a" d="M12 130h16v4H12zm112 38h20v4h-20zM18 190h14v4H18z" />
        </svg>}
    </div>,
    descriptorPreview: mountain ? 'Impassable terrain' : `${kind} · discovered`,
    descriptor: `${kind} tile at ${reference}. ${travelText} ${workText}${tile.unlocked ? '' : ' Complete Small Woods to unlock.'}`,
    trays: [
      { id: 'travel', icon: '↝', label: 'Travel', content: travel === Infinity ? '×' : `${travel}×`, details: travelText },
      { id: 'tableau', icon: '▤', label: water ? 'Fishing' : 'Tableau', content: mountain ? '—' : water ? '♧' : tile.tableauSize, details: workText },
      { id: 'terrain', icon: '◇', label: 'Tile', content: '✓', details: `${kind} · discovered · ${reference}` },
    ],
    footer: open.opens && tile.unlocked ? <button type="button" className="tile-card-action"
      onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
      onClick={event => { event.stopPropagation(); onOpen(); }}>
      {water ? 'Go Fish' : danger ? 'View encounter' : 'Open tableau'}
    </button> : undefined,
  };
}
