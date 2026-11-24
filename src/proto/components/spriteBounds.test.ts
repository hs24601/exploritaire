import { describe, expect, it, vi } from 'vitest';
import spriteTrims from '../../data/spriteTrims.json';

const loadMediaImage = vi.fn(() => Promise.reject(new Error('runtime decode')));
vi.mock('../mediaCache', () => ({ loadMediaImage }));
vi.stubGlobal('window', { location: { href: 'http://localhost:5178/proto.html', origin: 'http://localhost:5178' } });
const { prewarmSpriteBounds, registerSpriteBounds } = await import('./spriteBounds');

describe('precomputed sprite trims', () => {
  it('bundled art resolves from the manifest without decoding pixels', async () => {
    const rel = 'assets/runtime/characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png';
    const entry = (spriteTrims.sprites as Record<string, { x0: number; y0: number; x1: number; y1: number; aspect: number }>)[rel];
    expect(entry).toBeDefined();
    await expect(prewarmSpriteBounds(`/${rel}`)).resolves.toEqual({ x0: entry.x0, y0: entry.y0, x1: entry.x1, y1: entry.y1, aspect: entry.aspect });
    await expect(prewarmSpriteBounds(`http://localhost:5178/${rel}?v=2`)).resolves.toMatchObject({ x0: entry.x0 });
    expect(loadMediaImage).not.toHaveBeenCalled();
  });
  it('sleeping bodies keep the complete silhouette trim of their bobtail art', async () => {
    const sprites = spriteTrims.sprites as Record<string, { x0: number }>;
    const body = Object.keys(sprites).find(rel => /hero-sleeping-body-v3\.png$/.test(rel));
    if (!body) return;
    const tail = sprites[body.replace('-body-v3.png', '-bobtail-v2.png')];
    if (tail) await expect(prewarmSpriteBounds(`/${body}`)).resolves.toMatchObject({ x0: tail.x0 });
  });
  it('session-painted art uses the trim it registers', async () => {
    const bounds = { x0: .1, y0: .2, x1: .9, y1: 1, aspect: .8 };
    registerSpriteBounds('blob:http://localhost:5178/pine', bounds);
    await expect(prewarmSpriteBounds('blob:http://localhost:5178/pine')).resolves.toEqual(bounds);
    expect(loadMediaImage).not.toHaveBeenCalled();
  });
});
