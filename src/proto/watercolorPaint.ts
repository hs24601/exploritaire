import { DEFAULT_DABS, parseRadialDabPreset, radialDabCanvas, radialDabKey, type RadialDabPreset } from './radialDabs';
import { parseWashPreset, watercolorWashCanvas, washPresetKey, type WashPalette, type WashPreset } from './watercolorWash';

export type PaintPreset = Readonly<RadialDabPreset> | Readonly<WashPreset>;
export const DEFAULT_PAINT: PaintPreset = DEFAULT_DABS;
export function isRadialDabPreset(preset: PaintPreset): preset is Readonly<RadialDabPreset> { return 'method' in preset && preset.method === 'radial-dabs'; }
export function parsePaintPreset(value: unknown): PaintPreset {
  return value && typeof value === 'object' && 'method' in value ? parseRadialDabPreset(value) : parseWashPreset(value);
}
export function paintPresetKey(preset: PaintPreset = DEFAULT_PAINT) { return isRadialDabPreset(preset) ? radialDabKey(preset) : washPresetKey(preset); }
export function paintCanvas(palette: WashPalette, preset: PaintPreset = DEFAULT_PAINT, variation = 0, size = 256) {
  return isRadialDabPreset(preset) ? radialDabCanvas(palette, preset, variation, size) : watercolorWashCanvas(palette, preset, variation, size);
}
