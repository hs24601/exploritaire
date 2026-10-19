import type { BiomeTileState } from '../protoState';
import { biomeOpenState, biomeTravelCost } from '../biomeFlags';
import { biomeTileSprite } from '../protoData';
import { TABLE_GRID } from '../gridCoordinates';
import type { DetailsCardObject } from './DetailsCardViewer';
import { RoadTileArt } from './RoadTileArt';
import { useArtStyle } from '../artStyle';
import { scenerySprite, isPaintedScenerySprite } from '../sceneryArt';
import type { ReactNode } from 'react';

function SceneryCardArt({sprite,title,oldTree,children}:{sprite?:string;title:string;oldTree:boolean;children:ReactNode}) {
  const style=useArtStyle();
  const painted=oldTree&&style==='paint'?`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/pine-sprite-v1.png`:scenerySprite(sprite,style);
  return painted&&(painted!==sprite||isPaintedScenerySprite(painted))?<img src={painted} alt={`${title} terrain`} draggable={false} style={{imageRendering:'auto'}}/>:<>{children}</>;
}

/** Tile summaries use the same card face and inspection behavior as actors. */
export function tileDetailsCard(tile: BiomeTileState, day: number, onOpen: () => void): DetailsCardObject {
  const flags = tile.clearedDay === day ? tile.flags?.filter(flag => flag !== 'danger') : tile.flags;
  const travel = biomeTravelCost(flags);
  const open = biomeOpenState(flags);
  const mountain = tile.tileType === 'impassable-mountain';
  const den = tile.tileType === 'hero-den';
  const berries = tile.tileType === 'berry-patch';
  const dirt = tile.tileType === 'dirt';
  const water = tile.terrain === 'water';
  const danger = flags?.includes('danger');
  const kind = mountain ? 'Mountain' : den ? 'Den' : dirt ? 'Dirt' : berries ? 'Berry patch' : tile.road ? 'Road' : tile.tileType === 'path' ? 'Path' : water ? 'Pond' : danger ? 'Dark woods' : 'Woods';
  const passage=tile.passage;
  const travelText = passage ? `${passage.axis === 'east-west' ? 'East–west' : 'North–south'} passage. Other directions are blocked. ${tile.passageOpen ? 'The passage is open for return trips.' : `${passage.title}: ${passage.tags.map(tag=>'#'+tag).join(' ')}. Use a matching assigned ability for ${passage.breachAP} AP to breach it.`}` : mountain ? 'Impassable mountain. Find a route around it.'
    : danger ? 'A foe blocks passage. Arriving here starts a fight.'
    : `Crossable at ${travel === 1 ? 'normal' : `${travel} times normal`} movement cost.`;
  const domestic = tile.id.startsWith('day-one-');
  const workText = passage ? `Breaching reveals ${passage.columns} columns. Ordinary card plays then earn the crossing.` : mountain || dirt ? 'This terrain has no tableau.' : den ? 'Home for supper and a quiet night. Choose Curl up after eating to play Zzz.' : water ? 'Visit with an actor to fish.'
    : tile.berryPatchVariant === 'sparse' ? `A single bush beside the trail. ${tile.berryHarvested ? 'Already picked clean.' : 'Complete the crossing to gather its one manaberry.'} No separate gathering puzzle; revisiting does not replenish it.`
    : berries ? 'A short foraging puzzle. Gather manaberries for supper and keep some to light tomorrow’s search. Cleared cards stay picked.'
    : domestic ? 'A short foraging puzzle. Gather two mana for supper; leave whenever you have enough. Cleared cards stay picked.'
    : `A ${tile.tableauSize}-card exploration deal. Station an actor here to work its tableau.`;
  const reference = TABLE_GRID.reference(TABLE_GRID.atWorld(tile.position));
  const sprite = dirt ? `${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/dirt-ground.png` : biomeTileSprite(tile);
  return {
    id: tile.id, name: tile.title, badge: '◇', badgeLabel: 'Tile',
    art: <div className={`tile-card-art${danger ? ' tile-card-art--danger' : ''}`} data-tile-card-art={tile.id}>
      <SceneryCardArt sprite={sprite} title={tile.title} oldTree={tile.id==='day-one-tree'}>
      {tile.road ? <RoadTileArt road={tile.road} exploration={1} /> : sprite
        ? <img src={sprite} alt={`${tile.title} terrain`} draggable={false} />
        : <svg viewBox="0 0 160 220" role="img" aria-label={`${kind} terrain`} shapeRendering="crispEdges">
          <path fill="#233b33" d="M0 0h160v220H0z" />
          <path fill="#415447" d="M0 80h160v140H0z" />
          <path fill="#8e8060" d="M64 220h48l-18-87 10-53H77l-12 55z" />
          <path fill="#a9956e" d="M75 220h25l-16-85 10-55H84l-11 55z" />
          <path fill="#63735a" d="M12 130h16v4H12zm112 38h20v4h-20zM18 190h14v4H18z" />
        </svg>}
      </SceneryCardArt>
    </div>,
    descriptorPreview: passage ? `${passage.title} · ${tile.passageOpen ? 'Open' : passage.tags.map(tag=>'#'+tag).join(' ')}` : mountain ? 'Impassable terrain' : dirt ? 'Bare earth underfoot' : tile.berryPatchVariant === 'sparse' ? `One manaberry bush · ${tile.berryHarvested ? 'picked clean' : 'one berry along the trail'}` : berries ? 'Ripe berries on low leafy bushes' : tile.id === 'day-one-tree' ? 'A familiar tree, a little farther from home' : `${kind} · discovered`,
    descriptor: `${kind} tile at ${reference}. ${travelText} ${workText}${tile.unlocked ? '' : ' Complete Small Woods to unlock.'}`,
    trays: [
      { id: 'travel', icon: '↝', label: 'Travel', content: passage ? passage.axis==='east-west'?'↔':'↕' : travel === Infinity ? '×' : `${travel}×`, details: travelText },
      ...(!dirt || passage ? [{ id: 'tableau', icon: '▤', label: water ? 'Fishing' : 'Tableau', content: passage ? `${passage.columns} columns` : mountain ? '—' : water ? '♧' : tile.tableauSize, details: workText }] : []),
      { id: 'terrain', icon: '◇', label: 'Tile', content: '✓', details: `${kind} · discovered · ${reference}` },
    ],
    footer: open.opens && tile.unlocked && !den && !dirt ? <button type="button" className="tile-card-action"
      onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}
      onClick={event => { event.stopPropagation(); onOpen(); }}>
      {water ? 'Go Fish' : danger ? 'View encounter' : 'Open tableau'}
    </button> : undefined,
  };
}
