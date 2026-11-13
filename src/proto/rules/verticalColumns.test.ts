import { describe,it,expect,vi } from 'vitest';
import { canPlay, createCombatSandboxScenario, drawCard, endPlayerTurn, type BattleState, playCard, tickBattle, withdrawPlayer } from './battle';
import { verticalCanReach, VERTICAL_ROWS, VERTICAL_LAYERS, steppingReach, steppingRadius, enemyStand, floorSlot, floorLayout, floorTileCount, floorStartIndices, occupiedFloor, STEPPING_REACH, verticalSlot } from './verticalColumns';
import { anyLegalPlay } from './battleDeadRun';
const start=()=>createCombatSandboxScenario('222');
describe('222 four-layer five-row columns',()=>{
 it('includes Kings and other face ranks in fresh deals',()=>{const random=vi.spyOn(Math,'random').mockReturnValue(.999);try{const s=start();expect(s.columns.flat().every(c=>c.rank===13)).toBe(true);expect(s.stock.every(c=>c.rank===13)).toBe(true);}finally{random.mockRestore();}});
 it('deals eight visual columns of five with Hero and Dark Tyrant',()=>{
  const s=start();expect(s.party.map(a=>a.id)).toEqual(['hero']);expect(s.keruExpedition).toBeUndefined();
  expect(s.columns).toHaveLength(10);expect(s.columns.every(c=>c.length===4)).toBe(true);expect(s.columns.flat()).toHaveLength(40);
  expect(s.columns.flat().every(c=>c.rank>=1 && c.rank<=13 && c.alternateRank===undefined)).toBe(true);
  expect(s.rules).toMatchObject({columns:10,infinifillRows:4,elementSuits:false,dualRanks:false});
  expect(s.foes[0]).toMatchObject({name:'Dark Tyrant',hp:999,intent:'tableau',indominable:0});
 });
 it('gives each team all three end cards on both sides, and only the inner cards elsewhere',()=>{
  const s=start();
  for(let column=0;column<10;column++)for(let depth=0;depth<4;depth++)for(const team of ['party','enemy'] as const){
   const end=team==='party'?4:0;expect(verticalCanReach(s,column,depth,team)).toBe(depth===3 || depth>0 && column%5===end);
  }
 });
 it('plays the player-end outermost and middle cards without disturbing the inner card',()=>{
  let s=start();s={...s,party:s.party.map(a=>({...a,rank:2})),columns:s.columns.map((c,i)=>[{id:`blocked-${i}`,rank:9},{id:`outer-${i}`,rank:3},{id:`middle-${i}`,rank:4},{id:`inner-${i}`,rank:6}])};
  expect(anyLegalPlay(s)).toBe(true);expect(canPlay(s,'hero',s.columns[4][0])).toBe(false);
  s=playCard(s,4,'hero',false,1);expect(s.party[0].rank).toBe(3);expect(s.columns[4][3].id).toBe('inner-4');expect(s.columns[4][2].id).toBe('middle-4');
  s=playCard(s,4,'hero',false,2);expect(s.party[0].rank).toBe(4);expect(s.columns[4][3].id).toBe('inner-4');expect(s.columns.flat()).toHaveLength(40);
 });
 it('promotes the middle layer and then the outer layer when taking an inner card',()=>{
  let s=start();s={...s,party:s.party.map(a=>({...a,rank:2})),columns:s.columns.map((c,i)=>i?c:[{id:'blocked',rank:9},{id:'outer',rank:7},{id:'middle',rank:3},{id:'inner',rank:3}])};
  const next=playCard(s,0,'hero');expect(next.party[0].rank).toBe(3);expect(next.columns[0][3].id).toBe('middle');expect(next.columns[0][2].id).toBe('outer');expect(next.columns[0]).toHaveLength(4);
 });
 it('lets Dark Tyrant take its outermost top card while the inner and middle are unmatchable',()=>{
  let s=start();s={...s,foes:s.foes.map(f=>({...f,rank:2})),columns:s.columns.map((c,i)=>[{id:`blocked-${i}`,rank:3},{id:`outer-${i}`,rank:3},{id:`middle-${i}`,rank:6},{id:`inner-${i}`,rank:6}])};
  const next=tickBattle(endPlayerTurn(s),3);expect(next.foes[0].rank).toBe(3);expect(next.foes[0].foundationCards?.some(c=>c.id==='outer-0')).toBe(true);expect(next.columns[0][3].id).toBe('inner-0');expect(next.foes[0].indominable).toBe(1);
 });
 it('preserves five rows, four layers and A–K draws through stock exhaustion and Withdraw',()=>{
  const s:BattleState={...start(),stock:[]};let n=s;
  for(let i=0;i<150;i++){const drawn=drawCard(n);expect(drawn.card.rank>=1 && drawn.card.rank<=13).toBe(true);n={...n,stock:drawn.stock,dealt:drawn.dealt};}
  let next=withdrawPlayer({...s,foes:s.foes.map(f=>({...f,intent:'idle'}))});for(let i=0;i<100 && next.turn==='enemy';i++)next=tickBattle(next,1);
  expect(next.turn).toBe('party');expect(next.columns).toHaveLength(VERTICAL_ROWS*2);expect(next.columns.every(c=>c.length===VERTICAL_LAYERS && c.every(c=>c.rank>=1 && c.rank<=13))).toBe(true);
 });
});
describe('223 Stepping Stones',()=>{
 const step=()=>createCombatSandboxScenario('223');
 it('reaches exactly the fourteen nearest cards from the player end',()=>{
  const s=step();expect(s.sandboxScenario).toBe('223');expect(s.verticalStand).toBeUndefined();
  expect(steppingReach(s).size).toBe(STEPPING_REACH);
  const reachable=s.columns.flatMap((pile,column)=>pile.map((_,depth)=>verticalCanReach(s,column,depth,'party'))).filter(Boolean);expect(reachable).toHaveLength(STEPPING_REACH);
  // From the player end, the enemy-end row is out of reach and the player-end outermost cards are in.
  expect(verticalCanReach(s,0,3,'party')).toBe(false);expect(verticalCanReach(s,4,0,'party')).toBe(true);
 });
 it('moves Hero onto the played card\'s spot and recentres her reach',()=>{
  let s=step();s={...s,party:s.party.map(a=>({...a,rank:2})),columns:s.columns.map((c,i)=>[{id:`a-${i}`,rank:9},{id:`b-${i}`,rank:9},{id:`c-${i}`,rank:9},{id:`d-${i}`,rank:i===3?3:9}])};
  expect(verticalCanReach(s,3,3,'party')).toBe(true);
  const next=playCard(s,3,'hero',false,3);expect(next.party[0].rank).toBe(3);expect(next.verticalStand).toEqual(verticalSlot(3,0));
  expect(steppingReach(next).has('3:3')).toBe(true);expect(verticalCanReach(s,1,3,'party')).toBe(false);expect(verticalCanReach(next,1,3,'party')).toBe(true);expect(verticalCanReach(s,9,0,'party')).toBe(true);expect(verticalCanReach(next,9,0,'party')).toBe(false);
 });
 it('keeps the 222 rule for Dark Tyrant',()=>{
  const s=step();for(let column=0;column<10;column++)for(let depth=0;depth<4;depth++)expect(verticalCanReach(s,column,depth,'enemy')).toBe(depth===3 || depth>0 && column%5===0);
 });
 it('falls back to the player end on Withdraw',()=>{
  let s:BattleState={...step(),verticalStand:[0,0]};
  s=withdrawPlayer({...s,foes:s.foes.map(f=>({...f,intent:'idle'}))});for(let i=0;i<100 && s.turn==='enemy';i++)s=tickBattle(s,1);
  expect(s.turn).toBe('party');expect(s.verticalStand).toBeUndefined();
 });
});

describe('224 Tiled Floor',()=>{
 it('deals forty separate tiles and gives each team fourteen within its ring',()=>{
  const state=createCombatSandboxScenario('224');
  expect(state.columns).toHaveLength(40); expect(state.columns.every(pile=>pile.length===1)).toBe(true);
  for(const stand of [[-8,0],enemyStand(state),...state.columns.map((_,i)=>floorSlot(i))] as readonly (readonly [number,number])[]){
   const radius=steppingRadius(state,stand), inside=state.columns.filter((_,i)=>{const [x,z]=floorSlot(i);return Math.hypot(x-stand[0],z-stand[1])<=radius;});
   expect(inside).toHaveLength(14);expect(steppingReach(state,stand).size).toBe(14);
  }
  for(const team of ['party','enemy'] as const)expect(state.columns.filter((_,i)=>verticalCanReach(state,i,0,team))).toHaveLength(14);
 });
 it('moves the enemy ring to the tile it takes',()=>{
  let state=createCombatSandboxScenario('224'); const index=state.columns.findIndex((_,i)=>verticalCanReach(state,i,0,'enemy'));
  state={...state,foes:state.foes.map(f=>({...f,rank:2,rest:0})),columns:state.columns.map((pile,i)=>[{...pile[0],rank:i===index?3:9}])};
  const next=tickBattle(endPlayerTurn(state),1); expect(next.verticalEnemyStand).toEqual(floorSlot(index)); expect(next.columns[index]).toHaveLength(1);
 });
 it('holds the played tile until Hero moves and keeps fourteen other tiles reachable',()=>{
  let state=createCombatSandboxScenario('224');const index=state.columns.findIndex((_,i)=>verticalCanReach(state,i,0,'party'));
  state={...state,party:state.party.map(a=>({...a,rank:2})),columns:state.columns.map((pile,i)=>i===index?[{...pile[0],rank:3}]:pile)};
  const id=state.columns[index][0].id,next=playCard(state,index,'hero',false,0);
  expect(next.verticalStand).toEqual(floorSlot(index));expect(next.columns[index][0].id).toBe(id);expect(next.stock.length).toBe(state.stock.length);
  expect(verticalCanReach(next,index,0,'party')).toBe(false);expect(verticalCanReach(next,index,0,'enemy')).toBe(false);
  expect(next.columns.filter((_,i)=>verticalCanReach(next,i,0,'party'))).toHaveLength(14);
  const second=next.columns.findIndex((_,i)=>verticalCanReach(next,i,0,'party'));const prepared={...next,columns:next.columns.map((pile,i)=>i===second?[{...pile[0],rank:4}]:pile)};
  const moved=playCard(prepared,second,'hero',false,0);expect(moved.columns[index][0].id).not.toBe(id);expect(moved.columns[second][0].id).toBe(prepared.columns[second][0].id);expect(moved.stock.length).toBe(state.stock.length-1);
  expect(moved.columns.filter((_,i)=>verticalCanReach(moved,i,0,'party'))).toHaveLength(14);
 });
});

describe.each(['225','226','227','228'] as const)('%s floor variant',id=>{
 it('starts both actors on their own foundation values with fourteen reachable tiles',()=>{
  const state=createCombatSandboxScenario(id), layout=floorLayout(id), starts=floorStartIndices(id);
  expect(state.columns).toHaveLength(floorTileCount(id));expect(state.columns.every(pile=>pile.length===1)).toBe(true);
  expect(state.verticalStand).toEqual(floorSlot(starts.party,id));expect(state.verticalEnemyStand).toEqual(floorSlot(starts.enemy,id));
  expect(state.columns[starts.party][0].rank).toBe(state.party[0].rank);expect(state.columns[starts.enemy][0].rank).toBe(state.foes[0].rank);
  for(const team of ['party','enemy'] as const)expect(state.columns.filter((_,i)=>verticalCanReach(state,i,0,team))).toHaveLength(14);
  for(let i=0;i<state.columns.length;i++){const moving={...state,verticalStand:floorSlot(i,id),verticalEnemyStand:undefined};const stand=moving.verticalStand,radius=steppingRadius(moving,stand);const count=moving.columns.filter((_,j)=>{const [x,z]=floorSlot(j,id);return !occupiedFloor(moving,j) && Math.hypot(x-stand[0],z-stand[1])<=radius;}).length;expect(count).toBe(14);}
 });
 it('refills an occupied start tile only after moving and preserves reach on redeal',()=>{
  let state=createCombatSandboxScenario(id); const start=floorStartIndices(id).party, nextIndex=state.columns.findIndex((_,i)=>verticalCanReach(state,i,0,'party'));
  state={...state,party:state.party.map(a=>({...a,rank:2})),columns:state.columns.map((pile,i)=>i===nextIndex?[{...pile[0],rank:3}]:pile)};
  const moved=playCard(state,nextIndex,'hero',false,0);expect(moved.verticalStand).toEqual(floorSlot(nextIndex,id));expect(moved.columns[start][0].id).not.toBe(state.columns[start][0].id);expect(moved.columns[nextIndex][0].id).toBe(state.columns[nextIndex][0].id);
  let redeal=withdrawPlayer({...moved,foes:moved.foes.map(f=>({...f,intent:'idle'}))});for(let i=0;i<100 && redeal.turn==='enemy';i++)redeal=tickBattle(redeal,1);
  expect(redeal.verticalStand).toEqual(floorSlot(start,id));expect(redeal.columns[start][0].rank).toBe(redeal.party[0].rank);expect(redeal.columns.filter((_,i)=>verticalCanReach(redeal,i,0,'party'))).toHaveLength(14);
 });
});

it('228 covers the clearing with individual cards whose corners remain within its circular boundary',()=>{
 const layout=floorLayout('228'),state=createCombatSandboxScenario('228');
 expect(state.columns.length).toBeGreaterThan(80);expect(state.columns.length).toBeLessThan(layout.rows*layout.cols);
 for(let i=0;i<state.columns.length;i++){const [x,z]=floorSlot(i,'228');expect(Math.hypot(Math.abs(x)+layout.height/2,Math.abs(z)+layout.width/2)).toBeLessThanOrEqual(12.01);}
});
