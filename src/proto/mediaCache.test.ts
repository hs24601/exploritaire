import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('shared media loading', () => {
  const images: FakeImage[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 32;
    naturalHeight = 32;
    crossOrigin = '';
    src = '';
    decode = vi.fn(async () => {});
    constructor() { images.push(this); }
  }
  beforeEach(() => {
    vi.resetModules(); images.length = 0;
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('document', { baseURI: 'https://example.test/game/proto.html' });
    vi.stubGlobal('window', { setTimeout });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('deduplicates equivalent URLs and reuses decoded images', async () => {
    const { loadMediaImage } = await import('./mediaCache');
    const a = loadMediaImage('art.png'), b = loadMediaImage('/game/art.png');
    expect(a).toBe(b);
    expect(images).toHaveLength(1);
    images[0].onload?.();
    expect(await a).toBe(images[0]);
    expect(await loadMediaImage('art.png')).toBe(images[0]);
    expect(images[0].decode).toHaveBeenCalledOnce();
  });

  it('allows retry after an error or a stalled request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout });
    const { loadMediaImage } = await import('./mediaCache');
    const failed = loadMediaImage('missing.png');
    const rejection = expect(failed).rejects.toThrow('Media unavailable');
    images[0].onerror?.(); await rejection;
    const stalled = loadMediaImage('missing.png');
    const timeout = expect(stalled).rejects.toThrow('Media unavailable');
    await vi.advanceTimersByTimeAsync(15000); await timeout;
    const retried = loadMediaImage('missing.png');
    images[2].onload?.(); await retried;
    expect(images).toHaveLength(3);
  });

  it('evicts old decoded artwork when its pixel budget is exceeded', async () => {
    const { loadMediaImage } = await import('./mediaCache');
    for (const name of ['a', 'b', 'c']) {
      const promise = loadMediaImage(name);
      const image = images[images.length - 1];
      image.naturalWidth = 4096; image.naturalHeight = 2048;
      image.onload?.(); await promise;
    }
    const d = loadMediaImage('d'); images[3].onload?.(); await d;
    const evicted = loadMediaImage('a');
    expect(images).toHaveLength(5);
    images[4].onload?.(); await evicted;
  });

  it('bounds speculative work, tolerates failures and reports completion', async () => {
    const { preloadMedia } = await import('./mediaCache');
    let active = 0, maximum = 0;
    const prepare = vi.fn(async (src: string) => {
      maximum = Math.max(maximum, ++active);
      await Promise.resolve(); active--;
      if (src === 'bad') throw new Error('missing');
    });
    const progress = vi.fn();
    await preloadMedia(['a', 'b', 'bad', 'c', 'd', 'a'], progress, prepare);
    expect(maximum).toBe(3);
    expect(prepare).toHaveBeenCalledTimes(5);
    expect(progress).toHaveBeenLastCalledWith(5, 5);
  });
});
