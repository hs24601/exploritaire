import { FOUNDATION_MOCKUPS, type ProtoState } from './protoState';
import { TABLE_GRID } from './gridCoordinates';
export function partyMembers(state: ProtoState, actorId: string) {
 const actor = state.worldActors.find(a => a.id === actorId);
 return actor ? state.worldActors.filter(a => a.id === actorId || Boolean(actor.partyId && a.partyId === actor.partyId)) : [];
}
export function joinParty(state: ProtoState, actorId: string, targetId: string): ProtoState {
 if (state.journey || state.scene !== 'exploration' || actorId === targetId) return state;
 const members = [...new Map([...partyMembers(state,targetId),...partyMembers(state,actorId)].map(a => [a.id,a])).values()];
 if (members.length < 2 || members.length > 3 || members.some(a => a.location !== 'table' || a.hutId)) return state;
 const cells = members.map(a => TABLE_GRID.atWorld(a.position));
 if (cells.some(c => c.column !== cells[0].column || c.row !== cells[0].row)) return state;
 const partyId = members[0].partyId ?? `party-${targetId}`;
 return {...state,worldActors:state.worldActors.map(a => members.some(m => m.id === a.id) ? {...a,partyId,position:{...members[0].position}} : a)};
}
export function leaveParty(state: ProtoState, actorId: string): ProtoState {
 if (state.journey || state.scene !== 'exploration') return state;
 const members = partyMembers(state,actorId);
 if (members.some(a => a.location !== 'table' || a.hutId)) return state;
 return {...state,worldActors:state.worldActors.map(a => a.id === actorId || (members.length <= 2 && members.some(m => m.id === a.id)) ? {...a,partyId:undefined} : a)};
}
/** Temporary roster control, using the existing authored actors. */
export function addPartyCompanion(state: ProtoState): ProtoState {
 if (state.journey || state.scene !== 'exploration' || state.worldActors.some(a => a.location !== 'table')) return state;
 const definition = FOUNDATION_MOCKUPS.slice(1,3).find(a => !state.worldActors.some(w => w.id === a.id));
 const hero = state.worldActors.find(a => a.id === 'hero');
 if (!definition || !hero) return state;
 return {...state,worldActors:[...state.worldActors,{id:definition.id,label:definition.label,characteristics:definition.characteristics?[...definition.characteristics]:undefined,location:'table',position:{...hero.position}}]};
}
