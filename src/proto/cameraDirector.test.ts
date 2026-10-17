import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHOT, type CameraChoreography } from './cameraChoreography';
const sequence = (patch: Partial<CameraChoreography> = {}): CameraChoreography => ({ id: 'reveal', name: 'Reveal', steps: [{ id: 'shot', name: 'Den', shot: DEFAULT_SHOT, durationMs: 1000, holdMs: 1000, easing: 'smooth' }], restore: false, enabled: true, trigger: { event: 'callout', value: 'day01.saved-light' }, ...patch });
beforeEach(() => { vi.resetModules(); const data = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }); });
describe('saved camera director triggers', () => {
  it('persists named sequences and only plays matching enabled events', async () => {
    const d = await import('./cameraDirector'); const play = vi.fn(); d.registerCameraPort({ capture: () => DEFAULT_SHOT, play, pause: vi.fn(), stop: vi.fn() });
    d.saveCameraChoreography(sequence()); d.fireCameraTrigger('callout', 'other'); expect(play).not.toHaveBeenCalled();
    d.fireCameraTrigger('callout', 'day01.saved-light'); expect(play).toHaveBeenCalledTimes(1);
    d.saveCameraChoreography(sequence({ enabled: false })); d.fireCameraTrigger('callout', 'day01.saved-light'); expect(play).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('exploritaire.camera-choreographies.v1')!)[0].enabled).toBe(false);
  });
  it('gives an explicit callout shot priority over trigger bindings', async () => {
    const d = await import('./cameraDirector'); const play = vi.fn(); d.registerCameraPort({ capture: () => DEFAULT_SHOT, play, pause: vi.fn(), stop: vi.fn() });
    const c = sequence(); d.saveCameraChoreography(c); const step = { ...c.steps[0], name: 'Explicit' };
    d.playCalloutCamera('day01.saved-light', { kind: 'shot', step }); expect(play).toHaveBeenCalledTimes(1); expect(play).toHaveBeenCalledWith([step], false, 'Callout shot');
  });
  it('matches wildcard triggers once and rejects duplicate names', async () => {
    const d = await import('./cameraDirector'); const play = vi.fn(); d.registerCameraPort({ capture: () => DEFAULT_SHOT, play, pause: vi.fn(), stop: vi.fn() });
    d.saveCameraChoreography(sequence({ trigger: { event: 'tile-enter', value: '' } }));
    d.fireCameraTrigger('tile-enter', 'hero-den'); expect(play).toHaveBeenCalledTimes(1);
    expect(() => d.saveCameraChoreography(sequence({ id: 'different' }))).toThrow('unique');
    d.deleteCameraChoreography('reveal'); d.fireCameraTrigger('tile-enter', 'hero-den'); expect(play).toHaveBeenCalledTimes(1);
  });
  it('unregisters the camera and safely ignores missing callout sequences', async () => {
    const d = await import('./cameraDirector'); const play = vi.fn(), stop = vi.fn(); const unregister = d.registerCameraPort({ capture: () => DEFAULT_SHOT, play, pause: vi.fn(), stop });
    d.playCalloutCamera('callout', { kind: 'choreography', id: 'missing' }); expect(play).not.toHaveBeenCalled();
    unregister(); expect(stop).toHaveBeenCalled(); expect(d.getCameraPlayback().available).toBe(false);
    expect(() => d.playCameraSteps(sequence().steps)).toThrow('unavailable');
  });
});

it('keeps first-pass defaults out of saved data and restores them after an override is reset', async () => {
  const d = await import('./cameraDirector'); const base = sequence({ id: 'story.day01.opening', name: 'Day 01 opening' });
  d.setDefaultCameraLibrary([base]); expect(d.getCameraLibrary()).toEqual([base]);
  expect(localStorage.getItem('exploritaire.camera-choreographies.v1')).toBeNull();
  d.saveCameraChoreography({ ...base, steps: [{ ...base.steps[0], holdMs: 5000 }] });
  expect(d.getCameraLibrary()).toHaveLength(1); expect(d.getCameraLibrary()[0].steps[0].holdMs).toBe(5000);
  d.deleteCameraChoreography(base.id); expect(d.getCameraLibrary()[0]).toEqual(base);
  expect(JSON.parse(localStorage.getItem('exploritaire.camera-choreographies.v1')!)).toEqual([]);
});

it('does not let a first-pass callout replace a running user-authored scenario shot', async () => {
  const d = await import('./cameraDirector'); const play = vi.fn();
  d.registerCameraPort({ capture: () => DEFAULT_SHOT, play, pause: vi.fn(), stop: vi.fn() });
  const base = sequence({id:'story.day01.opening',name:'First pass',trigger:{event:'manual',value:''}});
  d.setDefaultCameraLibrary([base]); d.setCameraPlayback({playing:true,name:'My opening'});
  d.playCalloutCamera('day01.opening',{kind:'choreography',id:base.id},true);
  expect(play).not.toHaveBeenCalled();
});

it('persists label selections, replaces them between sequences, and clears them on camera teardown', async () => {
  const d = await import('./cameraDirector');
  const unregister = d.registerCameraPort({ capture: () => DEFAULT_SHOT, play: vi.fn(), pause: vi.fn(), stop: vi.fn() });
  d.saveCameraChoreography(sequence({ tileLabelIds: ['hero-den', 'bush'] }));
  d.playCameraChoreography('reveal');
  expect(d.getCameraPlayback().tileLabelIds).toEqual(['hero-den', 'bush']);
  expect(JSON.parse(localStorage.getItem('exploritaire.camera-choreographies.v1')!)[0].tileLabelIds).toEqual(['hero-den', 'bush']);
  d.playCameraSteps(sequence().steps);
  expect(d.getCameraPlayback().tileLabelIds).toEqual([]);
  d.playCameraChoreography('reveal'); unregister();
  expect(d.getCameraPlayback().tileLabelIds).toEqual([]);
  expect(() => d.saveCameraChoreography(sequence({ tileLabelIds: [123] as unknown as string[] }))).toThrow();
});

it('inherits new source scene labels through older camera overrides while honoring an explicit empty selection', async () => {
  const d = await import('./cameraDirector');
  const base = sequence({ tileLabelIds: ['hero-den', 'bush'] });
  d.setDefaultCameraLibrary([base]);
  d.saveCameraChoreography(sequence());
  expect(d.getCameraLibrary()[0].tileLabelIds).toEqual(['hero-den', 'bush']);
  d.saveCameraChoreography(sequence({ tileLabelIds: [] }));
  expect(d.getCameraLibrary()[0].tileLabelIds).toEqual([]);
});
