import { describe, it, expect } from 'vitest';
import { createInitialState, createExplorationFoundations } from './setup';
import { applyFoundationPlay, utilityRetrievalCost } from './play';
import type { ProtoState } from '../protoState';
const base = (ap = 5): ProtoState => ({ ...createInitialState(), scene: 'exploration', selectedBiomeId: 'day-one-tree', stock: [], tableau: [[{id:'buried',rank:10},{id:'top',rank:3}]], foundations: createExplorationFoundations([{id:'f',rank:2}],1), worldActors: [{id:'hero',label:'Hero',location:'foundation',biomeId:'day-one-tree',foundationIndex:0,position:{x:0,y:0}}], utilityAP:{hero:ap} });
describe('non-combat foundation utilities', () => {
  it('banks AP on ordinary plays', () => { expect(applyFoundationPlay(base(0),{columnIndex:0,foundationIndex:0})?.state.utilityAP?.hero).toBe(1); });
  it('Fetch takes exposed cards for two AP without granting play AP', () => { const s=base(); expect(utilityRetrievalCost(s,0,'Fetch',0,0)).toBeNull(); const n=applyFoundationPlay(s,{columnIndex:0,foundationIndex:0,retrieval:{move:'Fetch',cardIndex:1}})!.state; expect(n.utilityAP?.hero).toBe(3); expect(n.foundations[0]?.card.id).toBe('top'); });
  it('Dig retrieves a buried card regardless of rank and preserves its neighbors', () => { const n=applyFoundationPlay(base(),{columnIndex:0,foundationIndex:0,retrieval:{move:'Dig',cardIndex:0}})!.state; expect(n.utilityAP?.hero).toBe(3); expect(n.tableau[0].map(c=>c.id)).toEqual(['top']); expect(n.foundations[0]?.card.rank).toBe(10); });
  it('rejects insufficient AP, absent Hero and invalid indices', () => { const options={columnIndex:0,foundationIndex:0,retrieval:{move:'Dig' as const,cardIndex:0}}; expect(applyFoundationPlay(base(1),options)).toBeNull(); expect(applyFoundationPlay({...base(),worldActors:[]},options)).toBeNull(); expect(utilityRetrievalCost(base(),0,'Dig',0,-1)).toBeNull(); });
  it('retains rest recovery while spending retrieval AP', () => { const s={...base(),selectedBiomeId:'hero-den',worldActors:base().worldActors.map(a=>({...a,biomeId:'hero-den'})),tableau:[[{id:'rest',rank:10,sleep:'rest' as const},{id:'top',rank:3}]],inspiration:0}; const n=applyFoundationPlay(s,{columnIndex:0,foundationIndex:0,retrieval:{move:'Dig',cardIndex:0}})!.state; expect(n.inspiration).toBe(1); expect(n.utilityAP?.hero).toBe(3); expect(n.tableau[0].map(c=>c.id)).toEqual(['top']); });
});
