import { rasterizeScenery } from './sceneryRaster';

// Capture only authored scenery, never the tableau's cards, roots or UI.
const scenerySelector = '.proto-tableau-landscape, .travel-dense-bushes, .travel-den-exit__cave, .travel-den-scene-cave';
// The pigment softening is baked into each layer once, not redrawn per card.
const LAYER_FILTER = 'saturate(.78) blur(.6px)';
type WindowFace = { canvas: HTMLCanvasElement; probes: HTMLElement[] };
type Layer = { element: HTMLElement; image: HTMLCanvasElement; signature: string };
const scenes = new WeakMap<HTMLElement, ReturnType<typeof createScene>>();

/** Unchanged markup at an unchanged size keeps its raster. */
const signatureOf = (element: HTMLElement) => `${element.clientWidth}x${element.clientHeight}|${element.outerHTML}`;

function createScene(root: HTMLElement) {
  const faces = new Set<WindowFace>();
  let layers: Layer[] = [];
  let disposed = false, capturing = false, dirty = false, paintFrame = 0;
  let timer: ReturnType<typeof setTimeout>;
  const paint = () => {
    for (const { canvas, probes } of faces) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) continue;
      const [o, x, y] = probes.map(p => p.getBoundingClientRect());
      const matrix = new DOMMatrix([(x.x-o.x)/w, (x.y-o.y)/w, (y.x-o.x)/h, (y.y-o.y)/h, o.x, o.y]);
      if (Math.abs(matrix.a*matrix.d-matrix.b*matrix.c) < .001) continue;
      const inverse = matrix.inverse(), scale = Math.min(2, devicePixelRatio || 1);
      const width = Math.round(w*scale), height = Math.round(h*scale);
      if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.fillStyle = '#23302d'; ctx.fillRect(0,0,w,h);
      ctx.transform(inverse.a,inverse.b,inverse.c,inverse.d,inverse.e,inverse.f);
      for (const layer of layers) {
        const bounds = layer.element.getBoundingClientRect();
        if (bounds.width && bounds.height) ctx.drawImage(layer.image,bounds.x,bounds.y,bounds.width,bounds.height);
      }
    }
  };
  const repaintSoon = () => { if (!paintFrame && !disposed) paintFrame=requestAnimationFrame(() => { paintFrame=0; if (!disposed) paint(); }); };
  const capture = async () => {
    if (disposed) return;
    if (capturing) { dirty = true; return; }
    capturing = true;
    try {
      const next: Layer[] = [];
      for (const element of root.querySelectorAll<HTMLElement>(scenerySelector)) {
        if (!element.clientWidth || !element.clientHeight) continue;
        const signature = signatureOf(element);
        const cached = layers.find(layer => layer.element === element && layer.signature === signature);
        const image = cached?.image ?? await rasterizeScenery(element, LAYER_FILTER);
        if (image) next.push({ element, image, signature });
      }
      if (!disposed) {
        layers=next;
        // The scenery raster omits WebGL. Request a fresh copy after the
        // destination exists, including when reduced motion or pause stops frames.
        for (const { element } of layers) if (element.querySelector('canvas')) element.dispatchEvent(new Event('tableau-scenery-request'));
        paint();
      }
    } catch {
      // Opaque tinted paper remains readable if a scenery asset cannot be captured.
    } finally {
      capturing=false;
      if (dirty) { dirty=false; schedule(); }
    }
  };
  const schedule = () => { clearTimeout(timer); timer=setTimeout(() => void capture(),120); };
  // Copy WebGL while its frame is valid; no preserved drawing buffer or readback loop.
  const rendered = (event: Event) => {
    const element = event.target as HTMLElement;
    const layer = layers.find(item => item.element === element);
    const source = element.querySelector('canvas');
    if (layer && source) {
      const ctx=layer.image.getContext('2d')!;
      ctx.filter = LAYER_FILTER;
      ctx.drawImage(source,0,0,layer.image.width,layer.image.height);
      ctx.filter = 'none';
      paint();
    }
  };
  const insideScenery = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest(scenerySelector);
  const touchesScenery = (node: Node) => node instanceof Element && (node.matches(scenerySelector) || !!node.querySelector(scenerySelector));
  // Field size changes the scenery's layout; card faces only need repainting.
  const rootSize = new ResizeObserver(schedule); rootSize.observe(root);
  const faceSize = new ResizeObserver(repaintSoon);
  const mutations = new MutationObserver(records => {
    let recapture = false, reproject = false;
    for (const record of records) {
      if (record.type === 'childList') {
        if (insideScenery(record.target) || [...record.addedNodes, ...record.removedNodes].some(touchesScenery)) recapture = true;
      } else if (insideScenery(record.target)) {
        // Canvas resizes and camera readouts belong to the live WebGL copy.
        if (!(record.target instanceof HTMLCanvasElement)) recapture = true;
      } else if (record.attributeName === 'style' && (record.target as Element).matches('.travel-arrival-card, .travel-arrival-card__turn')) {
        // Arrival flips and authored card movement change projection, not scenery.
        reproject = true;
      }
    }
    if (recapture) schedule();
    else if (reproject) repaintSoon();
  });
  mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src','data-ready','data-layout','data-compact','data-visible','class','style']});
  root.addEventListener('tableau-scenery-rendered',rendered);
  return { add(face: WindowFace) { faces.add(face); faceSize.observe(face.canvas); if (layers.length) repaintSoon(); schedule(); }, remove(face: WindowFace) {
    faces.delete(face); faceSize.unobserve(face.canvas);
    if (!faces.size) { disposed=true; clearTimeout(timer); cancelAnimationFrame(paintFrame); rootSize.disconnect(); faceSize.disconnect(); mutations.disconnect();
      root.removeEventListener('tableau-scenery-rendered',rendered); scenes.delete(root); }
  }};
}

export function registerSceneryWindow(canvas: HTMLCanvasElement, probes: HTMLElement[]) {
  const root = canvas.closest<HTMLElement>('.travel-tableau, .proto-tableau-field');
  if (!root) return () => {};
  let scene = scenes.get(root);
  if (!scene) { scene=createScene(root); scenes.set(root,scene); }
  const face={canvas,probes}; scene.add(face);
  return () => scene.remove(face);
}
