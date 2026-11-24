import { dealDenseBerries, isDenseBerryStage, bestDenseBerryMove, travelCardPlayable, type TravelSequenceRule } from './denseBerryTableau';
import { TRAVERSAL_TABLEAUS_ENABLED } from './traversalTesting';
import { resolveLayout, dealLayout, type TableauLayout } from './tableauLayouts';
import { assignedMovesFor } from './actorLoadouts';
import { terrainAtCell, passageStepAllowed, type TerrainPassage } from './terrainPassages';
import { partyMembers } from './partySystem';
import { FOUNDATION_MOCKUPS, type Card, type ProtoState, type BiomeTileState } from './protoState';
import { TABLE_GRID } from './gridCoordinates';
import { discoverTiles } from './tileDiscovery';
import { pathTime, pointAlongTimedPath, remainingPath, type TimedPoint } from './gridPathfinding';
import { assessSolverMove } from './tableauSolver';
import { EVENT_CARDS_ENABLED, applySimpleEvent, eventChangesRank, eventPlayCost, spawnTableauEvent, type EventUtility } from './eventCards';

/** Use the same finite backfill model as travel's visible window. */
export function bestTravelMove(journey: TravelJourney): number | null {
  if(currentTravelSegment(journey)?.segment.passage && !journey.passageStage)return null;
  if(journey.waitingForTraversal!==undefined || journey.obstruction || journey.paused || journey.blocked || travelTableauHeld(journey))return null;
  if(journey.columns.flat().some(card=>card.id.startsWith('dense-')))return bestDenseBerryMove(journey);
  const safeColumns=journey.columns.map(column=>column[column.length-1]?.event?[]:column);
  return assessSolverMove({ columns: safeColumns, stock: journey.reserve.filter(card=>!card.event), foundations: Object.values(journey.memberRanks ?? { [journey.actorId]: journey.rank }) })?.move.column ?? null;
}

export type TravelTerrain = Pick<BiomeTileState, 'id' | 'title' | 'position' | 'gridSize' | 'tileType' | 'terrain' | 'road' | 'flags' | 'traversalProgress' | 'berryPatchVariant' | 'berryHarvested'> & { passage?: TerrainPassage; passageOpen?: boolean; unlocked?: boolean } & { traversalDifficulty?: number; travelCards?: number };
export type TravelSegment = { denseBerry?: boolean; traversalStage?: 'exit' | 'enter' | 'gather'; layout?: TableauLayout; sparseBerry?: boolean; passage?: TerrainPassage; passageOpen?: boolean; tileId?: string; title: string; kind: string; unknown: boolean; cards: number; stamina: number; end: number; start: number; easy?: boolean; cellKey?: string };
export type TravelPlan = { ordered?: boolean; actorId: string; path: TimedPoint[]; segments: TravelSegment[]; estimate: number; cards: number; arrival: { biomeId?: string; directBiome?: boolean; foundationIndex?: number } };
export type TravelCard = Card & { khadRoot?: import('./khadRoots').KhadRootBinding; sequenceRule?: TravelSequenceRule; segment: number; kind: string; pose?: { x: number; y: number; rotation: number; layer: number } };
export type TravelJourney = TravelPlan & { traversalSuspended?: boolean; denseBerryChoice?: 'collect' | 'leave'; orderedStage?: number; walkedProgress?: number; waitingForTraversal?: number; obstruction?: { segment: number; title: string; tags: string[]; cost: number }; passageStage?: { segment: number; columns: TravelCard[][]; reserve: TravelCard[] }; eventBackfill?: { card: TravelCard; column: number; index: number }; pendingSearch?: number; search?: { remaining: number; total: number; columns: TravelCard[][]; reserve: TravelCard[]; segment: number }; memberRanks?: Record<string, number>; columns: TravelCard[][]; reserve: TravelCard[]; rank: number; completed: number; streak: number; tileStreak: number; progress: number; spent: number; berries: number; bonus: string; paused: boolean; bonusSegments: number[]; blocked?: { progress: number; position: {x:number;y:number}; message:string }; checkedProgress?: number; priorCompleted?: number; completedCardIds?: string[] };
export const TRAVEL_STAMINA_MAX = 24;
export const EASY_CROSSING_CARDS = 3;
export const SEARCH_STAMINA = 1.5;
export const SEARCH_CARDS = 4;
export const TRAVEL_MASTERY_CROSSINGS = 5;

/** Isolate authored crossings from the journey-wide ordinary card window. */
export function preparePassageStage(state: ProtoState): ProtoState {
  let j=state.journey; const active=j&&currentTravelSegment(j);
  if(!j||!active||j.passageStage||j.blocked||j.waitingForTraversal!==undefined)return state;
  if(isDenseBerryStage(active.segment)){
    if(j.ordered && j.orderedStage===active.index)return state;
    return {...state,journey:denseBerryJourney(j,active.index,state.dayScenario!=='day02')};
  }
  if(j.ordered){
    if(j.orderedStage===active.index)return state;
    let stage=active.segment;
    const tile=state.biomeTiles.find(t=>t.id===stage.tileId);
    if(stage.unknown && tile && !tile.flags?.includes('unexplored')){
      const profile=traversalProfile(tile),a=pointAlongTimedPath(j.path,stage.start),b=pointAlongTimedPath(j.path,stage.end);
      const updated={...stage,unknown:false,kind:profile.kind,title:stage.traversalStage==='exit'?stage.title:tile.title,cards:stage.traversalStage==='exit'?6:profile.cards,stamina:profile.difficulty*Math.hypot(b.x-a.x,b.y-a.y)/TABLE_GRID.cellSize};
      j={...j,cards:j.cards+updated.cards-stage.cards,estimate:j.estimate+updated.stamina-stage.stamina,segments:j.segments.map((s,i)=>i===active.index?updated:s)};stage=updated;
    }
    const offsets=stage.traversalStage==='exit'?[1,0,1,0,1,0]:Array.from({length:stage.cards},(_,i)=>i+1);
    const columns:TravelCard[][]=Array.from({length:stage.traversalStage==='exit'?3:7},()=>[]);
    const stageRank=j.rank;
    offsets.forEach((offset,i)=>columns[i%columns.length].unshift({id:`stage-${active.index}-${i}`,rank:(stageRank-1+offset)%13+1,segment:active.index,kind:stage.kind}));
    return {...state,journey:{...j,orderedStage:active.index,columns,reserve:[]}};
  }
  if(active.segment.kind==='den-exit'){
    const columns:TravelCard[][]=Array.from({length:6},(_,i)=>[{id:`den-exit-${j.actorId}-${i}`,rank:(j.rank-1+[1,0,1,0,1,0][i])%13+1,segment:active.index,kind:'hero-den'}]);
    return {...state,journey:{...j,passageStage:{segment:active.index,columns:j.columns,reserve:j.reserve},columns,reserve:[]}};
  }
  if(active.segment.layout){
    const columns:TravelCard[][]=dealLayout(active.segment.layout, active.index+17).map(group=>group.map(c=>({id:'layout-'+active.index+'-'+c.id,rank:c.rank,segment:active.index,kind:active.segment.kind,pose:{x:c.x,y:c.y,rotation:c.rotation,layer:c.layer}})));
    columns.flat().forEach((card,i)=>{
      const id='travel-'+j.actorId+'-'+(active.segment.tileId??active.index)+'-'+active.index+'-'+i;
      let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);
      hash=Math.imul(hash^(hash>>>16),0x85ebca6b);hash=Math.imul(hash^(hash>>>13),0xc2b2ae35);hash^=hash>>>16;
      const berry=active.segment.sparseBerry!==undefined ? active.segment.sparseBerry&&i===active.segment.cards-1 : !state.dayScenario&&active.segment.kind==='berry-patch'&&(hash>>>0)/4294967296<.2;
      if(berry){card.resource='mana';card.foodSource='berries';}
    });
    return {...state,journey:{...j,passageStage:{segment:active.index,columns:j.columns,reserve:j.reserve},columns,reserve:[]}};
  }
  if(!active.segment.passage)return state;
  const p=active.segment.passage;
  const opened=state.biomeTiles.find(t=>t.id===active.segment.tileId)?.passageOpen===true;
  const columns:TravelCard[][]=Array.from({length:p.columns},()=>[]);
  for(let i=0;i<active.segment.cards-active.done;i++)columns[i%p.columns].unshift({id:`passage-${j.actorId}-${active.segment.tileId}-${active.index}-${i}`,rank:(j.rank+i)%13+1,segment:active.index,kind:active.segment.kind});
  return {...state,journey:{...j,passageStage:{segment:active.index,columns:j.columns,reserve:j.reserve},
    columns:opened?columns:[[{id:`obstruction-${active.segment.tileId}`,rank:j.rank,kind:active.segment.kind,segment:active.index}]],reserve:[],
    obstruction:opened?undefined:{segment:active.index,title:p.title,tags:p.tags,cost:p.breachAP},bonus:opened?'Opened passage':`${p.title} · ${p.tags.map(t=>'#'+t).join(' ')} · breach or choose another route`}};
}

export function passageAbilities(state:ProtoState, actorId:string) {
  const j=state.journey,o=j?.obstruction;
  if(!o||!j||j.paused||j.blocked||!partyMembers(state,j.actorId).some(a=>a.id===actorId))return [];
  return assignedMovesFor(actorId).filter(move=>move.terrainTags?.some(tag=>o.tags.includes(tag)));
}

/** Explicit targeted action: clearing the obstruction grants no distance, ranks or rewards. */
export function breachTravelPassage(state:ProtoState,actorId:string,abilityName:string):ProtoState {
  const j=state.journey,o=j?.obstruction;
  if(!j||!o||!passageAbilities(state,actorId).some(m=>m.name===abilityName)||(state.utilityAP?.[actorId]??0)<o.cost)return state;
  const segment=j.segments[o.segment];
  const tiles=state.biomeTiles.map(t=>t.id===segment.tileId?{...t,passageOpen:true}:t);
  const saved=j.passageStage!;
  // Rebuild the revealed puzzle from the unchanged foundation rank.
  return preparePassageStage({...state,biomeTiles:tiles,utilityAP:{...state.utilityAP,[actorId]:(state.utilityAP?.[actorId]??0)-o.cost},
    journey:{...j,columns:saved.columns,reserve:saved.reserve,passageStage:undefined,obstruction:undefined}});
}

export function traversalProfile(tile?: TravelTerrain, affinity: Partial<Record<string, number>> = {}) {
  if (tile?.flags?.includes('unexplored')) return { kind: 'unexplored', difficulty: 1, cards: 7 };
  const kind = !tile ? 'path' : tile.road ? 'path' : tile.tileType === 'unexplored' ? 'path' : tile.tileType ?? tile.terrain ?? 'woods';
  const base = tile?.traversalDifficulty ?? (({ 'hero-den': 0, path: 0, dirt: 1, 'berry-patch': 2, woods: 3, water: 4 } as Record<string, number>)[kind] ?? 3);
  const difficulty = Math.max(0, base * (affinity[kind] ?? 1));
  return { kind, difficulty, cards: Math.max(1, Math.floor(tile?.travelCards ?? (base <= 1 ? EASY_CROSSING_CARDS : 12))) };
}

/** Expand simplified A* legs back into grid crossings; never seed the origin. */
export function planTravel(actorId: string, path: TimedPoint[], tiles: readonly TravelTerrain[], arrival: TravelPlan['arrival'] = {}, affinity: Partial<Record<string, number>> = {}): TravelPlan {
  const segments: TravelSegment[] = [];
  let elapsed = 0;
  const total = pathTime(path);
  for (let leg = 1; leg < path.length; leg++) {
    const a = path[leg - 1], b = path[leg];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / TABLE_GRID.cellSize));
    for (let step = 1; step <= steps; step++) {
      const point = { x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps };
      const cell = TABLE_GRID.atWorld(point);
      const tile = tiles.find(t => { const anchor = TABLE_GRID.atWorld(t.position); const left = anchor.column - Math.floor(t.gridSize.columns / 2), top = anchor.row - Math.floor(t.gridSize.rows / 2); return cell.column >= left && cell.column < left + t.gridSize.columns && cell.row >= top && cell.row < top + t.gridSize.rows; });
      const profile = traversalProfile(tile, affinity);
      const layout = !tile?.flags?.includes('unexplored') && !tile?.passage ? resolveLayout(profile.kind,tile?.berryPatchVariant==='sparse') : undefined;
      if(layout)profile.cards=layout.cards.length;
      const start = total ? elapsed / total : 0;
      elapsed += length * b.pace / steps;
      const unknown = Boolean(tile?.flags?.includes('unexplored'));
      segments.push({ ...(!unknown && profile.kind==='berry-patch' && tile?.berryPatchVariant!=='sparse' && !layout && !tile?.passage && profile.cards===12 ? {denseBerry:true}:{}), ...(layout?{layout}:{}), ...(!unknown && tile?.berryPatchVariant === 'sparse' ? { sparseBerry: !tile.berryHarvested } : {}), ...(!unknown && tile?.passage ? { passage: tile.passage, passageOpen: tile.passageOpen } : {}), tileId: tile?.id, title: unknown ? 'Unknown terrain' : tile?.title ?? 'Open table', kind: profile.kind, unknown, cards: profile.cards, stamina: profile.difficulty * length / steps / TABLE_GRID.cellSize, easy:!unknown&&profile.difficulty<=1,cellKey:TABLE_GRID.reference(cell), start, end: total ? elapsed / total : 1 });
    }
  }
  // Ordered traversal trial for departures from a known sparse patch.
  const sourceCell=path[0]&&TABLE_GRID.atWorld(path[0]);
  const source=sourceCell&&terrainAtCell(tiles,sourceCell.column,sourceCell.row);
  if(source?.berryPatchVariant==='sparse' && !source.flags?.includes('unexplored') && segments.length && !segments.some(s=>s.passage)){
    const ordered:TravelSegment[]=[];
    segments.forEach((segment,index)=>{
      const from=pointAlongTimedPath(path,segment.start),cell=TABLE_GRID.atWorld(from),tile=terrainAtCell(tiles,cell.column,cell.row);
      const profile=traversalProfile(tile,affinity),mid=(segment.start+segment.end)/2;
      const toward=pointAlongTimedPath(path,segment.end),dx=toward.x-from.x,dy=toward.y-from.y;
      const direction=Math.abs(dx)>Math.abs(dy)?dx<0?'West':'East':dy<0?'North':'South';
      ordered.push({tileId:tile?.id,title:`Leave ${tile?.title??'tile'} · ${direction}`,kind:profile.kind,unknown:Boolean(tile?.flags?.includes('unexplored')),sparseBerry:tile?.berryPatchVariant==='sparse'?false:undefined,traversalStage:'exit',cards:6,stamina:segment.stamina/2,start:segment.start,end:mid,cellKey:(index?segments[index-1].cellKey:TABLE_GRID.reference(sourceCell!))+':exit'});
      if (segment.denseBerry) {
        const gatheringStart = (mid + segment.end) / 2;
        ordered.push({...segment, denseBerry:undefined, layout:undefined, sparseBerry:undefined, traversalStage:'enter', cards:6, start:mid, end:gatheringStart, stamina:segment.stamina/4, cellKey:segment.cellKey+':approach'});
        ordered.push({...segment,layout:undefined,sparseBerry:undefined,traversalStage:'gather',start:gatheringStart,stamina:segment.stamina/4});
      } else ordered.push({...segment,layout:undefined,sparseBerry:undefined,traversalStage:'enter',start:mid,stamina:segment.stamina/2});
    });
    return {actorId,path,arrival,ordered:true,segments:ordered,estimate:ordered.reduce((n,s)=>n+s.stamina,0),cards:ordered.reduce((n,s)=>n+s.cards,0)};
  }
  // Trial: earn the origin's north-facing half-tile before entering its neighbour.
  const origin=tiles.find(t=>t.tileType==='hero-den' && path[0] && Math.hypot(t.position.x-path[0].x,t.position.y-path[0].y)<1);
  if(origin && segments.length && path[1]?.x===path[0].x && path[1].y<path[0].y){
    const first=segments[0],mouth=first.end/2;
    first.start=mouth;
    segments.unshift({tileId:origin.id,title:'Leave the Den · North',kind:'den-exit',unknown:false,cards:6,stamina:0,start:0,end:mouth,cellKey:TABLE_GRID.reference(TABLE_GRID.atWorld(origin.position))+':north'});
  }
  return { actorId, path, arrival, segments, estimate: segments.reduce((n, s) => n + s.stamina, 0), cards: segments.reduce((n, s) => n + s.cards, 0) };
}

/** Idle foundations and the last earned travel rank share one journey handoff. */
export function travelStartingRank(state:ProtoState,actorId:string,fallback=2){
  const actor=state.worldActors.find(a=>a.id===actorId);
  return actor?.location==='foundation' ? state.foundations[actor.foundationIndex??0]?.card.rank??state.travelRanks?.[actorId]??fallback : state.travelRanks?.[actorId]??fallback;
}

/** Runtime policy; the original planner/dealer remains available to authoring and tests. */
export function playtestTravelPlan(plan:TravelPlan):TravelPlan {
  if(TRAVERSAL_TABLEAUS_ENABLED)return plan;
  const segments=plan.segments.filter(s=>s.kind!=='den-exit').map(segment=>{
    const gathering=segment.tileId===plan.arrival.biomeId && (segment.sparseBerry===true || segment.denseBerry && segment.traversalStage!=='exit');
    return gathering ? {...segment,start:1,end:1,traversalStage:undefined} :
      {...segment,cards:0,stamina:0,layout:undefined,passage:undefined,sparseBerry:undefined,denseBerry:undefined,traversalStage:undefined};
  });
  return {...plan,ordered:false,segments,cards:segments.reduce((n,s)=>n+s.cards,0),estimate:segments.reduce((n,s)=>n+s.stamina,0)};
}
export function beginPlaytestJourney(plan:TravelPlan,startingRank=2,foodPickups=true):TravelJourney {
  return {...beginJourney(playtestTravelPlan(plan),startingRank,foodPickups),traversalSuspended:!TRAVERSAL_TABLEAUS_ENABLED};
}

export function beginJourney(plan: TravelPlan, startingRank = 2, foodPickups = true): TravelJourney {
  if(plan.ordered){
    const first=plan.segments[0],columns:TravelCard[][]=Array.from({length:3},()=>[]);
    [1,0,1,0,1,0].forEach((offset,i)=>columns[i%3].unshift({id:`stage-0-${i}`,rank:(startingRank-1+offset)%13+1,segment:0,kind:first.kind}));
    return {...plan,columns,reserve:[],rank:startingRank,completed:0,streak:0,tileStreak:0,progress:0,orderedStage:0,walkedProgress:0,spent:0,berries:0,bonus:'',paused:false,bonusSegments:[]};
  }
  const cards: TravelCard[] = [];
  let rank = startingRank;
  plan.segments.forEach((segment, index) => {
    if(segment.kind==='den-exit')return;
    if(isDenseBerryStage(segment)){rank=(rank+segment.cards-1)%13+1;return;}
    if(segment.passage||segment.layout){rank=(rank+segment.cards-1)%13+1;return;}
    for (let i = 0; i < segment.cards; i++) {
      rank = rank % 13 + 1;
      // Independent deterministic 20% berry roll for each travel card.
      let hash = 2166136261;
      const id = `travel-${plan.actorId}-${segment.tileId ?? index}-${index}-${i}`;
      for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
      hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
      hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
      hash ^= hash >>> 16;
      const berry = segment.sparseBerry !== undefined ? segment.sparseBerry && i === segment.cards - 1
        : foodPickups && segment.kind === 'berry-patch' && (hash >>> 0) / 4294967296 < .2;
      cards.push({ id, rank, segment: index, kind: segment.unknown ? 'unexplored' : segment.kind, ...(berry ? { resource: 'mana' as const, foodSource: 'berries' as const } : {}) });
    }
  });
  // Preserve the legacy sparse approach when no reusable layout is assigned.
  const sparseApproach = plan.segments.filter(segment => segment.cards > 0 && segment.kind!=='den-exit').every(segment => segment.sparseBerry !== undefined);
  const columnCount = sparseApproach ? 1 : 7;
  const columns: TravelCard[][] = Array.from({ length: columnCount }, () => []);
  cards.slice(0, 28).forEach((card, i) => columns[i % columnCount].unshift(card));
  if (sparseApproach && cards.length === 6) {
    // A consecutive ladder makes every legal choice safe, including A/K wrap.
    // The repeated 3 → 2 branch formerly stranded the remaining 5 and 6.
    // Explicit coverage and scenery poses remain independent of rank ordering.
    const ranks = cards.map((_, index) => (startingRank + index) % 13 + 1);
    const poses = [[1.2, 2.05, 0, 6], [2.2, .15, 7, 2], [1.3, 1.12, 0, 3], [.08, 1.55, -8, 7], [.35, .05, -6, 1], [.45, 1.65, 0, 5]];
    cards.forEach((card, index) => {
      card.rank = ranks[index];
      const [x, y, rotation, layer] = poses[index];
      card.pose = { x, y, rotation, layer };
    });
    columns.splice(0, columns.length, [cards[4], cards[3]], [cards[1]], [cards[2], cards[0]], [cards[5]]);
    if (plan.segments.some(segment => segment.sparseBerry)) {
      // Optional branch: its cover is never adjacent to any required route rank.
      const segment = cards[5].segment;
      columns.push([
        { id: cards[5].id+'-unreachable-berry', rank:(startingRank+9)%13+1, segment, kind:'berry-patch', resource:'mana', foodSource:'berries', khadRoot:{groupId:'sparse-berry-khad'}, pose:{x:3.45,y:.35,rotation:8,layer:1} },
        { id: cards[5].id+'-illegal-cover', rank:(startingRank+8)%13+1, segment, kind:'berry-patch', khadRoot:{groupId:'sparse-berry-khad'}, pose:{x:2.85,y:1.4,rotation:5,layer:2} },
      ]);
    }
  }
  const firstWork = plan.segments.find(s => s.cards > 0);
  const exit=plan.segments[0]?.kind==='den-exit';
  const exitColumns:TravelCard[][]=Array.from({length:6},(_,i)=>[{id:`den-exit-${plan.actorId}-${i}`,rank:(startingRank-1+[1,0,1,0,1,0][i])%13+1,segment:0,kind:'hero-den'}]);
  const journey:TravelJourney = { ...plan, ...(exit?{passageStage:{segment:0,columns,reserve:cards.slice(28)}}:{}), columns:exit?exitColumns:columns, reserve:exit?[]:cards.slice(28), rank: startingRank, completed: 0, streak: 0, tileStreak: 0, progress: firstWork?.start ?? 1, spent: 0, berries: 0, bonus: '', paused: false, bonusSegments: [], walkedProgress:0 };
  return firstWork && isDenseBerryStage(firstWork)?denseBerryJourney(journey,plan.segments.indexOf(firstWork),true):journey;
}

function denseBerryJourney(journey:TravelJourney,index:number,foodPickups=true):TravelJourney {
  const columns=dealDenseBerries(journey.rank,index);
  if(!foodPickups)columns.flat().forEach(card=>{delete card.resource;delete card.foodSource;});
  return {...journey,columns,reserve:[],...(journey.ordered?{orderedStage:index}:{passageStage:{segment:index,columns:journey.columns,reserve:journey.reserve}})};
}

/** The occupied tile ends at its outgoing stage, or at the final destination. */
export function travelTileThreshold(journey:TravelJourney){
  const index=journey.waitingForTraversal??currentTravelSegment(journey)?.index;
  if(index===undefined)return 1;
  const stage=journey.segments[index];
  let end=stage.end;
  if(stage.traversalStage==='enter')for(const next of journey.segments.slice(index+1)){
    if(next.tileId!==stage.tileId)break;
    end=next.end;if(next.traversalStage==='exit')break;
  }
  return end;
}

export const travelPlayable = (rank: number, target: number) => rank === target % 13 + 1 || target === rank % 13 + 1;
export function currentTravelSegment(journey: TravelJourney) {
  let previous = 0;
  for (let index = 0; index < journey.segments.length; index++) { const s = journey.segments[index]; if (s.cards && journey.completed < previous + s.cards) return { segment: s, index, previous, done: journey.completed - previous }; previous += s.cards; }
  return null;
}

/** Events hold their tile's boundary, not legal plays in its remaining deal. */
export function travelTableauHeld(journey: TravelJourney): boolean {
  if(journey.search)return false;
  const active=currentTravelSegment(journey)?.index??journey.segments.length;
  return [...journey.columns.flat(),...journey.reserve].some(card=>card.event&&card.segment<active);
}

export function prepareTravelTableau(state: ProtoState): ProtoState {
  state=preparePassageStage(state);
  if (!EVENT_CARDS_ENABLED) return removeTravelEvents(state);
  const j=state.journey,active=j&&currentTravelSegment(j);
  if(!j||!active||j.search||j.paused||j.blocked||j.pendingSearch!==undefined||travelTableauHeld(j)||!active.segment.easy)return state;
  const key=active.segment.cellKey??active.segment.tileId??`segment-${active.index}`;
  const visit=state.travelVisits?.[key];
  if(visit?.day===state.day&&visit.searchOffered)return state;
  return offerTravelSearch(state,active.index,key);
}

/** Release an in-progress event decision when the feature is retired. Preserve
 * earned travel, rank, costs and the exact remaining ordinary card inventory. */
export function removeTravelEvents(state: ProtoState): ProtoState {
  const j = state.journey;
  if (!j || (!j.search && j.pendingSearch === undefined && !j.eventBackfill && ![...j.columns.flat(), ...j.reserve].some(card => card.event))) return state;
  const columns = (j.search?.columns ?? j.columns).map(cards => cards.filter(card => !card.event));
  const reserve = (j.search?.reserve ?? j.reserve).filter(card => !card.event);
  if (j.eventBackfill) columns[j.eventBackfill.column].splice(j.eventBackfill.index, 0, j.eventBackfill.card);
  while (columns.length > 7 && !columns[columns.length - 1].length) columns.pop();
  return { ...state, journey: { ...j, columns, reserve, search: undefined, pendingSearch: undefined, eventBackfill: undefined, bonus: '' } };
}

/** All rewards/costs commit together, so retries and invalid plays award nothing. */
export function playTravelCard(state: ProtoState, columnIndex: number, receivingActorId?: string): ProtoState {
  if(state.journey && currentTravelSegment(state.journey)?.segment.passage && !state.journey.passageStage)return preparePassageStage(state);
  if(state.journey?.search)return playSearchCard(state,columnIndex,receivingActorId);
  const eventColumn=state.journey?.columns[columnIndex];
  if(eventColumn?.[eventColumn.length-1]?.event)return playTravelEvent(state,columnIndex,eventColumn.length-1,receivingActorId);
  if(denseBerryChoicePending(state))return state;
  const ranks = state.journey?.memberRanks ?? (state.journey ? { [state.journey.actorId]: state.journey.rank } : {});
  const top = state.journey?.columns[columnIndex]?.[state.journey.columns[columnIndex].length - 1];
  const receiver = receivingActorId ?? Object.keys(ranks).find(id => top && travelCardPlayable(top, ranks[id]));
  if (!receiver || ranks[receiver] === undefined) return state;

  const initial=state.journey, column=initial?.columns[columnIndex], candidate=column?.[column.length-1];
  if(initial?.traversalSuspended && (initial.walkedProgress??0)<1)return state;
  const activeBefore=initial && currentTravelSegment(initial);
  if(!initial || initial.waitingForTraversal!==undefined || initial.obstruction || initial.blocked || initial.paused || travelTableauHeld(initial) || !candidate || !travelCardPlayable(candidate,ranks[receiver]) || !activeBefore || (state.travelStamina??TRAVEL_STAMINA_MAX)<activeBefore.segment.stamina/activeBefore.segment.cards*(1-Math.min(.2,initial.streak*.02)))return state;
  if (state.journey && !state.journey.paused && !state.journey.blocked) {
    const start=currentTravelSegment(state.journey)?.segment.start ?? 0;
    for (const segment of state.journey.segments) {
      if(segment.start>start+1e-9)break;
      state=checkTravelCairn(state,segment.start);
      if(state.journey?.blocked)return state;
    }
  }
  state=prepareTravelTableau(state);
  const journey = state.journey;
  const card = journey?.columns[columnIndex]?.[journey.columns[columnIndex].length - 1];
  if (!journey || journey.obstruction || journey.blocked || journey.paused || !card || !travelCardPlayable(card, journey.memberRanks?.[receiver] ?? journey.rank)) return state;
  const active = currentTravelSegment(journey);
  if (!active) return state;
  const tileStreak = journey.tileStreak + 1, streak = journey.streak + 1;
  const cost = active.segment.stamina / active.segment.cards * (1 - Math.min(.2, (streak - 1) * .02));
  const stamina = state.travelStamina ?? TRAVEL_STAMINA_MAX;
  if (stamina + 1e-9 < cost) return state;
  const visitKey=active.segment.cellKey??active.segment.tileId??`segment-${active.index}`;
  const priorVisit=state.travelVisits?.[visitKey];
  const depleted=priorVisit?.day===state.day&&priorVisit.crossed;
  const sparseTile = state.biomeTiles.find(tile => tile.id === active.segment.tileId && tile.berryPatchVariant === 'sparse');
  const sparseBerry = !journey.ordered && Boolean(sparseTile && !sparseTile.berryHarvested && active.done + 1 === active.segment.cards);
  const bonusBerries = !journey.ordered && !sparseTile && !active.segment.denseBerry && !state.dayScenario && !depleted && active.segment.kind === 'berry-patch' && tileStreak === 7 && !journey.bonusSegments.includes(active.index) ? 3 : 0;
  const berries = journey.ordered && !active.segment.denseBerry || depleted ? 0 : sparseTile ? Number(sparseBerry) : state.dayScenario && !(state.dayScenario==='day01' && active.segment.denseBerry) ? 0 : (card.foodSource ? 1 : 0) + bonusBerries;
  const completed = journey.completed + 1;
  const tileDone = active.done + 1 === active.segment.cards;
  const nextWork = journey.segments.slice(active.index + 1).find(s => s.cards > 0);
  const progress = tileDone ? nextWork?.start ?? 1 : active.segment.start + (active.segment.end - active.segment.start) * (active.done + 1) / active.segment.cards;
  const reserve = [...journey.reserve];
  const replacement = reserve.shift();
  const columns = journey.columns.map((c, i) => i === columnIndex ? [...(replacement ? [replacement] : []), ...c.slice(0, -1)] : c);
  let next: ProtoState = { ...state, travelRanks:{...state.travelRanks,[receiver]:card.rank}, travelStamina: Math.max(0, stamina - cost), haul: { ...state.haul, mana: state.haul.mana + berries }, utilityAP: { ...state.utilityAP, [receiver]: (state.utilityAP?.[receiver] ?? 0) + (depleted?0:1) },
    biomeTiles: state.biomeTiles.map(tile => tile.id === active.segment.tileId ? { ...tile,
      ...(sparseBerry ? { berryHarvested: true } : {}),
      ...(state.dayScenario==='day01' && active.segment.denseBerry ? {tableau:[],stock:[],berryHarvested:tileDone} : {}),
      ...(active.segment.unknown || tile.traversalProgress !== undefined ? { traversalProgress: tile.traversalProgress ?? 0, flags: tile.flags?.filter(f => f !== 'unexplored') } : {}) } : tile),
    journey: { ...journey, completedCardIds: [...(journey.completedCardIds ?? []),card.id], bonusSegments: bonusBerries ? [...journey.bonusSegments, active.index] : journey.bonusSegments, eventBackfill:journey.eventBackfill && replacement && journey.eventBackfill.column===columnIndex ? {...journey.eventBackfill,index:journey.eventBackfill.index+1} : journey.eventBackfill, columns, reserve, rank: receiver === journey.actorId ? card.rank : journey.rank, memberRanks: { ...(journey.memberRanks ?? { [journey.actorId]: journey.rank }), [receiver]: card.rank }, completed, streak, tileStreak: tileDone ? 0 : tileStreak, progress, spent: journey.spent + cost, berries: journey.berries + berries, bonus: bonusBerries ? '7 card streak bonus: 3 manaberries' : tileDone ? 'Cairn reached' : journey.bonus } };
  if(tileDone){
    if(journey.ordered)return {...next,journey:{...next.journey!,waitingForTraversal:active.index,columns:[],reserve:[],bonus:'Walking to the next stage'}};
    if(journey.passageStage){ const saved=journey.passageStage; next={...next,journey:{...next.journey!,passageStage:undefined,columns:saved.columns,reserve:saved.reserve}}; }
    next={...next,travelVisits:{...next.travelVisits,[visitKey]:{day:state.day,crossed:true,searchOffered:priorVisit?.day===state.day&&priorVisit.searchOffered}},
      terrainCrossings:depleted?next.terrainCrossings:{...next.terrainCrossings,[active.segment.kind]:(next.terrainCrossings?.[active.segment.kind]??0)+1}};
    if(travelTableauHeld(next.journey!))return {...next,journey:{...next.journey!,progress:active.segment.end,bonus:'Tile work complete · resolve or discard its event to continue'}};
    return prepareTravelTableau(checkTravelCairn(next,active.segment.end));
  }
  return next;
}

function offerTravelSearch(state: ProtoState, segmentIndex: number, sourceKey: string): ProtoState {
  const j=state.journey!,segment=j.segments[segmentIndex];
  const reward=segment.kind==='woods'?'wood' as const:'mana' as const;
  const id=`search-${state.day}-${sourceKey}`;
  const card:TravelCard={id,rank:j.rank,segment:segmentIndex,kind:segment.kind,event:{id:'search',title:'SEARCH',
    description:`Search ${segment.title} for ${reward} and extend your combo. Available once per day.`,
    solutions:[{type:'wildcard'}],effect:{type:'search',sourceKey,segment:segmentIndex,stamina:SEARCH_STAMINA,cards:SEARCH_CARDS,reward}}};
  const columns=j.columns.map(cards=>[...cards]),reserve=[...j.reserve];
  while(columns.length<7)columns.push([]);
  let eventBackfill:TravelJourney['eventBackfill'];
  if(columns.flat().length>=28){
    const column=columns.reduce((best,cards,i)=>cards.length>columns[best].length?i:best,0);
    const card=columns[column].shift();if(card)eventBackfill={card,column,index:0};
  }
  let column=columns.findIndex(cards=>!cards.length);
  // Keep the seven ordinary columns in order; an exposed event never covers
  // the next legal normal rank. Its temporary slot disappears on resolution.
  if(column<0){column=columns.length;columns.push([]);}
  const visit=state.travelVisits?.[sourceKey];
  return {...state,travelVisits:{...state.travelVisits,[sourceKey]:{day:state.day,crossed:visit?.day===state.day&&visit.crossed===true,searchOffered:true}},
    journey:{...j,pendingSearch:segmentIndex,eventBackfill,columns:spawnTableauEvent(columns,card,column),reserve,bonus:'Optional SEARCH · keep playing; this tile waits for its event before continuing'}};
}

export function travelEventCost(state: ProtoState, columnIndex: number, cardIndex: number, actorId: string, utility?: EventUtility): number | null {
  const j=state.journey,column=j?.columns[columnIndex],card=column?.[cardIndex];
  if(!j||j.paused||j.blocked||!card?.event||!column||!Number.isInteger(cardIndex)||cardIndex<0||!partyMembers(state,j.actorId).some(a=>a.id===actorId))return null;
  const ranks=j.memberRanks??{[j.actorId]:j.rank};if(ranks[actorId]===undefined)return null;
  if(utility && actorId!=='hero')return null;
  const cost=eventPlayCost(card,{rank:ranks[actorId],depth:column.length-cardIndex,ap:state.utilityAP?.[actorId]??0,utility,
    partyCharacteristics:partyMembers(state,j.actorId).flatMap(a=>a.characteristics??[])});
  if(cost===null||state.resolvedEventIds?.includes(card.id)||state.eventDiscard?.some(entry=>entry.id===card.id))return null;
  if(card.event.effect.type==='search'){
    const effect=card.event.effect;
    if(j.pendingSearch!==effect.segment||j.search||j.segments[effect.segment]?.cellKey!==effect.sourceKey||(state.travelStamina??TRAVEL_STAMINA_MAX)<effect.stamina)return null;
  }
  return cost;
}

export function playTravelEvent(state: ProtoState, columnIndex: number, cardIndex: number, actorId?: string, utility?: EventUtility, expectedCardId?: string): ProtoState {
  const j=state.journey;if(!j)return state;
  if(expectedCardId&&j.columns[columnIndex]?.[cardIndex]?.id!==expectedCardId)return state;
  const receiver=actorId??Object.keys(j.memberRanks??{[j.actorId]:j.rank}).find(id=>travelEventCost(state,columnIndex,cardIndex,id,utility)!==null);
  if(!receiver)return state;
  const cost=travelEventCost(state,columnIndex,cardIndex,receiver,utility);if(cost===null)return state;
  const card=j.columns[columnIndex][cardIndex],event=card.event!;
  const reserve=[...j.reserve];
  const columns=j.columns.map((cards,i)=>i===columnIndex?cards.filter((_,r)=>r!==cardIndex):[...cards]);
  if(j.eventBackfill)columns[j.eventBackfill.column].splice(j.eventBackfill.index,0,j.eventBackfill.card);
  while(columns.length>7&&!columns[columns.length-1].length)columns.pop();
  const rank=eventChangesRank(event)?card.rank:j.memberRanks?.[receiver]??j.rank;
  const base={...state,utilityAP:{...state.utilityAP,[receiver]:(state.utilityAP?.[receiver]??0)-cost}};
  if(event.effect.type!=='search'){
    const applied=applySimpleEvent(base,card);if(!applied)return state;
    return continueAfterEvent({...applied,journey:{...j,eventBackfill:undefined,columns,reserve,rank:receiver===j.actorId?rank:j.rank,memberRanks:{...(j.memberRanks??{[j.actorId]:j.rank}),[receiver]:rank},bonus:event.effect.type==='notice'?event.effect.message:event.title}},card.segment);
  }
  const effect=event.effect;
  const extra:TravelCard[][]=Array.from({length:7},()=>[]);
  for(let i=0;i<effect.cards;i++)extra[i%7].push({id:`${card.id}-extra-${i}`,rank:(rank+i)%13+1,kind:j.segments[effect.segment].kind,segment:effect.segment,
    ...(i===effect.cards-1?{resource:effect.reward,...(effect.reward==='mana'?{foodSource:'berries' as const}:{})}:{})});
  return {...base,resolvedEventIds:[...(state.resolvedEventIds??[]),card.id],travelStamina:(state.travelStamina??TRAVEL_STAMINA_MAX)-effect.stamina,
    journey:{...j,eventBackfill:undefined,pendingSearch:undefined,columns:extra,reserve:[],search:{columns,reserve,remaining:effect.cards,total:effect.cards,segment:effect.segment},spent:j.spent+effect.stamina,bonus:`Searching · ${effect.stamina} STA committed · ${effect.cards} extra cards`}};
}

function playSearchCard(state: ProtoState, columnIndex: number, actorId?: string): ProtoState {
  const j=state.journey!,search=j.search!,column=j.columns[columnIndex],card=column?.[column.length-1];
  const ranks=j.memberRanks??{[j.actorId]:j.rank};
  const receiver=actorId??Object.keys(ranks).find(id=>card&&travelCardPlayable(card,ranks[id]));
  if(j.paused||j.blocked||!card||!receiver||ranks[receiver]===undefined||!travelCardPlayable(card,ranks[receiver]))return state;
  const done=search.remaining===1;
  const resource=card.resource==='herbs'?'mana':card.resource;
  const next={...state,utilityAP:{...state.utilityAP,[receiver]:(state.utilityAP?.[receiver]??0)+1},
    haul:resource?{...state.haul,[resource]:state.haul[resource]+1}:state.haul,
    journey:{...j,rank:receiver===j.actorId?card.rank:j.rank,memberRanks:{...ranks,[receiver]:card.rank},streak:j.streak+1,
      completedCardIds:[...(j.completedCardIds??[]),card.id],berries:j.berries+(card.foodSource?1:0),
      columns:done?search.columns:j.columns.map((cards,i)=>i===columnIndex?cards.slice(0,-1):cards),reserve:done?search.reserve:[],
      search:done?undefined:{...search,remaining:search.remaining-1},bonus:done?'Search complete · reward collected':'Search combo continues'}};
  return done?continueAfterEvent(next,search.segment):next;
}

function continueAfterEvent(state: ProtoState, segment: number): ProtoState {
  const j=state.journey!;
  if(travelTableauHeld(j))return state;
  const active=currentTravelSegment(j);
  return !active||active.index>segment ? prepareTravelTableau(checkTravelCairn(state,j.segments[segment].end)) : state;
}

export function discardTravelEvent(state: ProtoState, columnIndex: number, expectedCardId?: string): ProtoState {
  const j=state.journey,column=j?.columns[columnIndex],card=column?.[column.length-1];
  if(!j||j.paused||j.blocked||!card?.event||expectedCardId&&card.id!==expectedCardId)return state;
  const reserve=[...j.reserve],columns=j.columns.map((cards,i)=>i===columnIndex?cards.slice(0,-1):[...cards]);
  if(j.eventBackfill)columns[j.eventBackfill.column].splice(j.eventBackfill.index,0,j.eventBackfill.card);
  while(columns.length>7&&!columns[columns.length-1].length)columns.pop();
  const next={...state,eventDiscard:[...(state.eventDiscard??[]),card],journey:{...j,eventBackfill:undefined,columns,reserve,
    pendingSearch:card.event.effect.type==='search'?undefined:j.pendingSearch,bonus:'Event discarded · continuing the journey'}};
  return continueAfterEvent(next,card.segment);
}

export function redrawTravel(state: ProtoState, receivingActorId?: string): ProtoState {
  if(denseBerryChoicePending(state))return state;
  const j = state.journey;
  if(j && currentTravelSegment(j)?.segment.passage && !j.passageStage)return state;
  const receiver = receivingActorId ?? j?.actorId;
  if (j && receiver && j.memberRanks && j.memberRanks[receiver] === undefined) return state;
  const actorIndex = j ? Math.max(0, FOUNDATION_MOCKUPS.findIndex(actor => actor.id === receiver)) : 0;
  if (!j || j.obstruction || j.blocked || j.paused || travelTableauHeld(j) || (state.actorInspiration[actorIndex] ?? 0) < 1) return state;
  const next = j.columns.map(c => c[c.length - 1]).find(card=>card&&!card.event);
  if (!next) return state;
  const recoveryRank=((next.rank-2+13)%13)+1;
  // A reliable recovery value guarantees a legal continuation at the INSP cost.
  return { ...state, actorInspiration: state.actorInspiration.map((n, i) => i === actorIndex ? n - 1 : n), journey: { ...j, rank: receiver === j.actorId ? recoveryRank : j.rank, memberRanks: { ...(j.memberRanks ?? { [j.actorId]: j.rank }), [receiver!]: recoveryRank }, streak: 0, tileStreak: 0, bonus: 'Trail reset · 1 INSP' } };
}

/** Navigation is validated on earned safe cell centres, never on paint completion. */
export function checkTravelCairn(state: ProtoState, progress: number): ProtoState {
  const j=state.journey;
  if (!j || j.blocked || j.pendingSearch!==undefined || j.search || travelTableauHeld(j) || (j.checkedProgress !== undefined && progress <= j.checkedProgress)) return state;
  const position=pointAlongTimedPath(j.path,progress);
  const tiles=discoverTiles(state.biomeTiles,position);
  const blockedAt=(point:{x:number;y:number})=>{const cell=TABLE_GRID.atWorld(point);return tiles.find(t=>{const a=TABLE_GRID.atWorld(t.position),left=a.column-Math.floor(t.gridSize.columns/2),top=a.row-Math.floor(t.gridSize.rows/2);return cell.column>=left&&cell.column<left+t.gridSize.columns&&cell.row>=top&&cell.row<top+t.gridSize.rows&&!t.flags?.includes('unexplored')&&((!t.passage&&(t.tileType==='impassable-mountain'||t.flags?.includes('impassable')))||t.unlocked===false);});};
  let previous=position;
  let obstacle:typeof tiles[number]|undefined;
  for (const segment of j.segments.filter(s=>s.end>progress+1e-9)) {
    const point=pointAlongTimedPath(j.path,segment.end);
    obstacle=blockedAt(point);
    const from=TABLE_GRID.atWorld(previous), to=TABLE_GRID.atWorld(point);
    if(!obstacle&&!passageStepAllowed(tiles,from.column,from.row,to.column,to.row))obstacle=tiles.find(t=>t.passage&&!t.flags?.includes('unexplored')&&(t.id===segment.tileId||TABLE_GRID.reference(TABLE_GRID.atWorld(t.position))===TABLE_GRID.reference(from)));
    const a=TABLE_GRID.atWorld(previous),b=TABLE_GRID.atWorld(point);
    if (!obstacle && a.column!==b.column && a.row!==b.row) obstacle=blockedAt(TABLE_GRID.center(TABLE_GRID.cell(a.column,b.row)))??blockedAt(TABLE_GRID.center(TABLE_GRID.cell(b.column,a.row)));
    if(obstacle)break;
    previous=point;
  }
  const worldActors=state.worldActors.map(a=>partyMembers(state,j.actorId).some(member=>member.id===a.id)?{...a,position}:a);
  if(!obstacle){
    const learned=j.segments.some(s=>s.end>progress+1e-9&&s.unknown&&tiles.some(t=>t.id===s.tileId&&!t.flags?.includes('unexplored')));
    if(learned && !j.ordered){
      const actor=state.worldActors.find(a=>a.id===j.actorId);
      const plan=planTravel(j.actorId,remainingPath(j.path,progress),tiles,j.arrival,actor?.traversalAffinity);
      const rebuilt=j.traversalSuspended?beginPlaytestJourney(plan,j.rank):beginJourney(plan,j.rank);
      const continuation={...rebuilt,memberRanks:j.memberRanks,path:j.path,segments:rebuilt.segments.map(s=>({...s,start:progress+(1-progress)*s.start,end:progress+(1-progress)*s.end})),progress:progress+(1-progress)*rebuilt.progress,spent:j.spent,berries:j.berries,streak:j.streak,priorCompleted:(j.priorCompleted??0)+j.completed,completedCardIds:j.completedCardIds,checkedProgress:progress};
      // Discovery refreshes the next tableau automatically. Actual plays enforce
      // remaining stamina; a revised estimate alone does not require route confirmation.
      return prepareTravelTableau({...state,biomeTiles:tiles,worldActors,journey:continuation});
    }
    return {...state,biomeTiles:tiles,worldActors,journey:{...j,checkedProgress:progress}};
  }
  const cell=TABLE_GRID.atWorld(obstacle.position);
  const message=`Path blocked - impassable terrain discovered at (${cell.column},${cell.row}). Plan a new route.`;
  return {...state,biomeTiles:tiles,worldActors,journey:{...j,progress,paused:true,streak:0,tileStreak:0,checkedProgress:progress,blocked:{progress,position,message},bonus:message}};
}

/** Persistent paint follows actual walking, never banked card distance.
 * Route segments end at cell centres; the next half step exits the tile. */
export function paintTravelProgress(state: ProtoState, progress: number): ProtoState {
  let j = state.journey;
  if (!j) return state;
  if(j.paused)return state;
  const liveWalked=Math.max(j.walkedProgress??0,Math.min(progress,j.progress));
  if(liveWalked>(j.walkedProgress??0)){state={...state,journey:{...j,walkedProgress:liveWalked}};j=state.journey!;}
  if(j.ordered){
    const walked=liveWalked;
    if(j.waitingForTraversal!==undefined && walked>=j.segments[j.waitingForTraversal].end-1e-5){
      const finished=j.segments[j.waitingForTraversal],key=finished.cellKey??finished.tileId??String(j.waitingForTraversal),prior=state.travelVisits?.[key];
      state=prepareTravelTableau({...state,travelVisits:{...state.travelVisits,[key]:{day:state.day,crossed:true,searchOffered:prior?.day===state.day&&prior.searchOffered}},
        terrainCrossings:prior?.day===state.day&&prior.crossed?state.terrainCrossings:{...state.terrainCrossings,[finished.kind]:(state.terrainCrossings?.[finished.kind]??0)+1},journey:{...j,waitingForTraversal:undefined}});j=state.journey!;
    }
  }
  const walked = Math.max(0, Math.min(progress, j.blocked?.progress ?? j.progress));
  let changed = false;
  const biomeTiles = state.biomeTiles.map(tile => {
    if (tile.traversalProgress === undefined || tile.traversalProgress >= 1 || tile.flags?.includes('unexplored')) return tile;
    let paint = tile.traversalProgress;
    j.segments.forEach((segment, index) => {
      if (segment.tileId !== tile.id) return;
      const entry = j.ordered ? segment.start : (segment.start + segment.end) / 2;
      const next = j.segments[index + 1];
      const exit = j.ordered ? next?.tileId===tile.id?next.end:segment.end : next ? (next.start + next.end) / 2 : segment.end;
      if (exit > entry) paint = Math.max(paint, Math.min(1, Math.max(0, (walked - entry) / (exit - entry))));
    });
    if (paint === tile.traversalProgress) return tile;
    changed = true;
    return { ...tile, traversalProgress: paint };
  });
  return changed ? { ...state, biomeTiles } : state;
}

export function denseBerryChoicePending(state:ProtoState):boolean {
 const j=state.journey,a=j&&currentTravelSegment(j);
 return state.dayScenario==='day01' && !!j && !j.denseBerryChoice && !!a?.segment.denseBerry && a.done===a.segment.cards-1 && j.columns.flat().length===1 && !j.paused && j.waitingForTraversal===undefined;
}
export function chooseDenseBerry(state:ProtoState,choice:'collect'|'leave'):ProtoState {
 if(!denseBerryChoicePending(state))return state;
 const j=state.journey!,column=j.columns.findIndex(c=>c.length),tileId=currentTravelSegment(j)?.segment.tileId;
 const accepted={...state,journey:{...j,denseBerryChoice:choice}};
 if(choice==='collect'){const next=playTravelCard(accepted,column);return next.journey?.completed===j.completed?state:next;}
 const card=j.columns[column][0];
 const next=playTravelCard({...accepted,journey:{...accepted.journey,columns:j.columns.map(c=>c.map(card=>({...card,resource:undefined,foodSource:undefined}))) }},column);
 if(next.journey?.completed===j.completed)return state;
 return {...next,travelRanks:state.travelRanks,travelStamina:state.travelStamina,utilityAP:state.utilityAP,journey:next.journey?{...next.journey,rank:j.rank,memberRanks:j.memberRanks,spent:j.spent,completedCardIds:j.completedCardIds}:undefined,
 biomeTiles:next.biomeTiles.map(tile=>tile.id===tileId?{...tile,berryHarvested:false,tableau:[[card]],stock:[]}:tile)};
}
