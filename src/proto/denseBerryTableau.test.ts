import {arriveActorAtBiome} from './biomeArrival';
import {finishTravelPresentation} from './travelCompletion';
import {describe,it,expect} from 'vitest';
import {dealDenseBerries,travelCardPlayable,bestDenseBerryMove,DENSE_BERRY_BOUNDS,DENSE_BERRY_CLUSTERS,DENSE_BERRY_PORTRAIT_BOUNDS,DENSE_BERRY_PORTRAIT_CLUSTERS,denseBerryCardPose} from './denseBerryTableau';
import {beginJourney,planTravel,playTravelCard,bestTravelMove,denseBerryChoicePending,chooseDenseBerry,paintTravelProgress} from './travelJourney';
import {createDayOneState} from './dayScenarios';

describe('denser berry ordinary Golf puzzle',()=>{
 for(const portrait of [false,true])it('fits every rotated card and key bush prop inside its padded '+(portrait?'portrait':'wide')+' scene envelope',()=>{
  const bounds=portrait?DENSE_BERRY_PORTRAIT_BOUNDS:DENSE_BERRY_BOUNDS;
  const clusters=portrait?DENSE_BERRY_PORTRAIT_CLUSTERS:DENSE_BERRY_CLUSTERS;
  for(const card of dealDenseBerries(8,0).flat()){
   const pose=denseBerryCardPose(card,portrait)!, angle=Math.abs(pose.rotation)*Math.PI/180, height=88/63;
   const width=Math.cos(angle)+height*Math.sin(angle), rotatedHeight=height*Math.cos(angle)+Math.sin(angle);
   const cx=pose.x+.5,cy=pose.y+height/2;
   expect(cx-width/2).toBeGreaterThan(0);
   expect(cy-rotatedHeight/2).toBeGreaterThan(0);
   expect(cx+width/2).toBeLessThan(bounds.width);
   expect(cy+rotatedHeight/2).toBeLessThan(bounds.height);
  }
  for(const bush of clusters){
   expect(bush.x).toBeGreaterThan(0);expect(bush.y).toBeGreaterThan(0);
   expect(bush.x+bush.width).toBeLessThan(bounds.width);
   expect(bush.y+bush.height*1.05).toBeLessThan(bounds.height);
  }
 });
 it('ignores legacy modifiers and accepts only ordinary adjacency including A/K',()=>{
  expect(travelCardPlayable({rank:6,sequenceRule:'match'},6)).toBe(false);
  expect(travelCardPlayable({rank:8,sequenceRule:'skip'},6)).toBe(false);
  expect(travelCardPlayable({rank:7},6)).toBe(true);
  expect(travelCardPlayable({rank:13},1)).toBe(true);
 });
 it('every complete path finishes on a berry',()=>{
  const columns=dealDenseBerries(6,0),seen=new Set<string>(),finals=new Set<string>();
  const visit=(cs:typeof columns,rank:number)=>{
   const key=cs.map(c=>c.length).join(',')+':'+rank;if(seen.has(key))return;seen.add(key);
   for(let i=0;i<cs.length;i++){
    const card=cs[i][cs[i].length-1];if(!card||!travelCardPlayable(card,rank))continue;
    if(cs.flat().length===1){expect(card.foodSource).toBe('berries');finals.add(card.id);}
    else visit(cs.map((c,n)=>n===i?c.slice(0,-1):c),card.rank);
   }
  };visit(columns,6);expect(finals.size).toBeGreaterThan(0);
 });
 it('has a complete route from every starting rank, with five fruit and no rule badges',()=>{
  for(let rank=1;rank<=13;rank++){
   let j={...beginJourney({actorId:'hero',path:[],segments:[],cards:12,estimate:0,arrival:{}}),columns:dealDenseBerries(rank,0),rank};
   expect(j.columns.flat().filter(c=>c.foodSource)).toHaveLength(5);
   expect(j.columns.flat().some(c=>c.sequenceRule)).toBe(false);
   for(let n=0;n<12;n++){
    const column=bestDenseBerryMove(j);expect(column).not.toBeNull();
    const card=j.columns[column!][j.columns[column!].length-1]!;expect(travelCardPlayable(card,j.rank)).toBe(true);
    j={...j,rank:card.rank,columns:j.columns.map((c,i)=>i===column?c.slice(0,-1):c)};
   }
  }
 });
 for(const choice of ['collect','leave'] as const)it('resolves final choice: '+choice,()=>{
  let s=createDayOneState();const tile=s.biomeTiles.find(t=>t.id===s.dayScenarioTiles?.patchId)!;
  const plan=planTravel('hero',[{x:tile.position.x,y:tile.position.y+48,pace:1},{...tile.position,pace:1}],[tile]);
  s={...s,journey:beginJourney(plan,6)};
  s=paintTravelProgress(s,1);
  for(let n=0;n<11;n++){const c=bestTravelMove(s.journey!);expect(c).not.toBeNull();s=playTravelCard(s,c!);}
  expect(denseBerryChoicePending(s)).toBe(true);
  const c=bestTravelMove(s.journey!)!;expect(playTravelCard(s,c)).toBe(s);
  expect(s.journey!.columns.flat()[0].foodSource).toBe('berries');
  const before=s.haul.mana;s=chooseDenseBerry(s,choice);
  expect(s.journey!.completed).toBe(12);
  expect(s.haul.mana).toBe(before+(choice==='collect'?1:0));
  expect(s.biomeTiles.find(t=>t.id===tile.id)!.tableau.flat()).toHaveLength(choice==='collect'?0:1);
  expect(chooseDenseBerry(s,choice)).toBe(s);
  s=arriveActorAtBiome(s,'hero',tile.id,tile.position);
  s=finishTravelPresentation(s);
  if(choice==='leave'){
    expect(s.journey?.arrival.biomeId).toBe('hero-den');
    expect(s.biomeTiles.find(t=>t.id===tile.id)!.tableau.flat()).toHaveLength(1);
  }else expect(s.journey).toBeUndefined();
 });
});
