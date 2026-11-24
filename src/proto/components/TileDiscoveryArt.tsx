import { gameTime } from '../../gameTime';
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { advanceDiscoveryAnimations, discoveryVisible, DISCOVERY_DURATION_MS, DISCOVERY_ETCH_MS, type DiscoveryTile } from '../tileDiscoveryAnimation';
import { useWatercolorBleed } from '../watercolorBleed';

type Discovery = { filter: (ids: string | readonly string[], detail?: boolean, relief?: boolean) => string | undefined };
const Context = createContext<Discovery>({ filter: () => undefined });
const SKETCH_SETTLE_MS = 400;
export const useTileDiscovery = () => useContext(Context);

/** Context crosses the ground/shadow portals. One SVG animation per tile
 * drives every 2D art surface without a React or raster update each frame.
 * Keep filters off the world/standee transform nodes: filters flatten 3D. */
export function TileDiscoveryProvider({ tiles, reliefSketch = {}, children }: { tiles: readonly DiscoveryTile[]; reliefSketch?: Readonly<Record<string, number>>; children: ReactNode }) {
  const prefix = 'tile-discovery-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const previous = useRef(new Map(tiles.map(tile => [tile.id, discoveryVisible(tile)])));
  const [active, setActive] = useState(new Map<string, number>());
  const activeRef = useRef(active);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    changed(); query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  useLayoutEffect(() => {
    const next = advanceDiscoveryAnimations(previous.current, activeRef.current, tiles, gameTime.now(), reduced);
    previous.current = new Map(tiles.map(tile => [tile.id, discoveryVisible(tile)]));
    if (next.size !== activeRef.current.size || [...next].some(([id, time]) => activeRef.current.get(id) !== time)) {
      activeRef.current = next; setActive(next);
    }
  }, [tiles, reduced]);
  useEffect(() => {
    if (!active.size) return;
    const remaining = Math.max(0, Math.min(...active.values()) + DISCOVERY_DURATION_MS - gameTime.now());
    const timer = gameTime.setTimeout(() => {
      const next = new Map([...activeRef.current].filter(([, time]) => gameTime.now() - time < DISCOVERY_DURATION_MS));
      activeRef.current = next; setActive(next);
    }, remaining + 16);
    return () => gameTime.clearTimeout(timer);
  }, [active]);
  // Chrome re-runs SVG reference filters on the CPU every frame, so the full
  // watercolor filter only runs while a tile's paint or adjacent ink moves.
  // Resting sketch tiles use the colour-matrix detail filter (Day 01: 20 -> 60 fps idle).
  // Plain timers: a paused game clock must still let the filter settle.
  const painted = useRef(new Map(tiles.map(tile => [tile.id, `${tile.traversalProgress}:${reliefSketch[tile.id] ?? 0}`])));
  const [moving, setMoving] = useState<ReadonlySet<string>>(new Set());
  const settleTimers = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const changed = tiles.filter(tile => painted.current.get(tile.id) !== `${tile.traversalProgress}:${reliefSketch[tile.id] ?? 0}`).map(tile => tile.id);
    painted.current = new Map(tiles.map(tile => [tile.id, `${tile.traversalProgress}:${reliefSketch[tile.id] ?? 0}`]));
    if (!changed.length) return;
    setMoving(current => changed.every(id => current.has(id)) ? current : new Set([...current, ...changed]));
    for (const id of changed) {
      window.clearTimeout(settleTimers.current.get(id));
      settleTimers.current.set(id, window.setTimeout(() => {
        settleTimers.current.delete(id);
        setMoving(current => { const next = new Set(current); next.delete(id); return next; });
      }, SKETCH_SETTLE_MS));
    }
  }, [tiles, reliefSketch]);
  useEffect(() => () => settleTimers.current.forEach(timer => window.clearTimeout(timer)), []);
  const entries = useMemo(() => {
    const controlled = tiles.filter(tile => tile.traversalProgress !== undefined && tile.traversalProgress < 1 && discoveryVisible(tile));
    return [...[...active].filter(([id]) => !tiles.some(t => t.id === id && t.traversalProgress !== undefined)).map(([tileId, started]) => ({ tileId, started, progress: undefined as number | undefined })), ...controlled.map(tile => ({ tileId: tile.id, started: 0, progress: tile.traversalProgress }))].map((entry, index) => ({ ...entry, id: `${prefix}-${index}` }));
  }, [active, prefix, tiles]);
  const value = useMemo<Discovery>(() => ({ filter: (ids, detail = false, relief = false) => {
    const candidates = typeof ids === 'string' ? [ids] : ids;
    const entry = entries.filter(item => candidates.includes(item.tileId)).sort((a, b) => b.started - a.started)[0];
    if (!entry) return undefined;
    const resting = entry.progress !== undefined && !moving.has(entry.tileId);
    return `url(#${entry.id}${resting ? '-detail' : relief && reliefSketch[entry.tileId] > 0 ? '-relief' : detail ? '-detail' : ''})`;
  } }), [entries, reliefSketch, moving]);
  return <Context.Provider value={value}>
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>{entries.map(entry => <DiscoveryFilter key={`${entry.tileId}-${entry.started}`} {...entry} />)}
        {entries.filter(entry => reliefSketch[entry.tileId] > 0).map(entry => <DiscoveryFilter key={`${entry.tileId}-relief`} {...entry} id={`${entry.id}-relief`} inkProgress={reliefSketch[entry.tileId]} />)}
      </defs>
    </svg>
    {children}
  </Context.Provider>;
}

/** Scott Kellum's Watercolor fill inspired the noise threshold and contour
 * pass: https://codepen.io/scottkellum/pen/PoVjeEZ. Preserve SourceAlpha and
 * use normalized primitive coordinates for ground, cutouts and volume canvases.
 * A separate etch mask finishes before the slower pigment mask starts. */
function DiscoveryFilter({ id, tileId, started, progress, inkProgress = 0 }: { id: string; tileId: string; started: number; progress?: number; inkProgress?: number }) {
  const bleed = useWatercolorBleed();
  const bleedFade = useRef<SVGAnimateElement>(null);
  const strokeSweep = useRef<SVGAnimateElement>(null);
  const etch = useRef<SVGAnimateElement>(null), detail = useRef<SVGAnimateElement>(null);
  useLayoutEffect(() => {
    if (progress === undefined) { etch.current?.beginElement(); detail.current?.beginElement(); bleedFade.current?.beginElement(); strokeSweep.current?.beginElement(); }
  }, []);
  const etchValue = progress === undefined ? -5 : -5 + 6 * Math.min(1, .25 + Math.max(progress * 4, inkProgress * .75));
  const paintProgress = progress === undefined ? 1 : Math.max(0, Math.min(1, (progress - .25) / .75));
  // Adapt the reference's pathLength/dashoffset brush reveal to normalized
  // artwork bounds. Source colors remain authored rather than tinted blue.
  const brush = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M-15 0 H115 Q130 0 115 20 H-15 Q-30 20 -15 40 H115 Q130 40 115 60 H-15 Q-30 60 -15 80 H115 Q130 80 115 100 H-15" pathLength="1" fill="none" stroke="white" stroke-width="25" stroke-linecap="round" stroke-dasharray="1.2" stroke-dashoffset="${1.2 * (1 - paintProgress)}" opacity="${Math.min(1, paintProgress * 4)}"/></svg>`)}`;
  return <><filter id={id} data-discovery-tile={tileId} data-discovery-start={started} data-traversal-progress={progress} data-adjacent-ink={inkProgress || undefined}
    data-watercolor-bleed={bleed} x="-6%" y="-6%" width="112%" height="112%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="3 4" numOctaves="2" seed="7" result="noise" />
    <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
    <feComponentTransfer in="monoNoise" result="etchMaskRGB">
      <feFuncR type="linear" slope="6" intercept={etchValue}>{progress === undefined && <animate ref={etch} attributeName="intercept" from="-5" to="1" dur={`${DISCOVERY_ETCH_MS}ms`} begin="indefinite" fill="freeze" />}</feFuncR>
      <feFuncG type="identity" /><feFuncB type="identity" />
    </feComponentTransfer>
    <feColorMatrix in="etchMaskRGB" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="etchMask" />
    {/* adnavHenry's supplied paintBlue filter: displaced brush alpha and
        multiply-lit paper grain, adapted to preserve transparent game art. */}
    <feImage href={brush} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="brushStroke" />
    <feOffset in="brushStroke" dx={progress === undefined ? -1.2 : 0} result="sweptStroke">
      {progress === undefined && <animate ref={strokeSweep} attributeName="dx" values="-1.2;-1.2;0" keyTimes={`0;${DISCOVERY_ETCH_MS / DISCOVERY_DURATION_MS};1`} dur={`${DISCOVERY_DURATION_MS}ms`} begin="indefinite" fill="freeze" />}
    </feOffset>
    <feTurbulence baseFrequency="2.5" type="fractalNoise" numOctaves="4" seed="2" result="washNoise" />
    <feDisplacementMap in="sweptStroke" in2="washNoise" scale=".09" xChannelSelector="R" yChannelSelector="G" result="blobs" />
    <feGaussianBlur in="blobs" stdDeviation=".008" result="fillMask" />
    <feConvolveMatrix in="SourceGraphic" order="3" kernelMatrix="0 -1 0 -1 4 -1 0 -1 0" kernelUnitLength=".008 .008" preserveAlpha="true" result="contours" />
    <feColorMatrix in="contours" type="luminanceToAlpha" result="contourAlpha" />
    <feMorphology in="SourceAlpha" operator="erode" radius=".008" result="inside" />
    <feComposite in="SourceAlpha" in2="inside" operator="out" result="outline" />
    <feMerge result="lines"><feMergeNode in="outline" /><feMergeNode in="contourAlpha" /></feMerge>
    <feFlood floodColor="#ddd0aa" result="ink" />
    <feComposite in="ink" in2="lines" operator="in" result="inkLines" />
    <feComposite in="inkLines" in2="etchMask" operator="in" result="etched" />
    <feComposite in="etched" in2="fillMask" operator="out" result="unpaintedInk" />
    <feTurbulence numOctaves="3" seed="0" type="fractalNoise" baseFrequency="90" result="paperGrain" />
    <feDiffuseLighting in="paperGrain" lightingColor="#fafafa" surfaceScale=".0005" diffuseConstant="1.1" kernelUnitLength=".003" result="paper">
      <feDistantLight elevation="65" azimuth="75" />
    </feDiffuseLighting>
    <feBlend in="SourceGraphic" in2="paper" mode="multiply" result="paperColor" />
    <feComposite in="paperColor" in2="SourceAlpha" operator="in" result="texturedArt" />
    <feComposite in="texturedArt" in2="fillMask" operator="in" result="pigment" />
    {/* Layered translucent, irregular washes inspired by Pimskie's Water paint:
        https://codepen.io/pimskie/pen/VBNdZP. Only earned pigment feeds the
        spread; adjacent ink alone cannot introduce color. Keep this branch
        mounted when toggling so timed discovery never restarts. */}
    <feGaussianBlur in="pigment" stdDeviation=".012 .009" result="wetPigment" />
    <feDisplacementMap in="wetPigment" in2="noise" scale=".028" xChannelSelector="R" yChannelSelector="G" result="irregularWash" />
    <feGaussianBlur in="irregularWash" stdDeviation=".006" result="softWash" />
    <feComponentTransfer in="softWash" result="fadingWash">
      <feFuncA type="linear" slope={progress === undefined ? .32 : .32 * (1 - progress)}>
        {progress === undefined && <animate ref={bleedFade} attributeName="slope" values=".32;.32;0" keyTimes={`0;${DISCOVERY_ETCH_MS / DISCOVERY_DURATION_MS};1`} dur={`${DISCOVERY_DURATION_MS}ms`} begin="indefinite" fill="freeze" />}
      </feFuncA>
    </feComponentTransfer>
    <feComponentTransfer in="fadingWash" result="bleedWash"><feFuncA type="linear" slope={bleed ? 1 : 0} /></feComponentTransfer>
    <feComposite in="unpaintedInk" in2="SourceAlpha" operator="in" result="clippedInk" />
    {/* Complementary masks add to the original alpha, including soft paint
        edges; clipping the final SourceGraphic again would square its alpha. */}
    <feComposite in="clippedInk" in2="pigment" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="painting" />
    <feMerge><feMergeNode in="bleedWash" /><feMergeNode in="painting" /></feMerge>
  </filter>
    {/* Tiny litter/spills only need the ink silhouette and pigment fade.
        One color matrix avoids dozens of animated noise/convolution passes
        per woodland while the large terrain/props carry the watercolor mask. */}
    <filter id={`${id}-detail`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={progress === undefined ? '0 0 0 0 .86  0 0 0 0 .81  0 0 0 0 .67  0 0 0 0 0' : `${progress} 0 0 0 ${(1-progress)*.86}  0 ${progress} 0 0 ${(1-progress)*.81}  0 0 ${progress} 0 ${(1-progress)*.67}  0 0 0 ${.3+.7*progress} 0`}>
        {progress === undefined && <animate ref={detail} attributeName="values" begin="indefinite" fill="freeze" dur={`${DISCOVERY_DURATION_MS}ms`}
          keyTimes={`0;${DISCOVERY_ETCH_MS / DISCOVERY_DURATION_MS};1`}
          values="0 0 0 0 .86  0 0 0 0 .81  0 0 0 0 .67  0 0 0 0 0;0 0 0 0 .86  0 0 0 0 .81  0 0 0 0 .67  0 0 0 .55 0;1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />}
      </feColorMatrix>
    </filter>
  </>;
}

export function TileDiscoveryArt({ tileId, relief = false, children }: { tileId: string | readonly string[]; relief?: boolean; children: ReactNode }) {
  const discovery = useTileDiscovery();
  return <span data-discovery-art={typeof tileId === 'string' ? tileId : tileId.join(' ')}
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', filter: discovery.filter(tileId, false, relief) }}>{children}</span>;
}
