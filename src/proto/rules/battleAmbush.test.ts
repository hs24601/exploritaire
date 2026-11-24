import { describe, expect, it } from 'vitest';
import { applyAttack, createBattle, playCard, tickBattle, type BattleState } from './battle';
import { sceneOf } from './battleCues';

const opening = (hungry = false) => createBattle({ tableau: [[{ id: 'four', rank: 4 }, { id: 'three', rank: 3 }]] }, {
  playerAmbush: true, mochi: false, rules: { hungry },
});
const strike = (battle: BattleState) => applyAttack(battle, 'hero', 'dark-slime');

describe("player's opening ambush", () => {
  it('holds enemy timers and foraging while cards build charge, until a successful attack', () => {
    const initial = opening(true);
    expect(sceneOf(initial).ambushed).toBe(true);
    expect(strike(initial)).toBe(initial);
    const charged = playCard(initial, 0, 'hero');
    const waiting = tickBattle(charged, 30);
    expect(waiting.foes).toEqual(charged.foes);
    expect(waiting.ambush).toEqual({ awaitingAttack: true, remaining: 10 });
    const hit = strike(waiting);
    expect(hit.foes[0].hp).toBeLessThan(waiting.foes[0].hp);
    expect(hit.ambush).toEqual({ awaitingAttack: false, remaining: 10 });
  });

  it('allows more cards and attacks without restarting the ten-second free turn', () => {
    const hit = strike(playCard(opening(), 0, 'hero'));
    const during = tickBattle(hit, 4);
    const second = strike(playCard(during, 0, 'hero'));
    expect(second.ambush?.remaining).toBe(6);
    expect(second.party[0].count).toBe(2);
    const expired = tickBattle(second, 6);
    expect(expired.ambush).toBeNull();
    expect(sceneOf(expired).ambushed).toBe(false);
    expect(expired.foes.map(f => f.timer)).toEqual(second.foes.map(f => f.timer));
    const ticking = tickBattle(expired, 1);
    expect(ticking.foes[0].timer).toBeCloseTo(1 / ticking.foes[0].profile.attackSeconds);
    expect(ticking.events.some(e => e.kind === 'enemy-hit')).toBe(false);
  });

  it('uses only time beyond the countdown for enemy clocks when a tick crosses expiry', () => {
    const hit = strike(playCard(opening(), 0, 'hero'));
    const next = tickBattle(tickBattle(hit, 9.9), 0.2);
    expect(next.ambush).toBeNull();
    expect(next.foes[0].timer).toBeCloseTo(0.1 / next.foes[0].profile.attackSeconds);
  });

  it('keeps burn and stagger active during the free turn and restores ambush on a fresh fight', () => {
    const hit = strike(playCard(opening(), 0, 'hero'));
    const affected = { ...hit, foes: hit.foes.map((foe, i) => i ? foe : {
      ...foe, staggered: 2, effects: [{ kind: 'burn' as const, seconds: 3, dps: 1, left: 3, tickIn: 1 }],
    }) };
    const next = tickBattle(affected, 1);
    expect(next.foes[0].hp).toBeLessThan(affected.foes[0].hp);
    expect(next.foes[0].staggered).toBe(1);
    expect(next.foes[0].timer).toBe(affected.foes[0].timer);
    expect(next.ambush?.remaining).toBe(9);
    expect(opening().ambush?.awaitingAttack).toBe(true);
    expect(createBattle({ tableau: [] }).ambush).toBeNull();
  });
});
