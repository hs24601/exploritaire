// Rasterizes one authored scenery subtree, rather than the whole document, by
// letting the browser draw it inside an SVG foreignObject. Computed styles are
// inlined (an SVG image sees no page stylesheets), pseudo-elements become real
// spans, and every image becomes a data URL so the canvas stays readable.
// Canvases are left out: WebGL scenery is copied separately while its frame is valid.

const XHTML = 'http://www.w3.org/1999/xhtml';
const dataUrls = new Map<string, Promise<string>>();
const asDataUrl = (url: string) => {
  let pending = dataUrls.get(url);
  if (!pending) {
    pending = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Scenery image ${response.status}`);
      return response.blob();
    }).then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }));
    pending.catch(() => dataUrls.delete(url));
    dataUrls.set(url, pending);
  }
  return pending;
};

const URL_PATTERN = /url\((['"]?)(.*?)\1\)/g;
const URL_PROPERTIES = ['background-image', 'mask-image', '-webkit-mask-image', 'border-image-source', 'list-style-image'];

/** Inline every computed property; URLs are resolved to data URLs afterwards. */
function inlineStyle(style: CSSStyleDeclaration, overrides = '') {
  let text = '';
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    // Animations and transitions cannot progress inside a still image.
    if (name.startsWith('animation') || name.startsWith('transition')) continue;
    text += `${name}:${style.getPropertyValue(name)};`;
  }
  return text + 'animation:none;transition:none;' + overrides;
}

function pseudo(element: Element, which: '::before' | '::after') {
  const style = getComputedStyle(element, which);
  const content = style.content;
  if (!content || content === 'none' || content === 'normal' || style.display === 'none') return undefined;
  const span = document.createElementNS(XHTML, 'span') as HTMLElement;
  span.setAttribute('style', inlineStyle(style));
  const text = /^["'](.*)["']$/.exec(content)?.[1];
  if (text) span.textContent = text;
  return span;
}

function cloneTree(source: Element, urls: Set<string>, rootOverrides?: string): Node | undefined {
  if (source instanceof HTMLCanvasElement) return undefined;
  const style = getComputedStyle(source);
  if (style.display === 'none') return undefined;
  const clone = document.createElementNS(XHTML, source.localName) as HTMLElement;
  if (source instanceof HTMLImageElement) {
    const src = source.currentSrc || source.src;
    if (src) { clone.setAttribute('src', src); urls.add(src); }
  }
  clone.setAttribute('style', inlineStyle(style, rootOverrides));
  for (const property of URL_PROPERTIES) for (const [, , url] of style.getPropertyValue(property).matchAll(URL_PATTERN)) urls.add(url);
  const before = pseudo(source, '::before');
  if (before) clone.append(before);
  for (const child of source.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) clone.append(child.textContent ?? '');
    else if (child instanceof Element) { const next = cloneTree(child, urls); if (next) clone.append(next); }
  }
  const after = pseudo(source, '::after');
  if (after) clone.append(after);
  return clone;
}

/** Waits for every image the subtree shows, so one capture covers them all. */
async function settleImages(element: HTMLElement) {
  await Promise.all([...element.querySelectorAll('img')].map(image => image.complete ? undefined : image.decode().catch(() => undefined)));
}

/** Draws `element` at its untransformed layout size (CSS px, scale 1), as the
 * former document capture did. Resolves undefined when it has no size. */
export async function rasterizeScenery(element: HTMLElement, filter = 'none'): Promise<HTMLCanvasElement | undefined> {
  await settleImages(element);
  const width = element.clientWidth, height = element.clientHeight;
  if (!width || !height) return undefined;
  const urls = new Set<string>();
  // The layer is placed by its on-screen bounds later; drop its own placement.
  const root = cloneTree(element, urls, `position:relative;inset:auto;left:0;top:0;margin:0;transform:none;width:${width}px;height:${height}px;`);
  if (!root) return undefined;
  let markup = new XMLSerializer().serializeToString(root);
  const resolved = new Map<string, string>();
  await Promise.all([...urls].map(async url => {
    try { resolved.set(url, await asDataUrl(new URL(url, document.baseURI).href)); } catch { /* Missing art leaves its box empty. */ }
  }));
  // Replace attribute and url() references; XMLSerializer escapes & as &amp;.
  for (const [url, data] of resolved) markup = markup.split(url.replace(/&/g, '&amp;')).join(data);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
  // A data URL, not a blob URL: Chrome taints canvases drawn from blob-URL
  // foreignObject images, which would block card-flight snapshots.
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.filter = filter;
  context.drawImage(image, 0, 0, width, height);
  context.filter = 'none';
  return canvas;
}
