import { describe, expect, it } from 'vitest';
import { activateBiome } from '../biomeArrival';
import { cloneState, createInitialState } from './setup';
import { applyFoundationPlay } from './play';
import { drawSleepStock } from './rest';
import type { Card, ProtoState } from '../protoState';
import { simulateSolverMove } from '../tableauSolver';
const card = (rank: number, id = `c-${rank}`): Card => ({id,rank,sleep:'rest'});
const restState = (): ProtoState => {
 const base=createInitialState();
 const state=activateBiome({...base,ordinaryDay:undefined,stamina:0,actorStamina:[0,4,4],worldActors:base.worldActors.map(actor=>({...actor,location:'foundation' as const,biomeId:'hero-den',foundationIndex:0}))},'hero-den');
 return {...state,foundations:[{card:card(2,'receiver'),count:0,cards:[]}]};
};
const play = (state: ProtoState) => applyFoundationPlay(state,{columnIndex:0,foundationIndex:0});

describe('Hero’s Den finite rest', () => {
  it('bedtime has six five-card columns and a receiver plus 21 stock from one deck', () => {
    const state = activateBiome({...restState(),selectedBiomeId:null},'hero-den');
    expect(state.selectedBiomeId).toBe('hero-den');
    expect(state.stamina).toBe(0);
    expect(state.actorStamina[0]).toBe(0);
    expect(state.foundations).toHaveLength(1);
    expect(state.worldActors[0]).toMatchObject({location:'foundation',biomeId:'hero-den',foundationIndex:0});
    expect(state.tableau.map(column=>column.length)).toEqual([5,5,5,5,5,5]);
    expect(state.stock).toHaveLength(21);
    const deck = [...state.tableau.flat(),...state.stock,state.foundations[0]!.card];
    expect(new Set(deck.map(c=>c.id)).size).toBe(52);
    for(let rank=1;rank<=13;rank++) expect(deck.filter(c=>c.rank===rank)).toHaveLength(4);
    expect(state.tableau.flat().every(c=>c.sleep==='rest')).toBe(true);
    expect(state.denRest?.started).toBe(true);
  });
  it('requires initial adjacency and uses ace/king wrap', () => {
    const state = {...restState(),tableau:[[card(3)]]};
    const next = play(state)!.state;
    expect(next.denRest?.started).toBe(true);
    expect(play({...next,foundations:[{card:card(13),count:1,cards:[]}],tableau:[[card(1)]]})).not.toBeNull();
    expect(play({...next,tableau:[[card(5)]]})).toBeNull();
  });
  it('only removes a card, retains stock, restores capped stamina, and grants no work loot', () => {
    let state = {...restState(),energy:0};
    const stock = state.stock;
    const haul = {...state.haul};
    for(let i=0;i<20;i++) {
      const rank = state.foundations[0]!.card.rank % 13 + 1;
      state = play({...state,tableau:[[card(rank,`rest-${i}`)],[],[],[],[],[]]})!.state;
      expect(state.tableau.every(column=>column.length===0)).toBe(true);
      expect(state.stock).toEqual(stock);
    }
    expect(state.stamina).toBe(state.maxStamina);
    expect(state.energy).toBe(0);
    expect(state.haul).toEqual(haul);
    expect(state.totalWorkCompleted).toBe(0);
    expect(state.wildCards).toBe(0);
    expect(state.denRest?.restfulCards).toBe(20);
  });
  it('draws exactly one stock card without a reward, even before the first tableau play', () => {
    const state = {...restState(),tableau:[[card(9)]],stock:[card(1,'stock-a'),card(6,'stock-6')]};
    const drawn = drawSleepStock(state);
    expect(drawn.stock).toHaveLength(1);
    expect(drawn.foundations[0]!.card.rank).toBe(1);
    expect(drawn.foundations[0]!.cards).toHaveLength(0);
    expect(drawn.stamina).toBe(0);
    expect(play(drawn)).toBeNull();
    expect(play({...drawn,tableau:[[card(13)]]})).not.toBeNull();
    expect(cloneState(drawn).denRest?.started).toBe(true);
  });
  it('allows legal plays after the last stock draw but never recycles stock', () => {
    const state = {...restState(),tableau:[[card(2),card(13)]],stock:[card(1)]};
    const drawn = drawSleepStock(state);
    expect(drawn.stock).toHaveLength(0);
    expect(drawSleepStock(drawn)).toBe(drawn);
    const next = play(drawn)!.state;
    expect(next.stamina).toBe(1);
    expect(next.tableau[0]).toHaveLength(1);
  });
  it('rejects stock draws once cleared or unstaffed and preserves the finished deal on reopening', () => {
    const state = {...restState(),tableau:[[],[],[],[],[],[]]};
    expect(drawSleepStock(state)).toBe(state);
    const unstaffed = {...restState(),worldActors:[]};
    expect(drawSleepStock(unstaffed)).toBe(unstaffed);
    expect(play(unstaffed)).toBeNull();
    expect(activateBiome({...state,selectedBiomeId:null},'hero-den').foundations).toHaveLength(1);
  });
  it('divine play clears a card without granting stamina', () => {
    const state = {...restState(),tableau:[[card(3)]]};
    const next = applyFoundationPlay(state,{columnIndex:0,foundationIndex:0,divine:true})!.state;
    expect(next.stamina).toBe(0);
    expect(next.denRest?.restfulCards).toBe(0);
    expect(next.tableau[0]).toHaveLength(0);
  });
  it('solver lookahead keeps draw stock separate from finite tableau plays', () => {
    const next = simulateSolverMove({ columns:[[card(2),card(3)]], stock:[card(9)], foundations:[2], stockMode:'draw' }, {column:0,foundation:0});
    expect(next.columns[0].map(card=>card.rank)).toEqual([2]);
    expect(next.stock.map(card=>card.rank)).toEqual([9]);
    expect(next.foundations).toEqual([3]);
  });
  it('reopening the den preserves its receiving rank instead of restoring Hero’s starting rank', () => {
    const initial = {...restState(),stock:[card(12,'stock-q')]};
    const drawn = drawSleepStock(initial);
    const reopened = activateBiome({...drawn,selectedBiomeId:null},'hero-den');
    expect(reopened.foundations[0]!.card.rank).toBe(12);
  });
});
