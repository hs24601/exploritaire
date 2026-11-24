import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function environment(search = '', saved: string | null = null, mobile = false) {
  const storage = { getItem: vi.fn((key: string) => key === 'exploritaire-map-lighting-renderer' ? saved : null), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', { userAgent: mobile ? 'Android' : 'Windows' });
  vi.stubGlobal('window', { location: { search, href: `http://localhost/roam.html${search}` },
    history: { state: { keep: true }, replaceState: vi.fn() },
    matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' ? mobile : !mobile }) });
  return storage;
}

it('honors explicit URLs before saved choices and preserves automatic mobile detection', async () => {
  const cases: [string, string | null, boolean, string][] = [
    ['?lightingRenderer=mobile', 'off', false, 'mobile'],
    ['?lightingRenderer=desktop', 'mobile', true, 'full'],
    ['?lightingRenderer=off', 'full', false, 'off'],
    ['', 'mobile', false, 'mobile'], ['', null, true, 'mobile'], ['', null, false, 'full'],
  ];
  for (const [search, saved, mobile, expected] of cases) {
    vi.resetModules(); environment(search, saved, mobile);
    const renderer = await import('./mapLightingRenderer');
    expect(renderer.getMapLightingRenderer()).toBe(expected);
  }
});

it('cycles and remembers the choice without navigating or losing query parameters', async () => {
  const storage = environment('?lightingRenderer=mobile&scene=abc#hero');
  const renderer = await import('./mapLightingRenderer');
  expect((['off', 'mobile', 'full'] as const).map(renderer.nextMapLightingRenderer)).toEqual(['mobile', 'full', 'off']);
  renderer.setMapLightingRenderer('full');
  expect(renderer.getMapLightingRenderer()).toBe('full');
  expect(storage.setItem).toHaveBeenLastCalledWith('exploritaire-map-lighting-renderer', 'full');
  expect(window.history.replaceState).toHaveBeenLastCalledWith({ keep: true }, '', expect.objectContaining({ search: '?lightingRenderer=desktop&scene=abc', hash: '#hero' }));
});

it('off neutralizes visual light and shadows while preserving steady gameplay samples', async () => {
  environment('?lightingRenderer=desktop');
  const renderer = await import('./mapLightingRenderer');
  const lighting = await import('./protoLighting');
  const lights = [{ id: 'lamp', position: { x: 48, y: 0 }, strength: 1 }];
  const position = { x: 0, y: 0 };
  const before = lighting.sampleTableLight(0, position, lights);
  expect(lighting.standeeLighting(0, position, 40, lights).shadows.length).toBeGreaterThan(0);
  renderer.setMapLightingRenderer('off');
  expect(lighting.getVisualTableLighting(0)).toMatchObject({ globalLights: false, darkness: 0, ambient: 1 });
  expect(lighting.standeeLighting(0, position, 40, lights)).toMatchObject({ brightness: 1, warmth: 0, rim: null, shadows: [] });
  expect(lighting.tableObjectShadow(0, position, 8, lights)).toBe('none');
  expect(lighting.sampleTableLight(0, position, lights)).toEqual(before);
  renderer.setMapLightingRenderer('mobile');
  expect(lighting.getVisualTableLighting(0).globalLights).toBe(true);
  expect(lighting.standeeLighting(0, position, 40, lights).shadows.length).toBeGreaterThan(0);
});

it('makes Roam unlit outside local sources and tunes optical depth without changing gameplay samples', async () => {
  environment('?lightingRenderer=desktop');
  const renderer = await import('./mapLightingRenderer');
  const lighting = await import('./protoLighting');
  renderer.configureMapLightingEnvironment({ localLightsOnly: true });
  const lights = [
    { id: 'home', position: { x: 0, y: 96 }, strength: 1, radius: 1.7 },
    { id: 'berries', position: { x: 0, y: 48 }, strength: .9, radius: 1.35 },
  ];
  const far = { x: 240, y: 0 };
  expect(lighting.getTableLighting(12)).toMatchObject({ daylight: 0, ambient: 0, skyLight: false });
  expect(lighting.sampleTableLight(12, far, lights)).toMatchObject({ total: 0, local: 0 });
  const before = lighting.sampleTableLight(0, { x: 0, y: 96 }, lights);
  renderer.setDarknessStrength(15);
  expect(lighting.getVisualTableLighting(0).darkness).toBeCloseTo(lighting.getTableLighting(0).darkness);
  renderer.setDarknessStrength(100);
  expect(lighting.getVisualTableLighting(0).darkness).toBeGreaterThan(.999);
  expect(lighting.standeeLighting(0, far, 40, lights).brightness).toBeLessThan(.001);
  expect(lighting.standeeLighting(0, { x: 0, y: 96 }, 40, lights).brightness).toBeGreaterThan(1);
  expect(lighting.standeeLighting(0, far, 40, lights).shadows).toEqual([]);
  expect(lighting.sampleTableLight(0, { x: 0, y: 96 }, lights)).toEqual(before);
  renderer.setDarknessStrength(200); expect(renderer.getDarknessStrength()).toBe(200);
  renderer.setDarknessStrength(NaN); expect(renderer.getDarknessStrength()).toBe(200);
});
