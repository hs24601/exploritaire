import type { ReactNode } from 'react';
import { TableauCardArea } from './TableauCardArea';
import { TableauScene } from './TableauScene';
import type { TableauLightRig } from '../tableauLighting';
import type { CardBiome } from '../biomeCardArt';
import './TableauTemplate.css';

/** Shared fitted play surface for travel, gathering, rest and future tableaus.
 * Headers and foundation shelves stay outside the measured card area. */
export function TableauPlayArea({children,columns,rows,rig,hours,biome,immersive=false}:{children:ReactNode;columns:number;rows:number;rig:TableauLightRig;hours:number;biome?:CardBiome;immersive?:boolean}){
  return <TableauScene immersive={immersive} terrain={biome?.terrain==='water'?'water':'woods'} biome={biome} rig={rig} hours={hours}>
    <TableauCardArea columns={columns} rows={rows}>{children}</TableauCardArea>
  </TableauScene>;
}
export function TableauTemplate({header,children,foundations}:{header:ReactNode;children:ReactNode;foundations:ReactNode}){
  return <div className="tableau-template"><header className="tableau-template__header">{header}</header><div className="tableau-template__play">{children}</div><footer className="tableau-template__foundations">{foundations}</footer></div>;
}
