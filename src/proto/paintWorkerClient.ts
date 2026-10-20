import { runPaintJob, type PaintJob, type PaintRaster } from './paintJobs';

/** A painted result: an encoded PNG from the worker, or raw pixels. */
export type PaintResult = { blob?: Blob; raster?: PaintRaster; paintMs: number; offThread: boolean };

type Pending = { resolve: (result: PaintResult) => void; reject: (error: Error) => void; job: PaintJob; encode: boolean; timer: ReturnType<typeof setTimeout> };
// Up to two workers: enough to bake a dense patch's cards in parallel without
// competing with the game for every core.
const workers: Worker[] = [], busy = new Map<Worker, number>(), pending = new Map<number, Pending>();
let unavailable = typeof Worker === 'undefined', serial = 0, next = 0;

/** Paints on the UI thread after yielding, as before; used without workers. */
function fallback(job: PaintJob): Promise<PaintResult> {
  return new Promise((resolve, reject) => setTimeout(() => {
    try { const started = performance.now(), raster = runPaintJob(job); resolve({ raster, paintMs: performance.now() - started, offThread: false }); }
    catch (error) { reject(error instanceof Error ? error : new Error(String(error))); }
  }, 0));
}

/** On a worker failure, stop using workers and finish its jobs on the UI thread. */
function stopWorkers() {
  unavailable = true;
  workers.splice(0).forEach(worker => worker.terminate());
  const jobs = [...pending.values()]; pending.clear();
  for (const job of jobs) { clearTimeout(job.timer); fallback(job.job).then(job.resolve, job.reject); }
}

function workerFor(): Worker | undefined {
  if (unavailable) return undefined;
  try {
    const limit = Math.max(1, Math.min(2, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));
    while (workers.length < limit) {
      const worker = new Worker(new URL('./paintWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; blob?: Blob; raster?: PaintRaster; paintMs?: number; error?: string }>) => {
        busy.set(worker, Math.max(0, (busy.get(worker) ?? 1) - 1));
        const job = pending.get(event.data.id); if (!job) return;
        pending.delete(event.data.id); clearTimeout(job.timer);
        if (event.data.error) job.reject(new Error(event.data.error));
        else job.resolve({ blob: event.data.blob, raster: event.data.raster, paintMs: event.data.paintMs ?? 0, offThread: true });
      };
      worker.onerror = () => stopWorkers();
      workers.push(worker); busy.set(worker, 0);
    }
    // Least busy worker, round-robin among equals.
    const sorted = workers.map((w, i) => ({ w, load: busy.get(w) ?? 0, order: (i - next + workers.length) % workers.length })).sort((p, q) => p.load - q.load || p.order - q.order);
    next = (workers.indexOf(sorted[0].w) + 1) % workers.length;
    return sorted[0].w;
  } catch { stopWorkers(); return undefined; }
}

/** Paints a job off the UI thread when possible. `encode` asks the worker for
 * a PNG Blob (for <image>/object URLs); otherwise raw pixels come back. */
export function paintOffThread(job: PaintJob, { encode = false } = {}): Promise<PaintResult> {
  const worker = workerFor();
  if (!worker) return fallback(job);
  const id = ++serial;
  return new Promise((resolve, reject) => {
    // A stuck worker must not leave art unpainted: fall back after 15 s.
    const timer = setTimeout(() => stopWorkers(), 15000);
    pending.set(id, { resolve, reject, job, encode, timer });
    busy.set(worker, (busy.get(worker) ?? 0) + 1);
    worker.postMessage({ id, job, encode });
  });
}

/** An object URL for a painted result, encoding on this thread only when the
 * worker could not. */
export async function paintedObjectUrl(result: PaintResult): Promise<string> {
  if (result.blob) return URL.createObjectURL(result.blob);
  const raster = result.raster!, canvas = document.createElement('canvas');
  canvas.width = raster.width; canvas.height = raster.height;
  canvas.getContext('2d')!.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Paint encode failed.')), 'image/png'));
}
