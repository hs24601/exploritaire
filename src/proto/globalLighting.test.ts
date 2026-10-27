import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('bypasses saved global lighting on mobile, including resets, while retaining the desktop preference', async () => {
  const media = { matches: true, addEventListener: vi.fn() };
  const storage = { getItem: vi.fn(() => 'on'), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { location: { search: '' }, matchMedia: vi.fn(() => media) });
  const lights = await import('./globalLighting');
  expect(lights.globalLightsEnabled()).toBe(false);
  lights.setGlobalLightsEnabled(true);
  expect(lights.globalLightsEnabled()).toBe(false);
  media.matches = false;
  expect(lights.globalLightsEnabled()).toBe(true);
  lights.setGlobalLightsEnabled(false);
  expect(lights.globalLightsEnabled()).toBe(false);
});

it('retains the combat sandbox bypass on desktop', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'on' });
  vi.stubGlobal('window', { location: { search: '?combatsbx' }, matchMedia: () => ({ matches: false, addEventListener: vi.fn() }) });
  const lights = await import('./globalLighting');
  expect(lights.globalLightsEnabled()).toBe(false);
});
