import { describe, expect, it } from 'vitest';
import { calloutPages, letterDelay, placeCallout, rectsOverlap } from './calloutPlayback';

describe('callout dialogue playback', () => {
  it('keeps authored breaks and source effect offsets across automatic pages', () => {
    const text = 'The days are getting darker. The manaberries grow scarcer, and the nights feel colder. I should check the bush just outside my den.\n\nThen I can come home.';
    const pages = calloutPages(text);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.map(p => text.slice(p.start, p.end)).join(' ')).toBe(text.replace(/\s+/g, ' '));
    expect(text.slice(pages[pages.length - 1].start)).toBe('Then I can come home.');
    expect(pages.every(p => p.end - p.start <= 110)).toBe(true);
  });
  it('bounds unbroken text and empty dialogue', () => {
    expect(calloutPages('x'.repeat(250)).map(p => p.end - p.start)).toEqual([110, 110, 30]);
    expect(calloutPages('')).toEqual([{start: 0, end: 0}]);
  });
  it('slows marked words and adds natural punctuation beats at configurable speed', () => {
    const marks = [{start: 0, end: 6, effect: 'whisper' as const}];
    expect(letterDelay('darker.', 0, marks, 32)).toBeCloseTo(49.6);
    expect(letterDelay('darker.', 6, marks, 32)).toBe(128);
    expect(letterDelay('darker.', 0, marks, 0)).toBe(0);
  });
});
describe('actor priority placement', () => {
  const viewport = {left:0, top:0, right:1280, bottom:720};
  it('avoids every actor, even when the viewport clamps the preferred bubble into one', () => {
    const actors = [{left:480, top:5, right:600, bottom:160}, {left:620, top:10, right:850, bottom:240}];
    const p = placeCallout({x:550, y:15}, 340, 200, viewport, actors)!;
    expect(p).not.toBeNull();
    expect(actors.some(a => rectsOverlap(a, {left:p.x, top:p.y, right:p.x+340, bottom:p.y+200}))).toBe(false);
  });
  it('never picks an overlapping fallback when all space is occupied', () => {
    expect(placeCallout({x:640,y:360},340,200,viewport,[viewport])).toBeNull();
  });
});
