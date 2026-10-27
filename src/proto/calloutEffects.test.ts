import { describe, expect, it } from 'vitest';
import { applyCalloutEffect, editCalloutText } from './calloutEffects';
describe('callout word formatting', () => {
  it('replaces and clears just the selected phrase', () => {
    const marks = applyCalloutEffect([{ start: 0, end: 12, effect: 'wave' }], 3, 7, 'glow');
    expect(marks).toEqual([{ start: 0, end: 3, effect: 'wave' }, { start: 3, end: 7, effect: 'glow' }, { start: 7, end: 12, effect: 'wave' }]);
    expect(applyCalloutEffect(marks, 3, 7)).toEqual([marks[0], marks[2]]);
  });
  it('moves effects when words are inserted before them', () => {
    expect(editCalloutText('Hello world', 'Well Hello world', [{ start: 6, end: 11, effect: 'shake' }])).toEqual([{ start: 11, end: 16, effect: 'shake' }]);
  });
  it('inherits an effect inside a phrase and removes deleted formatting', () => {
    const marks = [{ start: 6, end: 11, effect: 'glow' as const }];
    const edited = editCalloutText('Hello world', 'Hello wonderful world', marks);
    expect(edited.every(m => m.start >= 6 && m.end <= 21)).toBe(true);
    expect(editCalloutText('Hello world', 'Hello ', marks)).toEqual([]);
    expect(editCalloutText('Hello world', '', marks)).toEqual([]);
  });
  it('preserves tuning on split ranges and text edits', () => {
    const mark = { start: 0, end: 12, effect: 'wave' as const, color: '#33aaff', potency: 1.65 };
    const marks = applyCalloutEffect([mark], 3, 7, 'glow', { color: '#abcdef', potency: 0.5 });
    expect(marks).toEqual([{ ...mark, end: 3 }, { start: 3, end: 7, effect: 'glow', color: '#abcdef', potency: 0.5 }, { ...mark, start: 7 }]);
    expect(editCalloutText('Hello world!', 'Hello big world!', [mark]).every(m => m.color === mark.color && m.potency === mark.potency)).toBe(true);
  });
  it('leaves an empty selection unchanged', () => {
    const marks = [{ start: 0, end: 3, effect: 'wave' as const }];
    expect(applyCalloutEffect(marks, 2, 2, 'shake')).toBe(marks);
  });
});
