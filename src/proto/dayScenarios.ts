import type { BiomeTileState, Card, ProtoState } from './protoState';
import { createInitialState } from './rules/setup';
import { SUPPER_MANA, OVERNIGHT_LIGHT_MANA, isHome } from './rules/ordinaryDay';
import { discoverActorTiles } from './tileDiscovery';
import { planTravel, traversalProfile, type TravelPlan } from './travelJourney';
import { findGridPath, type CellCost } from './gridPathfinding';
import { TABLE_GRID } from './gridCoordinates';
import { passageStepAllowed, terrainAtCell } from './terrainPassages';
import { SAVED_TILE_DOCUMENT, materializeTiles } from './tileEditor/runtime';
import { validateTileDocument, type TileDocument } from './tileEditor/schema';

export const DAY_ONE_STAMINA = 4;
export { OVERNIGHT_LIGHT_MANA } from './rules/ordinaryDay';
export const DAY_ONE_MANA_GOAL = SUPPER_MANA + OVERNIGHT_LIGHT_MANA;

/** Scenarios borrow the authored world. Only live deals and story state vary by day. */
function scenarioBase(document: TileDocument): ProtoState {
  validateTileDocument(document);
  const base = createInitialState(false);
  const biomeTiles = materializeTiles(document, base.biomeTiles, false);
  const den = biomeTiles.find(tile => tile.id === 'hero-den')!;
  const distance = (a: BiomeTileState, b: BiomeTileState) => Math.abs(a.position.x-b.position.x)+Math.abs(a.position.y-b.position.y);
  const sparse = biomeTiles.find(tile => tile.tileType === 'berry-patch' && tile.berryPatchVariant === 'sparse' && tile.unlocked);
  const patches = biomeTiles.filter(tile => tile.tileType === 'berry-patch' && tile.berryPatchVariant !== 'sparse' && tile.unlocked);
  const patch = patches.find(tile => tile.id === 'day-one-berries') ?? patches.sort((a,b)=>distance(a,den)-distance(b,den))[0];
  // Prefer woods just outside the patch, so the encounter belongs to an existing landmark.
  const woods = biomeTiles.filter(tile => !tile.tileType && !tile.road && tile.terrain === 'woods' && tile.unlocked && !tile.flags?.some(flag=>flag==='impassable'||flag==='danger'))
    .sort((a,b)=>distance(a,patch??den)-distance(b,patch??den))[0];
  return discoverActorTiles({...base, biomeTiles,
    dayScenarioTiles: { sparsePatchId: sparse?.id, patchId: patch?.id, woodsId: woods?.id },
    worldActors: base.worldActors.map(actor=>({...actor,position:{...den.position},luminosity:0})),
  });
}

function scenarioDeal(state: ProtoState, tileId: string | undefined, tableau: Card[][]): ProtoState {
  // Keep all authored fields (including deal-size tuning) available unchanged to the editor.
  return {...state, biomeTiles: state.biomeTiles.map(tile=>tile.id===tileId
    ? {...tile,tableau,stock:[],dealt:tableau.flat().length} : tile)};
}

function routeCost(state: ProtoState): CellCost {
  const cost: CellCost = (column,row) => {
    if(Math.abs(column)>7 || Math.abs(row)>7) return Infinity;
    const tile = terrainAtCell(state.biomeTiles,column,row);
    if(tile?.flags?.includes('unexplored')) return 1;
    if(tile && (!tile.unlocked || !tile.passage && (tile.tileType==='impassable-mountain'||tile.flags?.includes('impassable')) || tile.flags?.includes('danger'))) return Infinity;
    return 1 + Math.min(100,traversalProfile(tile).difficulty)*1e-9;
  };
  cost.canStep = (x,y,nx,ny)=>passageStepAllowed(state.biomeTiles,x,y,nx,ny);
  return cost;
}

function routeTo(state: ProtoState, from: {x:number;y:number}, tileId: string | undefined): TravelPlan {
  const target = state.biomeTiles.find(tile=>tile.id===tileId);
  const path = target && target.unlocked ? findGridPath(from,target.position,routeCost(state),TABLE_GRID.cellSize) : null;
  return path ? planTravel('hero',path,state.biomeTiles,{biomeId:target!.id,directBiome:true})
    : {actorId:'hero',path:[],segments:[],estimate:Infinity,cards:0,arrival:{}};
}

/** Balance the actor's reserve against the authored costs; never retune the tiles. */
function startingStamina(state: ProtoState, day: 'day01'|'day02') {
  const known = {...state,biomeTiles:state.biomeTiles.map(tile=>({...tile,flags:tile.flags?.filter(flag=>flag!=='unexplored')}))};
  const home = known.biomeTiles.find(tile=>tile.id==='hero-den')!;
  const patch = known.biomeTiles.find(tile=>tile.id===state.dayScenarioTiles?.patchId);
  const sparse = day === 'day01' && known.biomeTiles.find(tile => tile.id === state.dayScenarioTiles?.sparsePatchId);
  const approach = sparse ? routeTo(known,home.position,sparse.id).estimate : 0;
  const first = routeTo(known,sparse ? sparse.position : home.position,patch?.id);
  const second = patch ? routeTo(known,patch.position,day==='day01'?'hero-den':state.dayScenarioTiles?.woodsId) : first;
  const total = approach + first.estimate + second.estimate;
  return Math.max(day==='day01'?DAY_ONE_STAMINA:6,Number.isFinite(total)?Math.ceil(total+1):0);
}

export function createDayOneState(document: TileDocument = SAVED_TILE_DOCUMENT): ProtoState {
  let base = scenarioBase(document);
  const tableau: Card[][] = Array.from({length:7},(_,i)=>i<6?[{id:'day01-forage-'+i,rank:i+3,questStep:i,
    ...(i===0||i===5?{resource:'mana' as const,foodSource:'berries' as const}:{})}]:[]);
  base = scenarioDeal(base,base.dayScenarioTiles?.patchId,tableau);
  const stamina = startingStamina(base,'day01');
  return {...base,dayScenario:'day01',travelStamina:stamina,scenarioStaminaMax:stamina,
    scenarioStartingMana:0, ordinaryDay:{...base.ordinaryDay!,questCardSpawned:true}};
}

export const dayOneReturning = (s:ProtoState) => s.haul.mana >= (s.dayScenario === 'day01' ? DAY_ONE_MANA_GOAL : SUPPER_MANA) || Boolean(s.ordinaryDay?.supper);
export const dayTwoPatchForaged = (s:ProtoState) => s.haul.mana > (s.scenarioStartingMana ?? OVERNIGHT_LIGHT_MANA);
export const dayOneDestination = (s:ProtoState) => {
  if (s.dayScenario === 'day02') return dayTwoPatchForaged(s) ? s.dayScenarioTiles?.woodsId : s.dayScenarioTiles?.patchId;
  if (dayOneReturning(s)) return 'hero-den';
  const sparse = s.biomeTiles.find(tile => tile.id === s.dayScenarioTiles?.sparsePatchId);
  return sparse && !sparse.berryHarvested ? sparse.id : s.dayScenarioTiles?.patchId;
};
export function dayTravelAction(s: ProtoState): string | null {
  if (!s.dayScenario || s.dayScenario === 'day03' || s.dayTwoAmbush || s.ordinaryDay?.supper || s.ordinaryDay?.complete) return null;
  const target = s.biomeTiles.find(tile => tile.id === dayOneDestination(s));
  const hero = s.worldActors.find(actor => actor.id === 'hero');
  if (!target || !hero || Math.hypot(hero.position.x-target.position.x,hero.position.y-target.position.y)<1) return null;
  if (target.id === 'hero-den') return 'Return before dark';
  if (target.id === s.dayScenarioTiles?.sparsePatchId) return 'Visit nearby bush';
  if (target.id === s.dayScenarioTiles?.woodsId) return 'Search darker woods';
  return s.dayScenario === 'day01' ? 'Visit denser patch' : 'Visit manaberry patch';
}
export function dayOnePlan(state: ProtoState): TravelPlan {
  const hero = state.worldActors.find(actor=>actor.id==='hero')!;
  return routeTo(state,hero.position,dayOneDestination(state));
}
/** Story rails restrict the destination, without hiding or replacing the rest of the world. */
export function dayOneAllowsPlan(state: ProtoState, plan: TravelPlan) {
  if(!state.dayScenario) return true;
  if(state.dayScenario==='day03'||state.dayTwoAmbush||state.ordinaryDay?.supper||state.ordinaryDay?.bedtime||state.ordinaryDay?.complete||plan.actorId!=='hero') return false;
  const target = state.biomeTiles.find(tile=>tile.id===dayOneDestination(state));
  const hero = state.worldActors.find(actor=>actor.id==='hero');
  const start=plan.path[0],end=plan.path[plan.path.length-1],cost=routeCost(state);
  if(!target||!hero||!start||!end||start.x!==hero.position.x||start.y!==hero.position.y||end.x!==target.position.x||end.y!==target.position.y||plan.estimate>(state.travelStamina??0)) return false;
  for(let i=1;i<plan.path.length;i++){
    const from=TABLE_GRID.atWorld(plan.path[i-1]),to=TABLE_GRID.atWorld(plan.path[i]);
    if(from.column!==to.column&&from.row!==to.row)return false;
    const dx=Math.sign(to.column-from.column),dy=Math.sign(to.row-from.row);
    for(let x=from.column,y=from.row;x!==to.column||y!==to.row;x+=dx,y+=dy){
      if(!Number.isFinite(cost(x+dx,y+dy))||cost.canStep?.(x,y,x+dx,y+dy)===false)return false;
    }
  }
  return true;
}

/** Milestones, never a wall-clock deadline. Return remains safely before sunset. */
export function dayOneHour(s:ProtoState) {
  if(s.dayScenario==='day03')return 9;
  if(s.dayScenario==='day02')return s.dayTwoAmbush?17:dayTwoPatchForaged(s)?15.5:10;
  if(s.ordinaryDay?.complete||s.ordinaryDay?.bedtime)return 21;
  if(s.ordinaryDay?.supper)return 19;
  if(dayOneReturning(s))return isHome(s)?17.5:16.5;
  if(s.totalWorkCompleted>0)return 15;
  return isHome(s)?10:13;
}
/** The sparse harvest dialogue starts with the last legal play, not the walking buffer's easing tail. */
export function sparsePatchTableauComplete(s:ProtoState): boolean {
  const j=s.journey, sparseId=s.dayScenarioTiles?.sparsePatchId;
  return s.dayScenario==='day01' && Boolean(j && sparseId && j.actorId==='hero' &&
    j.arrival.biomeId===sparseId && j.completed>=j.cards && j.progress>=1 && !j.paused && !j.blocked &&
    s.biomeTiles.some(t=>t.id===sparseId && t.berryHarvested));
}
export function dayOneThought(s:ProtoState) {
  if(s.dayScenario==='day03')return 'Warm stone beneath me. Someone stayed. Banks is here... I am home.';
  if(s.dayScenario==='day02')return s.dayTwoAmbush?'The mana stirred something in the dark.':dayTwoPatchForaged(s)?'Only one fresh manaberry. I need two for supper, and I must keep yesterday’s berry to light my way. I will have to search the darker woods.':'Yesterday’s manaberry still lights my way. The bush outside is bare now. I should check the denser patch for food.';
  if(s.ordinaryDay?.complete)return 'The nights feel colder, too. I made it home, and kept one manaberry to light tomorrow’s search.';
  if(s.ordinaryDay?.bedtime)return 'Cold outside. Safe in my hollow. One manaberry is still glowing beside me for tomorrow.';
  if(s.ordinaryDay?.supper)return 'Two manaberries for supper. I will keep the last one to light my way to food tomorrow.';
  if(dayOneReturning(s))return isHome(s)?'Home before dark. Two for supper, and one to keep glowing for tomorrow.':'Three manaberries. Two for supper and one for tomorrow’s light. I need to get home before it gets too dark.';
  const sparse = s.biomeTiles.find(tile => tile.id === s.dayScenarioTiles?.sparsePatchId);
  if(sparse?.berryHarvested && s.selectedBiomeId !== s.dayScenarioTiles?.patchId)return 'There used to be enough manaberries right outside my den. I hardly had to wander at all. Now they are harder and harder to find... I will need to try the denser patch.';
  if(s.haul.mana>0)return 'This little glow will help me find my way. I still need two more manaberries for supper.';
  return 'The days are getting darker. The manaberries grow scarcer, and the nights feel colder. I should check the bush just outside my den.';
}
/** The expedition haul is a shared reserve carried by its leader; stored food emits no carried light. */
export function manaCarrierLuminosity(s:ProtoState,actorId:string,base=0) {
  const carrier=s.worldActors.find(a=>a.id==='hero')??s.worldActors[0];
  const carrying=actorId===carrier?.id ? Math.max(0,s.haul.mana-s.settledHaul.mana) : 0;
  return Math.max(base,Math.min(.75,carrying*.12));
}

export function createDayTwoState(document: TileDocument = SAVED_TILE_DOCUMENT, carriedMana = OVERNIGHT_LIGHT_MANA): ProtoState {
  let base = createDayOneState(document);
  const patchDeal: Card[][] = Array.from({length:7},(_,i)=>i<3?[{id:'day02-patch-'+i,rank:i+3,questStep:i,
    ...(i===2?{resource:'mana' as const,foodSource:'berries' as const}:{})}]:[]);
  const woodsDeal: Card[][] = Array.from({length:7},(_,i)=>i===0?[{id:'day02-woods-0',rank:3,questStep:0}]:i===1?[{id:'day02-woods-1',rank:4,questStep:1}]:i===2?
    [{id:'day02-woods-mana',rank:6,questStep:3,resource:'mana' as const,foodSource:'berries' as const},{id:'day02-woods-2',rank:5,questStep:2}]:[]);
  base = scenarioDeal(scenarioDeal(base,base.dayScenarioTiles?.patchId,patchDeal),base.dayScenarioTiles?.woodsId,woodsDeal);
  const stamina = startingStamina(base,'day02');
  return {...base,day:2,dayScenario:'day02',dayTwoAmbush:false,travelStamina:stamina,scenarioStaminaMax:stamina,
    scenarioStartingMana:carriedMana, haul:{...base.haul,mana:carriedMana},
    biomeTiles:base.biomeTiles.map(tile=>tile.berryPatchVariant==='sparse'?{...tile,berryHarvested:true}:tile)};
}
export function createDayThreeState(document: TileDocument = SAVED_TILE_DOCUMENT): ProtoState {
  const base=createDayOneState(document);
  const home=base.biomeTiles.find(tile=>tile.id==='hero-den')!.position;
  return {...base,day:3,dayScenario:'day03',ordinaryDay:{...base.ordinaryDay!,supper:true,bedtime:false,complete:false},
    worldActors:[...base.worldActors,{id:'banks',label:'Banks',location:'table',position:{x:home.x+12,y:home.y+2},luminosity:.15}]};
}
export function createDayScenario(id:string,document:TileDocument=SAVED_TILE_DOCUMENT,carriedMana?:number):ProtoState {
  if(id==='day01')return createDayOneState(document);
  if(id==='day02')return createDayTwoState(document,carriedMana);
  if(id==='day03')return createDayThreeState(document);
  const base = createInitialState(false);
  return discoverActorTiles({...base,biomeTiles:materializeTiles(document,base.biomeTiles,false)});
}
