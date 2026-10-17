export type WorldCoordinate = Readonly<{ x: number; y: number }>;
export type GridCell = Readonly<{ gridId: string; column: number; row: number }>;
export type GridLandmark = Readonly<{ id: string; name: string; column: number; row: number }>;
export type GridDefinition = { id: string; cellSize: number; origin?: WorldCoordinate; landmarks?: readonly GridLandmark[] };

/** Signed, unbounded cell coordinates. Camera state is never part of a grid reference. */
export class GridCoordinates {
  readonly id: string;
  readonly cellSize: number;
  readonly origin: WorldCoordinate;
  readonly landmarks: readonly GridLandmark[];
  constructor(definition: GridDefinition) {
    if (!/^[a-z][a-z0-9-]*$/.test(definition.id) || !Number.isFinite(definition.cellSize) || definition.cellSize <= 0) throw new Error('Invalid grid definition');
    this.id=definition.id;this.cellSize=definition.cellSize;this.origin=Object.freeze({...(definition.origin ?? {x:0,y:0})});
    if(!Number.isFinite(this.origin.x)||!Number.isFinite(this.origin.y))throw new Error('Invalid grid origin');
    this.landmarks=Object.freeze((definition.landmarks??[]).map(item=>{this.cell(item.column,item.row);return Object.freeze({...item});}));
    if(new Set(this.landmarks.map(item=>item.id)).size!==this.landmarks.length)throw new Error('Duplicate landmark');
  }
  cell(column:number,row:number):GridCell {
    if(!Number.isSafeInteger(column)||!Number.isSafeInteger(row))throw new Error('Grid indices must be safe integers');
    return Object.freeze({gridId:this.id,column:column===0?0:column,row:row===0?0:row});
  }
  reference(cell:GridCell) { this.check(cell);return `${this.id}:${cell.column},${cell.row}`; }
  parse(reference:string):GridCell|null {
    const match=/^([a-z][a-z0-9-]*):(-?\d+),(-?\d+)$/.exec(reference);
    if(!match||match[1]!==this.id)return null;
    try{return this.cell(Number(match[2]),Number(match[3]));}catch{return null;}
  }
  private check(cell:GridCell) {if(cell.gridId!==this.id)throw new Error('Cell belongs to another grid');this.cell(cell.column,cell.row);}
  center(cell:GridCell):WorldCoordinate {this.check(cell);return {x:this.origin.x+cell.column*this.cellSize,y:this.origin.y+cell.row*this.cellSize};}
  atWorld(point:WorldCoordinate):GridCell {
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new Error('Invalid world point');
    return this.cell(Math.floor((point.x-this.origin.x)/this.cellSize+.5),Math.floor((point.y-this.origin.y)/this.cellSize+.5));
  }
  snap(point:WorldCoordinate):WorldCoordinate {return this.center(this.atWorld(point));}
  offset(cell:GridCell,columns:number,rows:number):GridCell {this.check(cell);return this.cell(cell.column+columns,cell.row+rows);}
  bounds(cell:GridCell) {const center=this.center(cell),half=this.cellSize/2;return {...center,left:center.x-half,top:center.y-half,right:center.x+half,bottom:center.y+half,width:this.cellSize,height:this.cellSize};}
  region(first:GridCell,columns:number,rows:number) {
    if(!Number.isSafeInteger(columns)||columns<1||!Number.isSafeInteger(rows)||rows<1)throw new Error('Invalid grid region');
    const start=this.bounds(first),width=columns*this.cellSize,height=rows*this.cellSize;
    return {left:start.left,top:start.top,right:start.left+width,bottom:start.top+height,width,height,x:start.left+width/2,y:start.top+height/2};
  }
  named(idOrName:string) {
    const item=this.landmarks.find(item=>item.id===idOrName||item.name.toLowerCase()===idOrName.toLowerCase());
    if(!item)return null;
    const cell=this.cell(item.column,item.row);return {...item,cell,reference:this.reference(cell),world:this.center(cell)};
  }
}
export const TABLE_GRID = new GridCoordinates({id:'table',cellSize:48,origin:{x:0,y:0},landmarks:[{id:'true-center',name:'True Center',column:0,row:0}]});
export const TRUE_CENTER = TABLE_GRID.named('true-center')!;
export type GridViewport = {left:number;top:number;width:number;height:number};
export type GridCamera = {x:number;y:number;scale:number};
export function screenToWorld(point:WorldCoordinate,viewport:GridViewport,camera:GridCamera):WorldCoordinate {
  if(!Number.isFinite(camera.scale)||camera.scale<=0)throw new Error('Invalid camera scale');
  return {x:(point.x-viewport.left-viewport.width/2-camera.x)/camera.scale,y:(point.y-viewport.top-viewport.height/2-camera.y)/camera.scale};
}
export function worldToScreen(point:WorldCoordinate,viewport:GridViewport,camera:GridCamera):WorldCoordinate {
  return {x:viewport.left+viewport.width/2+camera.x+point.x*camera.scale,y:viewport.top+viewport.height/2+camera.y+point.y*camera.scale};
}
