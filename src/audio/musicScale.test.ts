import { describe, expect, it } from 'vitest';
import { MODES, chordMidi, comboCutoff, comboHarmony, degreeMidi, midiHz, rankDegree, rankMidi, type ModeName } from './musicScale';

const key = { root: 62, mode: 'dorian' as const };

describe('musicScale', () => {
  it('maps A to the root and K to degree 12, wrapping like the tableau', () => {
    expect(rankDegree(1)).toBe(0);
    expect(rankDegree(13)).toBe(12);
    expect(rankDegree(14)).toBe(0);
    expect(rankDegree(0)).toBe(12);
    expect(rankMidi(key, 1)).toBe(62);
    expect(rankMidi(key, 8)).toBe(74);
  });
  it('makes a ±1 run move one scale step at a time', () => {
    const run = [5, 6, 7, 8].map(rank => rankMidi(key, rank));
    for (let i = 1; i < run.length; i++) expect(run[i] - run[i - 1]).toBeGreaterThan(0), expect(run[i] - run[i - 1]).toBeLessThanOrEqual(2);
  });
  it('keeps every rank and every harmony note in key for every mode', () => {
    for (const mode of Object.keys(MODES) as ModeName[]) {
      const k = { root: 50, mode }, inKey = (midi: number) => MODES[mode].includes((((midi - 50) % 12) + 12) % 12);
      for (let rank = 1; rank <= 13; rank++) {
        expect(inKey(rankMidi(k, rank))).toBe(true);
        for (const note of comboHarmony(k, rank, 12)) expect(inKey(note)).toBe(true);
      }
      expect(chordMidi(k, 3).every(inKey)).toBe(true);
    }
  });
  it('adds harmony only on longer combos and brightens with combo', () => {
    expect(comboHarmony(key, 3, 4)).toEqual([]);
    expect(comboHarmony(key, 3, 5)).toHaveLength(1);
    expect(comboHarmony(key, 3, 10)).toHaveLength(2);
    expect(comboCutoff(0)).toBeLessThan(comboCutoff(6));
    expect(comboCutoff(99)).toBe(5200);
  });
  it('handles negative degrees and tuning', () => {
    expect(degreeMidi(key, -1)).toBe(60);
    expect(midiHz(69)).toBeCloseTo(440);
  });
});
