/** Live camera custom properties, delivered without restyling the whole map.
 *
 * Changing an inherited custom property restyles every descendant of the
 * element it is set on. Written on the map viewport each camera frame, that
 * whole-map style recalc cost several ms per frame. During motion:
 * - an element whose inline style references a tracked property receives that
 *   declaration with the live values substituted in, so only the element
 *   itself restyles (transforms, offsets and sizes are not inherited);
 * - elements reading tracked properties from stylesheet rules receive the
 *   properties themselves.
 * The viewport receives the resting values on each React commit, so any
 * reader this scan misses only lags until the camera rests. */
const TRACKED = ['--camera-transform', '--camera-x', '--camera-y', '--camera-scale', '--camera-yaw', '--camera-sx', '--table-tilt', '--actor-world-scale'] as const;
export type CameraVariable = typeof TRACKED[number];
/** Stylesheet rules reading tracked properties (src/index.css). */
const CLASS_CONSUMERS = '.proto-actor-base-name, .proto-atmosphere__world, .proto-atmosphere__billboard, .proto-face-camera, .proto-story-card';
const TRACKED_REFERENCE = new RegExp(`var\\((${TRACKED.join('|')})(?:\\s*,\\s*([^()]*))?\\)`, 'g');
const references = (value: string) => TRACKED.some(name => value.includes(`var(${name}`));

/** Inline `name: value` declarations, splitting on semicolons outside parentheses. */
export const inlineDeclarations = (style: string) => {
  const declarations: [string, string][] = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= style.length; i++) {
    const char = style[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === ';' || i === style.length) && depth <= 0) {
      const text = style.slice(start, i), colon = text.indexOf(':');
      if (colon > 0) declarations.push([text.slice(0, colon).trim(), text.slice(colon + 1).trim()]);
      start = i + 1;
    }
  }
  return declarations;
};

/** A declaration with every tracked reference that has a live value resolved. */
export const substituteCameraVariables = (template: string, values: ReadonlyMap<string, string>) =>
  template.replace(TRACKED_REFERENCE, (whole, name: string) => values.get(name) || whole);

type InlineReader = { el: HTMLElement; declarations: { name: string; template: string; written?: string; released?: boolean }[] };
const scopes = new WeakMap<HTMLElement, ScopedCameraVariables>();

export class ScopedCameraVariables {
  private values = new Map<CameraVariable, string>();
  private inline: InlineReader[] = [];
  private classed: HTMLElement[] = [];
  private stale = true;
  private queued = false;
  private changed = new Set<CameraVariable>();
  private observer: MutationObserver;
  constructor(readonly root: HTMLElement) {
    // New pieces and class changes can add readers; inline style edits made
    // by React commits are caught on write and by the rescan on each settle.
    this.observer = new MutationObserver(() => { this.stale = true; });
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scopes.set(root, this);
  }
  private scan() {
    this.stale = false;
    const previous = new Map(this.inline.map(reader => [reader.el, reader]));
    const classed = new Set(this.classed);
    this.inline = []; this.classed = [];
    for (const el of this.root.querySelectorAll<HTMLElement>('*')) {
      if (el.matches(CLASS_CONSUMERS)) {
        this.classed.push(el);
        // A reader found mid-motion would otherwise inherit the resting values.
        if (!classed.has(el)) for (const [name, value] of this.values) el.style.setProperty(name, value);
      }
      const known = previous.get(el), style = el.getAttribute('style');
      // Written declarations now hold literals; keep their templates and add
      // any declaration a later React commit has introduced.
      const found = style && references(style) ? inlineDeclarations(style).filter(([name, value]) => references(value)
        && !known?.declarations.some(declaration => declaration.name === name && !declaration.released)).map(([name, template]) => ({ name, template })) : [];
      if (known) { known.declarations = [...known.declarations.filter(declaration => !declaration.released), ...found]; this.inline.push(known); }
      else if (found.length) this.inline.push({ el, declarations: found });
    }
  }
  private flush() {
    this.queued = false;
    if (this.stale) this.scan();
    for (const reader of this.inline) for (const declaration of reader.declarations) {
      const current = reader.el.style.getPropertyValue(declaration.name);
      if (declaration.released) continue;
      // React wrote this declaration since our last frame: adopt its new
      // template, or release a value that no longer reads the camera.
      if (declaration.written !== undefined && current !== declaration.written) {
        if (!references(current)) { declaration.released = true; continue; }
        declaration.template = current;
      }
      const next = substituteCameraVariables(declaration.template, this.values);
      if (next === current) continue;
      reader.el.style.setProperty(declaration.name, next);
      declaration.written = reader.el.style.getPropertyValue(declaration.name);
    }
    for (const el of this.classed) for (const name of this.changed) el.style.setProperty(name, this.values.get(name)!);
    this.changed.clear();
  }
  /** Per-frame value, delivered to its readers at the end of the current task. */
  set(name: CameraVariable, value: string) {
    if (this.values.get(name) === value) return;
    this.values.set(name, value);
    this.changed.add(name);
    if (!this.queued) { this.queued = true; queueMicrotask(() => this.flush()); }
  }
  get(name: CameraVariable) { return this.values.get(name) ?? this.root.style.getPropertyValue(name); }
  /** A commit may have added readers; rescan before the next delivery. */
  invalidate() { this.stale = true; }
  /** Publish the resting values on the root, and refresh the reader list. */
  settle() {
    for (const [name, value] of this.values) if (this.root.style.getPropertyValue(name) !== value) this.root.style.setProperty(name, value);
    this.stale = true;
  }
}

/** One scope per viewport element, surviving React remounts of its owner. */
export const cameraVariableScope = (root: HTMLElement) => scopes.get(root) ?? new ScopedCameraVariables(root);

/** The live value inside a scoped viewport, or its inline root value. */
export const readCameraVariable = (root: HTMLElement, name: CameraVariable) =>
  scopes.get(root)?.get(name) ?? root.style.getPropertyValue(name);
