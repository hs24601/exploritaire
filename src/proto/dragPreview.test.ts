import { expect, it } from 'vitest';
import { dragPreviewFrame, farthestPreviewCard } from './dragPreview';
it('shares the grab, travel, landing and quiet repeat timing', () => {
  expect(dragPreviewFrame(0)).toMatchObject({ t: 0, opacity: 0, grabbing: false });
  expect(dragPreviewFrame(900)).toMatchObject({ t: 0, grabbing: true });
  expect(dragPreviewFrame(1950).t).toBeCloseTo(.5);
  expect(dragPreviewFrame(3000).t).toBe(1);
  expect(dragPreviewFrame(4500).opacity).toBe(0);
  expect(dragPreviewFrame(5200)).toEqual(dragPreviewFrame(0));
});
it('selects the farthest candidate from the actual holocard, with stable ties', () => {
  const cards = [{ id:'near',x:60,y:0 },{ id:'far',x:0,y:70 },{ id:'tie',x:0,y:-70 }];
  expect(farthestPreviewCard(cards,{x:100,y:0})?.id).toBe('far');
  expect(farthestPreviewCard([], {x:0,y:0})).toBeUndefined();
});
