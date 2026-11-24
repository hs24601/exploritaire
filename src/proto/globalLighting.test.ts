import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('honors the toggle on touch and desktop devices and persists changes', async () => {
  const media = { matches: true, addEventListener: vi.fn() };
  const storage = { getItem: vi.fn(() => 'on'), setItem: vi.fn() };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { location: { search: '' }, matchMedia: vi.fn(() => media) });
  const lights = await import('./globalLighting');
  expect(lights.globalLightsEnabled()).toBe(true);
  lights.setGlobalLightsEnabled(true);
  expect(lights.globalLightsEnabled()).toBe(true);
  media.matches = false;
  expect(lights.globalLightsEnabled()).toBe(true);
  lights.setGlobalLightsEnabled(false);
  expect(lights.globalLightsEnabled()).toBe(false);
  expect(storage.setItem).toHaveBeenLastCalledWith('exploritaire-global-lights','off');
});

it('defaults on in combat sandboxes and allows switching off and on', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null,setItem:vi.fn() });
  vi.stubGlobal('window', { location: { search: '?combatsbx' }, matchMedia: () => ({ matches: false, addEventListener: vi.fn() }) });
  const lights = await import('./globalLighting');
  expect(lights.globalLightsEnabled()).toBe(true);
  lights.setGlobalLightsEnabled(false);
  expect(lights.globalLightsEnabled()).toBe(false);
  lights.setGlobalLightsEnabled(true);
  expect(lights.globalLightsEnabled()).toBe(true);
});
