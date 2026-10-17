import { useMemo } from 'react';
import { materializeTiles } from './runtime';
import type { AuthoredTile, TileDocument } from './schema';
import { ProtoCard } from '../components/ProtoCard';
import { TableauPlayArea, TableauTemplate } from '../components/TableauTemplate';
import { createTableauLightRig } from '../tableauLighting';

/** Preview the actual Proto generator without consuming or modifying a session deal. */
export function TileTableauPreview({ tile, document }: { tile: AuthoredTile; document: TileDocument }) {
  const deal = useMemo(() => materializeTiles({ ...document, tiles: document.tiles!.map(t => t.id === tile.id ? tile : t) }, [], false).find(t => t.id === tile.id)!, [tile, document]);
  const cards = deal.tableau.flat();
  const header = <p data-proto-deal-summary="true">Generated {tile.kind === 'hero-den' ? 'rest' : 'gathering'} sample · {cards.length} tableau cards · {deal.stock.length} stock · {cards.filter(c => c.resource).length} resource cards</p>;
  if (!cards.length) return <p data-proto-deal-summary="true">No gathering cards for this tile. {tile.kind === 'water' ? 'Proto uses fishing here.' : 'Use its travel or passage properties where applicable.'}</p>;
  return <div className="tile-deal-preview" aria-label="Generated Proto tableau preview">
    <TableauTemplate header={header} foundations={<span>Sample deal from Proto’s generator. Scripted days may supply a different gathering deal.</span>}>
      <TableauPlayArea columns={deal.tableau.length} rows={Math.max(1, ...deal.tableau.map(c => c.length))} hours={12} rig={createTableauLightRig(12, {x:0,y:0}, [])} biome={{tileType: tile.kind, terrain: 'woods'}}>
        <div className="tile-deal-preview__columns proto-tableau-stage" style={{gridTemplateColumns:`repeat(${deal.tableau.length}, minmax(0,1fr))`}}>
          {deal.tableau.map((column, index) => <div key={index} className="tile-deal-preview__column">{column.map((card,row) => <ProtoCard key={card.id} card={card} allowJumbo={false} disabled buried={row < column.length-1} centerRank style={{position:'absolute',left:0,top:`calc(var(--classic-stack-step) * ${row})`,width:'var(--classic-card-w)',zIndex:row+1}} />)}</div>)}
        </div>
      </TableauPlayArea>
    </TableauTemplate>
  </div>;
}
