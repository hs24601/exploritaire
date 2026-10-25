import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { gameTime } from '../../gameTime';
import { useArtStyle } from '../artStyle';
import { protoMediaAssets } from '../mediaAssets';
import { loadMediaImage, preloadMedia, retainMediaImages } from '../mediaCache';
import { prewarmSpriteBounds } from './spriteBounds';
import { propVolumesSettled } from './PropVolume';
import { InkLoader } from './InkLoader';
import { bakeProceduralWoods, proceduralWoodsSources, PROCEDURAL_WOODS_STEPS } from '../proceduralWoods';

const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const URL_PATTERN = /url\((['"]?)(.*?)\1\)/g;

/** Every image the mounted scene shows through inline styles, <img> or SVG
 * <image>. Tile, prop and terrain art is chosen from the saved world while it
 * mounts, so this catches what a hand-kept opening list misses. */
function sceneImageSources(root: ParentNode) {
  const found = new Set<string>();
  const add = (src: string | null | undefined) => { if (src && !/^(data|blob):/.test(src)) found.add(new URL(src, document.baseURI).href); };
  root.querySelectorAll<HTMLElement>('[style*="url("]').forEach(element => {
    for (const value of [element.style.backgroundImage, element.style.maskImage, element.style.getPropertyValue('-webkit-mask-image')])
      for (const [, , src] of value.matchAll(URL_PATTERN)) add(src);
  });
  root.querySelectorAll('img').forEach(image => add(image.currentSrc || image.getAttribute('src')));
  root.querySelectorAll('image').forEach(image => add(image.getAttribute('href')));
  return found;
}

/** Waits until the main thread delivers a few ordinary frames in a row, so the
 * first draws, shader compiles and text fitting finish beneath the loader. */
async function quietFrames(limitMs: number) {
  const start = performance.now();
  let previous = await nextFrame(), calm = 0;
  while (calm < 3 && previous - start < limitMs) {
    const now = await nextFrame();
    calm = now - previous < 100 ? calm + 1 : 0;
    previous = now;
  }
}

/** Reveal the opening together; later styles warm without unmounting gameplay.
 * The scene mounts beneath the loader with game time held, and is revealed
 * only once its own artwork is decoded and its first frames have drawn. */
export function MediaReady({ children }: { children: ReactNode }) {
  const style = useArtStyle();
  const assets = useMemo(() => protoMediaAssets(style), [style]);
  const [phase, setPhase] = useState<'loading' | 'settling' | 'ready'>('loading');
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const sceneRef = useRef<HTMLDivElement>(null);
  const preparedTotal = useRef(1);
  const revealed = useRef(false);
  useEffect(() => {
    let active = true;
    const release = retainMediaImages(assets.opening);
    // Preparation includes sprite trim, not only the network download. Do not
    // expose OK after an arbitrary deadline while its artwork is still loading.
    // Paint also bakes its procedural pines in the paint worker here, counted
    // in the same progress; a failed bake leaves the static pines in place.
    const media = { done: 0, total: assets.opening.length }, woods = { done: 0, total: style === 'paint' ? PROCEDURAL_WOODS_STEPS : 0 };
    // One more step is reserved for the mounted scene settling under the loader.
    const report = () => { if (active && !revealed.current) setProgress({ done: media.done + woods.done, total: Math.max(1, media.total + woods.total + 1) }); };
    const baked = style === 'paint'
      ? bakeProceduralWoods(done => { woods.done = done; report(); }).then(() => Promise.all(proceduralWoodsSources().map(src => prewarmSpriteBounds(src).catch(() => undefined))))
      : Promise.resolve();
    void Promise.all([preloadMedia(assets.opening, (done, total) => { media.done = done; media.total = total; report(); }, prewarmSpriteBounds, () => active), baked]).then(async () => {
      if (!active) return;
      if (revealed.current) {
        // Bundled trims are precomputed; only unlisted art is measured here.
        await preloadMedia(assets.background, undefined, prewarmSpriteBounds, () => active);
        return;
      }
      preparedTotal.current = media.total + woods.total;
      setPhase('settling');
    });
    return () => { active = false; release(); };
  }, [assets, style]);
  useEffect(() => {
    if (phase !== 'settling') return;
    let active = true;
    // Hold game time so the opening dialogue and camera wait for the reveal;
    // a remount resetting the player's pause cannot release this hold.
    const resume = gameTime.hold();
    const prepared = preparedTotal.current;
    // Scan rounds can discover more art; the bar never moves backwards.
    let shown = prepared;
    const advance = (fraction: number) => { shown = Math.max(shown, prepared + fraction); if (active) setProgress({ done: shown, total: prepared + 1 }); };
    const settle = async () => {
      const seen = new Set<string>();
      // Mount effects choose more art (and solids) a frame or two later.
      for (let round = 0; round < 4 && active; round++) {
        await nextFrame(); await nextFrame();
        const root = sceneRef.current;
        const fresh = root ? [...sceneImageSources(root)].filter(src => !seen.has(src)) : [];
        fresh.forEach(src => seen.add(src));
        if (round > 0 && !fresh.length) break;
        await Promise.all([
          // The last fraction is left for the covered first frames.
          preloadMedia(fresh, (done, total) => advance(.9 * (seen.size - fresh.length + done) / seen.size), loadMediaImage, () => active),
          propVolumesSettled(),
        ]);
      }
      if (!active) return;
      // Visual loops run on game time: let their first draws happen covered.
      resume();
      await quietFrames(2500);
      advance(1);
    };
    // Never strand the player behind the loader if the scene cannot settle.
    void Promise.race([settle(), new Promise(resolve => setTimeout(resolve, 20000))]).then(async () => {
      if (!active) return;
      resume();
      revealed.current = true;
      setPhase('ready');
      // Bundled trims are precomputed; only unlisted art is measured here.
      await preloadMedia(assets.background, undefined, prewarmSpriteBounds, () => active);
    });
    return () => { active = false; resume(); };
  }, [phase, assets]);
  return <>
    {/* CSS backgrounds and alpha masks can have separate browser resource
        entries from Image preloads. Keep these tiny surfaces mounted so a
        newly selected den view reuses its already-live CSS resources. */}
    <div aria-hidden="true" data-media-scenery-preload="true" style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {assets.opening.filter(src => /hero-den-(sprite|front-quarter|side|rear|standee)/.test(src)).map(src => <span key={src} style={{ position: 'absolute', width: 1, height: 1,
        backgroundImage: `url("${src}")`, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />)}
    </div>
    {phase !== 'loading' && <div ref={sceneRef} style={{ display: 'contents' }} inert={phase === 'settling'} aria-hidden={phase === 'settling' || undefined}>{children}</div>}
    {phase !== 'ready' && <InkLoader done={progress.done} total={progress.total} cover={phase === 'settling'} />}
  </>;
}
