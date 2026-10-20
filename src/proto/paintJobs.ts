/** Painter jobs shared by the paint worker and its main-thread fallback, so
 * both produce byte-identical pixels from the same code. */
import { paintBush, type BushPaintPreset } from './bushPainter';
import { paintKhadBridge, paintKhadRoots } from './khadRootPainter';

type Point = { x: number; y: number };
export type PaintJob =
  | { kind: 'khad'; cardId: string; obscureValue: boolean; density: number }
  | { kind: 'khadLink'; a: Point; b: Point; id: string; frame: { x: number; y: number; size: number }; density: number }
  | { kind: 'bush'; preset: BushPaintPreset; size: number };
export type PaintRaster = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };

export function runPaintJob(job: PaintJob): PaintRaster {
  if (job.kind === 'khad') return paintKhadRoots(job.cardId, job.obscureValue, job.density);
  if (job.kind === 'khadLink') return paintKhadBridge(job.a, job.b, job.id, job.frame, job.density);
  return paintBush(job.preset, job.size);
}
