import { afterEach, expect, it, vi } from 'vitest';
import { authored, saveAuthored } from './sharedAuthoring';
import { validateAuthoringEdit } from './authoringValidation';

afterEach(() => vi.unstubAllGlobals());

it('does not commit a rejected disk save to the runtime data', async () => {
  const before = JSON.stringify(authored);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('Disk save failed', { status: 500 })));
  await expect(saveAuthored('callouts', 'test.failed-save', { text: 'draft', marks: [] })).rejects.toThrow('Disk save failed');
  expect(JSON.stringify(authored)).toBe(before);
});

it('rejects HTML fallback responses rather than reporting a successful save', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Preview server</html>')));
  await expect(saveAuthored('emotions', 'day01', 'happy')).rejects.toThrow();
});

it('validates collection names, identifiers, formatting and reset tombstones', () => {
  expect(() => validateAuthoringEdit('callouts', 'day01.opening', { text: '...breakfast!', marks: [] })).not.toThrow();
  expect(() => validateAuthoringEdit('callouts', '__proto__', null)).toThrow();
  expect(() => validateAuthoringEdit('unknown', 'id', null)).toThrow();
  expect(() => validateAuthoringEdit('callouts', 'id', { text: 'short', marks: [{ start: 0, end: 99, effect: 'glow' }] })).toThrow();
  expect(() => validateAuthoringEdit('cameras', 'story.day01.opening', null)).not.toThrow();
});
