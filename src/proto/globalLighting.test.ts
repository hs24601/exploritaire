import { afterEach, expect, it } from 'vitest';
import { setGlobalLightsEnabled } from './globalLighting';
import { getTableLighting, getVisualTableLighting, sampleTableLight, standeeLighting } from './protoLighting';
import { atmosphereSky } from './volumetricAtmosphere';

afterEach(() => setGlobalLightsEnabled(true));
it('bypasses global shading without changing the clock or steady gameplay light', () => {
  const before=sampleTableLight(12,{x:0,y:0},[]);
  setGlobalLightsEnabled(false);
  const sky=getVisualTableLighting(12);
  expect(sky.hour).toBe(12); expect(sky.daylight).toBe(1); expect(sky.ambient).toBe(1); expect(sky.darkness).toBe(0);
  expect(atmosphereSky(sky).strength).toBe(0); expect(atmosphereSky(sky).night).toBe(0);
  const midnight=getVisualTableLighting(0);
  expect(midnight.hour).toBe(0); expect(midnight.daylight).toBe(1);expect(midnight.darkness).toBe(0);
  setGlobalLightsEnabled(true);
  expect(getVisualTableLighting(0).darkness).toBeGreaterThan(.6);
  expect(getTableLighting(12).daylight).toBe(1);
  expect(sampleTableLight(12,{x:0,y:0},[])).toEqual(before);
});
it('keeps local sources independent while bypassing global face shading and sky shadows', () => {
  setGlobalLightsEnabled(false);
  const unlit=standeeLighting(12,{x:0,y:0},20,[]);
  const lit=standeeLighting(12,{x:0,y:0},20,[{id:'lamp',position:{x:24,y:0},radius:2,strength:.8}]);
  expect(unlit.shadows).toEqual([]);
  expect(lit.brightness).toBe(1); expect(unlit.brightness).toBe(1);
  expect(lit.shadows.some(shadow=>shadow.lightId==='lamp')).toBe(true);
  expect(lit.shadows.some(shadow=>shadow.lightId==='sky')).toBe(false);
});
