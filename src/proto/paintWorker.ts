import { runPaintJob, type PaintJob } from './paintJobs';

/** Paints off the UI thread. With OffscreenCanvas it also encodes the PNG here
 * and replies with a Blob; otherwise it transfers the raw pixels. */
type Request = { id: number; job: PaintJob; encode: boolean };
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage: (message: unknown, transfer?: Transferable[]) => void };
scope.onmessage = async event => {
  const { id, job, encode } = event.data;
  try {
    const started = performance.now(), raster = runPaintJob(job), paintMs = performance.now() - started;
    if (encode && typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(raster.width, raster.height);
      canvas.getContext('2d')!.putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
      scope.postMessage({ id, blob: await canvas.convertToBlob({ type: 'image/png' }), paintMs });
    } else scope.postMessage({ id, raster, paintMs }, [raster.data.buffer]);
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
