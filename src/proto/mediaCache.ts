/** Share downloads and decoded pixels across CSS sprites and WebGL consumers.
 * Textures still belong to their renderer and can be disposed independently. */
const pending = new Map<string, Promise<HTMLImageElement>>();
const decoded = new Map<string, HTMLImageElement>();
const retained = new Map<string, number>();
// About 96 MiB for ordinary cached images. The finite retained opening set may
// exceed this while mounted; speculative background art cannot evict that set.
const MAX_PIXELS = 24 * 1024 * 1024;
let pixels = 0;

function evict() {
  while (pixels > MAX_PIXELS) {
    const oldest = [...decoded.keys()].find(key => !retained.has(key));
    if (!oldest) break;
    const image = decoded.get(oldest)!;
    pixels -= image.naturalWidth * image.naturalHeight;
    decoded.delete(oldest);
  }
}

/** Keep the finite opening/travel set warm while its scene is mounted. The
 * background LRU must not evict it before the first OK constructs Hero's rig.
 * These are shared decoded images, not additional texture copies. */
export function retainMediaImages(sources: readonly string[]) {
  const keys = [...new Set(sources.map(src => new URL(src, document.baseURI).href))];
  keys.forEach(key => retained.set(key, (retained.get(key) ?? 0) + 1));
  return () => {
    keys.forEach(key => {
      const count = (retained.get(key) ?? 0) - 1;
      if (count > 0) retained.set(key, count); else retained.delete(key);
    });
    evict();
  };
}

export function loadMediaImage(src: string): Promise<HTMLImageElement> {
  const key = new URL(src, document.baseURI).href;
  const cached = decoded.get(key);
  if (cached) {
    decoded.delete(key); decoded.set(key, cached);
    return Promise.resolve(cached);
  }
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Match ordinary <img>/CSS requests for same-origin art so their browser
    // image cache can reuse this preload. External canvas sources need CORS.
    if (new URL(key).origin !== new URL(document.baseURI).origin) image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => fail(), 15000);
    const cleanup = () => { clearTimeout(timer); image.onload = null; image.onerror = null; };
    const fail = () => { cleanup(); reject(new Error(`Media unavailable: ${src}`)); };
    image.onerror = fail;
    image.onload = async () => {
      // Some browsers reject decode() for otherwise valid SVGs; onload is sufficient there.
      try { await image.decode(); } catch { /* Retain successfully loaded artwork. */ }
      cleanup();
      if (!image.naturalWidth) { reject(new Error(`Empty media: ${src}`)); return; }
      resolve(image);
    };
    image.src = key;
  }).then(image => {
    decoded.set(key, image);
    pixels += image.naturalWidth * image.naturalHeight;
    evict();
    return image;
  }).finally(() => { pending.delete(key); });
  pending.set(key, promise);
  return promise;
}

/** Limit speculative network and decode work so warming doesn't flood the page. */
export async function preloadMedia(sources: readonly string[], onProgress?: (done: number, total: number) => void,
  prepare: (src: string) => Promise<unknown> = loadMediaImage, shouldContinue: () => boolean = () => true) {
  const queue = [...new Set(sources)];
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < queue.length && shouldContinue()) {
      const src = queue[cursor++];
      try { await prepare(src); } catch { /* Existing render fallbacks handle missing art. */ }
      onProgress?.(++done, queue.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
}
