import { describe, expect, it } from 'vitest';
import { chainTier, createStellarBattle, stellarDraw, stellarReceipt, stellarStuck } from './stellarRules';

describe('stellar combat rules', () => {
  it('steps star brightness and sound tiers up at chain positions 3, 5 and 8', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(chainTier)).toEqual([1, 1, 2, 2, 3, 3, 3, 4, 4]);
  });
  it('rewards one long chain over the same cards split by a draw', () => {
    const play = (n: number, s = createStellarBattle()) => { for (let i = 0; i < n; i++) s = stellarReceipt(s).state; return s; };
    const long = play(8), split = play(4, stellarDraw(play(4)).state);
    expect(long.bestChain).toBe(8);expect(split.bestChain).toBe(4);expect(long.result).toBeNull();expect(split.result).toBeNull();
  });
  it('settles chains on draws without charge, strikes or HP penalties', () => {
    let s = stellarReceipt(createStellarBattle()).state;
    const first = stellarDraw(s);
    expect(first.events.map(e => e.kind)).toEqual(['chain-end']);
    s = stellarDraw(first.state).state;
    const third = stellarDraw(s);
    expect(third.events).toEqual([]);expect(third.state.draws).toBe(3);expect(third.state.result).toBeNull();
  });
  it('receipts generate stars without damage or a combat victory; only exhaustion completes the night', () => {
    let s = createStellarBattle();
    for (let i = 0; i < 100; i++){const receipt=stellarReceipt(s);expect(receipt.events[0].kind).toBe('receipt');expect(receipt.events[0]).not.toHaveProperty('amount');s=receipt.state;}
    expect(s.result).toBeNull();expect(s.chain).toBe(100);s=stellarStuck(s);expect(s.result).toBe('complete');
    expect(stellarReceipt(s).events).toEqual([]);
  });
});
