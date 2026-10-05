import {expect,it} from 'vitest';
import {GridCoordinates,TABLE_GRID,TRUE_CENTER,screenToWorld,worldToScreen} from './gridCoordinates';
it('identifies True Center by stable name, absolute reference and world center',()=>{
 expect(TRUE_CENTER.reference).toBe('table:0,0');expect(TRUE_CENTER.world).toEqual({x:0,y:0});expect(TABLE_GRID.named('True Center')?.cell).toEqual(TABLE_GRID.cell(0,0));expect(TABLE_GRID.bounds(TRUE_CENTER.cell)).toMatchObject({left:-24,top:-24,right:24,bottom:24});
});
it('round-trips signed references and rejects foreign or invalid references',()=>{
 for(const [c,r] of [[0,0],[-30,21],[100000,-90000]]){const cell=TABLE_GRID.cell(c,r);expect(TABLE_GRID.parse(TABLE_GRID.reference(cell))).toEqual(cell);expect(TABLE_GRID.atWorld(TABLE_GRID.center(cell))).toEqual(cell);}
 expect(TABLE_GRID.parse('hut:0,0')).toBeNull();expect(TABLE_GRID.parse('table:1.5,0')).toBeNull();expect(()=>TABLE_GRID.cell(0.5,0)).toThrow();
});
it('keeps negative boundaries consistent and snaps to cell centers',()=>{
 expect(TABLE_GRID.atWorld({x:-24,y:-24})).toEqual(TABLE_GRID.cell(0,0));expect(TABLE_GRID.atWorld({x:-24.1,y:24})).toEqual(TABLE_GRID.cell(-1,1));expect(TABLE_GRID.snap({x:49.2,y:-80})).toEqual({x:48,y:-96});
});
it('supports independently configured grids and rectangular cell regions',()=>{
 const grid=new GridCoordinates({id:'hut-interior',cellSize:32,origin:{x:100,y:-64}});
 expect(grid.center(grid.cell(-1,2))).toEqual({x:68,y:0});expect(grid.region(grid.cell(0,0),3,2)).toMatchObject({left:84,top:-80,width:96,height:64});expect(()=>grid.reference(TRUE_CENTER.cell)).toThrow();
});
it('keeps world/cell identity unchanged across zoom, pan and viewport sizes',()=>{
 const point=TABLE_GRID.center(TABLE_GRID.cell(-8,5));
 for(const viewport of [{left:10,top:20,width:800,height:600},{left:2,top:4,width:390,height:844}])for(const scale of [.65,1.7,2.25]){
 const camera={x:123,y:-81,scale};const screen=worldToScreen(point,viewport,camera);const world=screenToWorld(screen,viewport,camera);expect(world.x).toBeCloseTo(point.x);expect(world.y).toBeCloseTo(point.y);expect(TABLE_GRID.reference(TABLE_GRID.atWorld(world))).toBe('table:-8,5');}
});
