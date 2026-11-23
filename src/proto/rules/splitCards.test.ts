import { expect, it } from 'vitest';
import { cardRanks, splitCard, validSplitPair } from './splitCards';
import { canPlay, createCombatSandboxScenario, legalCardRanks, playCard } from './battle';
import { intentEnemyPlayOne } from './battleDeadRun';

it('generates reproducible distinct, nonadjacent pairs with wrap protection',()=>{
  for(let i=0;i<3000;i++) {
    const card=splitCard({id:'pair-'+i,rank:i%13+1});
    expect(validSplitPair(card.rank,card.alternateRank!)).toBe(true);
    expect(splitCard({id:'pair-'+i,rank:i%13+1})).toEqual(card);
  }
  expect(validSplitPair(1,13)).toBe(false);
  expect(validSplitPair(5,6)).toBe(false);
  expect(validSplitPair(5,5)).toBe(false);
});

it('1000 has three stacked rows of split cards and only exposed cards are playable',()=>{
  const state=createCombatSandboxScenario('1000');
  expect(state.columns).toHaveLength(6);
  expect(state.rules.spatialLanes).toBe(false);
  expect(state.columns.every(cards=>cards.length===3&&cards.every(card=>validSplitPair(card.rank,card.alternateRank!)))).toBe(true);
  state.columns[0][1]={id:'covered',rank:1,alternateRank:3};
  expect(canPlay(state,'hero',state.columns[0][1])).toBe(false);
});

it('uses an alternate-only match automatically, granting exactly one receipt',()=>{
  const state=createCombatSandboxScenario('1000');
  state.columns[0][2]={id:'alternate',rank:10,alternateRank:3};
  expect(legalCardRanks(state,'hero',state.columns[0][2])).toEqual([3]);
  const next=playCard(state,0,'hero');
  expect(next.party[0].rank).toBe(3);
  expect(next.party[0].charge).toBe(1);
  expect(next.momentum!.value).toBe(1);
  expect(next.party[0].foundationCards!.slice(-1)[0].alternateRank).toBeUndefined();
  expect(next.columns[0][2]).toBe(state.columns[0][1]);
  expect(next.columns.flat().every(card=>validSplitPair(card.rank,card.alternateRank!))).toBe(true);
});

it('does not silently pick between two resulting foundation values',()=>{
  const state=createCombatSandboxScenario('1000');
  state.party[0].rank=6;
  state.columns[0][2]={id:'choice',rank:5,alternateRank:7};
  expect(legalCardRanks(state,'hero',state.columns[0][2])).toEqual([5,7]);
  expect(playCard(state,0,'hero')).toBe(state);
  expect(playCard(state,0,'hero',false,undefined,9)).toBe(state);
  expect(playCard(state,0,'hero',false,undefined,7).party[0].rank).toBe(7);
});

it('enemy intent can take a card using its alternate value',()=>{
  const state=createCombatSandboxScenario('1000');
  state.columns=state.columns.map((cards,c)=>cards.map((card,d)=>d===2?{id:'enemy-'+c,rank:1,alternateRank:c===0?5:9}:card));
  state.tutorial={...state.tutorial!,intent:{id:'intent',rank:6,pips:0,fired:0,cards:[]}};
  const next=intentEnemyPlayOne(state)!;
  expect(next.tutorial!.intent!.rank).toBe(5);
  expect(next.tutorial!.intent!.pips).toBe(1);
  expect(cardRanks(next.tutorial!.intent!.cards[0])).toEqual([5]);
});
