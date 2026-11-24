import {describe,it,expect} from 'vitest';
import {createDayScenario,dayOnePlan,dayOneDestination} from './dayScenarios';
import {SAVED_TILE_DOCUMENT,materializeTiles} from './tileEditor/runtime';
import {authorTile,newAuthoredTile,type TileDocument} from './tileEditor/schema';
import {createInitialState} from './rules/setup';

const authored = (tile: Parameters<typeof authorTile>[0]) => {
 const {initiallyRevealed,...definition}=authorTile(tile);return definition;
};
describe('scenario saved-world preservation',()=>{
 it.each(['day01','day02','day03','sandbox'])('%s keeps every saved tile and all authored settings without changing its document',id=>{
  const before=JSON.stringify(SAVED_TILE_DOCUMENT);
  const base=createInitialState();const day=createDayScenario(id);
  expect(day.biomeTiles.map(t=>t.id)).toEqual(base.biomeTiles.map(t=>t.id));
  expect(day.biomeTiles.map(authored)).toEqual(base.biomeTiles.map(authored));
  expect(day.biomeTiles).toHaveLength(SAVED_TILE_DOCUMENT.tiles!.length);
  expect(day.biomeTiles.some(t=>t.id==='day-two-woods')).toBe(false);
  expect(JSON.stringify(SAVED_TILE_DOCUMENT)).toBe(before);
 });
 it('keeps additions and moved/renamed landmarks when starting, restarting or switching days with an applied document',()=>{
  const doc=structuredClone(SAVED_TILE_DOCUMENT) as TileDocument;
  const patch=doc.tiles!.find(t=>t.kind==='berry-patch')!;
  patch.id='moved-manaberries';patch.column=-4;patch.row=-4;patch.title='My Manaberries';patch.populationDensity=7;patch.resourceDensity=.4;patch.travelCards=9;patch.traversalDifficulty=2;
  doc.tiles!.push({...newAuthoredTile('woods',6,6,'my-added-woods'),populationDensity:9,resourceDensity:.7});
  const before=JSON.stringify(doc);
  const expected=materializeTiles(doc,createInitialState(false).biomeTiles,false).map(authored);
  for(const id of ['day01','day02','day03','sandbox','day01']){
   const day=createDayScenario(id,doc);
   expect(day.biomeTiles.map(authored)).toEqual(expected);
   expect(day.biomeTiles.find(t=>t.id==='my-added-woods')?.populationDensity).toBe(9);
   if(id==='day01'){
    const afterSparse={...day,biomeTiles:day.biomeTiles.map(tile=>tile.berryPatchVariant==='sparse'?{...tile,berryHarvested:true}:tile)};
    expect(dayOneDestination(afterSparse)).toBe(patch.id);
    const plan=dayOnePlan(afterSparse);expect(plan.path[plan.path.length-1]).toMatchObject({x:-192,y:-192});
   }
  }
  expect(JSON.stringify(doc)).toBe(before);
 });
 it('attaches the Day 02 ambush to real woods without repurposing a saved dirt tile',()=>{
  const day=createDayScenario('day02');const woods=day.biomeTiles.find(t=>t.id===day.dayScenarioTiles?.woodsId)!;
  const definition=SAVED_TILE_DOCUMENT.tiles!.find(t=>t.id===woods.id)!;
  expect(definition.kind).toBe('woods');expect(woods.tableau.flat().some(c=>c.id==='day02-woods-mana')).toBe(true);
  const dirt=day.biomeTiles.find(t=>t.id==='tile-dirt--1-0')!;expect(dirt.tileType).toBe('dirt');
 });
});
