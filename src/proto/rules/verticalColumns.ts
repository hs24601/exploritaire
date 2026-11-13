import type { BattleState } from './battle';

export const VERTICAL_ROWS = 5;
export const VERTICAL_LAYERS = 4;
/** 223 Stepping Stones: Hero reaches the nearest cards on the ground and stands where her last card lay. */
export const STEPPING_REACH = 14;
/** Hero's arena spot before her first play, beyond the player-end row (world x, z). */
export const STEPPING_START: readonly [number, number] = [-6.5, 0];
type VerticalState = Pick<BattleState,'columns'> & Partial<Pick<BattleState,'sandboxScenario'|'verticalStand'|'verticalEnemyStand'>>;
export const isTiledFloor = (id?: string) => ['224','225','226','227','228'].includes(id ?? '');
export const floorLayout = (id?: string) => id==='228'?{rows:11,cols:15,width:1.5,height:2.1,gap:.06,stagger:false}:id==='225'?{rows:9,cols:9,width:1.15,height:1.6,gap:.06,stagger:false}:id==='226'?{rows:9,cols:9,width:1.3,height:1.82,gap:.07,stagger:true}:id==='227'?{rows:11,cols:11,width:.95,height:1.33,gap:.05,stagger:false}:{rows:5,cols:8,width:1.5,height:2.1,gap:.06,stagger:false};
// The nearest woods billboards begin roughly twelve world units from the
// clearing's center. Keep every tile corner inside that circular footprint.
const clearingCells = (() => {
 const {rows,cols,width,height,gap}=floorLayout('228'), cells: {row:number;col:number}[]=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x=((rows-1)/2-row)*(height+gap),z=(col-(cols-1)/2)*(width+gap);
  if(Math.hypot(Math.abs(x)+height/2,Math.abs(z)+width/2)<=12)cells.push({row,col});
 }
 return cells;
})();
export const floorCell = (index:number,id?:string) => id==='228' ? clearingCells[index] : {row:Math.floor(index/floorLayout(id).cols),col:index%floorLayout(id).cols};
export const floorTileCount = (id?:string) => id==='228'?clearingCells.length:floorLayout(id).rows*floorLayout(id).cols;
export const floorStartIndices = (id?:string) => {
 const {rows,cols}=floorLayout(id);
 if(id==='228')return {party:clearingCells.findIndex(cell=>cell.row===rows-3 && cell.col===Math.floor(cols/2)),enemy:clearingCells.findIndex(cell=>cell.row===2 && cell.col===Math.floor(cols/2))};
 return {party:(rows-3)*cols+Math.floor(cols/2),enemy:2*cols+Math.floor(cols/2)};
};
export const isVerticalScenario = (state: Partial<Pick<BattleState,'sandboxScenario'>>) => state.sandboxScenario==='222' || state.sandboxScenario==='223' || isTiledFloor(state.sandboxScenario);
/** World position (x, z) of a layer on the arena floor; layer 0 is the inner card. Shared with the camera arena. */
export const verticalSlot = (column: number, layer: number): [number, number] => [-0.5 + (2 - column % VERTICAL_ROWS) * 1.8125, (column < VERTICAL_ROWS ? -1 : 1) * (2.8 + layer * .75)];
export const verticalStand = (state: Partial<Pick<BattleState,'verticalStand'|'sandboxScenario'>>) => state.verticalStand ?? (isTiledFloor(state.sandboxScenario) ? [-8,0] as const : STEPPING_START);
/** 224's forty individual tiles, spaced so their faces do not overlap. */
export const floorSlot = (index:number,id?:string): [number,number] => {
 const {rows,cols,width,height,gap,stagger}=floorLayout(id),{row,col}=floorCell(index,id);
 return [(rows-1)/2*(height+gap)-row*(height+gap)+((index*17)%41)*.0001, (col-(cols-1)/2+(stagger && row%2?.5:0))*(width+gap)+((index*index*13)%47)*.0001];
};
export const enemyStand = (state: Partial<Pick<BattleState,'verticalEnemyStand'>>) => state.verticalEnemyStand ?? [8, 0] as const;
const slot = (state: VerticalState, column:number, depth:number) => isTiledFloor(state.sandboxScenario) ? floorSlot(column,state.sandboxScenario) : verticalSlot(column,state.columns[column].length-1-depth);
/** A played tile stays occupied until its actor moves away. */
export function occupiedFloor(state: VerticalState, column:number) {
 if(!isTiledFloor(state.sandboxScenario))return false;
 const [x,z]=floorSlot(column,state.sandboxScenario);
 return [state.verticalStand,state.verticalEnemyStand].some(spot=>spot && Math.hypot(x-spot[0],z-spot[1])<.001);
}
/** The cards nearest a spot, as `column:depth` keys. */
const reachCache=new WeakMap<object,Map<string,Set<string>>>();
export function steppingReach(state: VerticalState, stand: readonly [number, number] = verticalStand(state)): Set<string> {
 const byStand=reachCache.get(state.columns) ?? new Map<string,Set<string>>(),cacheKey=[...stand,...(state.verticalStand??[]),...(state.verticalEnemyStand??[])].join(',');reachCache.set(state.columns,byStand);
 const hit=byStand.get(cacheKey);if(hit)return hit;
 const cards=state.columns.slice(0,isTiledFloor(state.sandboxScenario)?state.columns.length:VERTICAL_ROWS*2).flatMap((pile,column)=>occupiedFloor(state,column)?[]:pile.map((_,depth)=>{const [x,z]=slot(state,column,depth);return {key:column+':'+depth,distance:Math.hypot(x-stand[0],z-stand[1])};}));
 const reach=new Set(cards.sort((a,b)=>a.distance-b.distance).slice(0,STEPPING_REACH).map(card=>card.key));
 byStand.set(cacheKey,reach);return reach;
}
/** Radius of the ring that holds a spot's reach, for the arena decal. */
export function steppingRadius(state: VerticalState, stand: readonly [number, number] = verticalStand(state)) {
 if(isTiledFloor(state.sandboxScenario)){
  const distances=state.columns.flatMap((pile,column)=>occupiedFloor(state,column)?[]:pile.map((_,depth)=>{const [x,z]=slot(state,column,depth);return Math.hypot(x-stand[0],z-stand[1]);})).sort((a,b)=>a-b);
  if(distances.length>STEPPING_REACH)return (distances[STEPPING_REACH-1]+distances[STEPPING_REACH])/2;
  return (distances[distances.length-1]??0)+.01;
 }
 const keys=steppingReach(state,stand);
 return Math.max(0,...[...keys].map(key=>{const [column,depth]=key.split(':').map(Number),[x,z]=slot(state,column,depth);return Math.hypot(x-stand[0],z-stand[1]);}))+.6;
}
/** The outermost layer is inaccessible; inner faces and end-row backing cards remain reachable. In 223 the party reaches the nearest cards instead. */
export function verticalCanReach(state: VerticalState, column: number, depth: number, team: 'party'|'enemy'): boolean {
 const pile=state.columns[column];
 if(column<0 || column>=(isTiledFloor(state.sandboxScenario)?state.columns.length:VERTICAL_ROWS*2) || !pile?.[depth])return false;
 if(isTiledFloor(state.sandboxScenario))return steppingReach(state,team==='party'?verticalStand(state):enemyStand(state)).has(column+':'+depth);
 if(state.sandboxScenario==='223' && team==='party')return steppingReach(state).has(column+':'+depth);
 if(depth===0 && pile.length===VERTICAL_LAYERS)return false;
 if(depth===pile.length-1)return true;
 return column%VERTICAL_ROWS===(team==='party'?VERTICAL_ROWS-1:0);
}
export const verticalReach = (state: VerticalState,column:number,depth:number) => {
 const party=verticalCanReach(state,column,depth,'party'),enemy=verticalCanReach(state,column,depth,'enemy');
 return party && enemy?'both':party?'party':enemy?'enemy':'none';
};
export const verticalEntries = (state: VerticalState,team:'party'|'enemy') => state.columns.slice(0,isTiledFloor(state.sandboxScenario)?state.columns.length:VERTICAL_ROWS*2).flatMap((pile,column)=>pile.map((card,depth)=>({card,column,depth})).reverse().filter(({column,depth})=>verticalCanReach(state,column,depth,team)));
/** Arena decal data for 223: Hero's reach ring, and the ring she would have after playing the hovered card. */
export function steppingScene(state: VerticalState, hoverCardId?: string | null) {
 const stand=verticalStand(state);
 let ghost: { stand: [number,number]; radius: number } | undefined;
 const column=hoverCardId ? state.columns.findIndex(pile=>pile.some(card=>card.id===hoverCardId)) : -1;
 if(column>=0 && column<(isTiledFloor(state.sandboxScenario)?state.columns.length:VERTICAL_ROWS*2)){
  const depth=state.columns[column].findIndex(card=>card.id===hoverCardId);
  if(verticalCanReach(state,column,depth,'party')){const spot=slot(state,column,depth);const preview=isTiledFloor(state.sandboxScenario)?{...state,verticalStand:spot}:state;ghost={stand:spot,radius:steppingRadius(preview,spot)};}
 }
 const enemy=isTiledFloor(state.sandboxScenario)?enemyStand(state):undefined;
 return { stand: [stand[0],stand[1]] as [number,number], radius: steppingRadius(state,stand), ghost, enemy:enemy?{stand:[enemy[0],enemy[1]] as [number,number],radius:steppingRadius(state,enemy)}:undefined };
}
