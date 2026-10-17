import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useArtStyle } from '../artStyle';
import { protoMediaAssets } from '../mediaAssets';
import { preloadMedia, retainMediaImages } from '../mediaCache';
import { prewarmSpriteBounds } from './spriteBounds';

/** Reveal the opening together; later styles warm without unmounting gameplay. */
export function MediaReady({ children }: { children: ReactNode }) {
  const style = useArtStyle();
  const assets = useMemo(() => protoMediaAssets(style), [style]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  useEffect(() => {
    let active = true;
    const release = retainMediaImages(assets.opening);
    // Preparation includes sprite trim, not only the network download. Do not
    // expose OK after an arbitrary deadline while its artwork is still loading.
    void preloadMedia(assets.opening, (done, total) => { if (active) setProgress({ done, total }); }, prewarmSpriteBounds, () => active).then(async () => {
      if (!active) return;
      setReady(true);
      // Measure each sprite while its decoded pixels are still warm.
      await preloadMedia(assets.background, undefined, prewarmSpriteBounds, () => active);
    });
    return () => { active = false; release(); };
  }, [assets]);
  return <>
    {/* CSS backgrounds and alpha masks can have separate browser resource
        entries from Image preloads. Keep these tiny surfaces mounted so a
        newly selected den view reuses its already-live CSS resources. */}
    <div aria-hidden="true" data-media-scenery-preload="true" style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {assets.opening.filter(src => /hero-den-(sprite|front-quarter|side|rear|standee)/.test(src)).map(src => <span key={src} style={{ position: 'absolute', width: 1, height: 1,
        backgroundImage: `url("${src}")`, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />)}
    </div>
    {ready ? children : <div role="status" aria-live="polite" data-media-loading="true"
    style={{ height: '100dvh', display: 'grid', placeContent: 'center', gap: 16, background: '#10131b', color: '#f2e9d4', fontSize: 16 }}>
    <span>Preparing the table…</span>
    <progress aria-label="Loading artwork" value={progress.done} max={progress.total} style={{ width: 240 }} />
    </div>}
  </>;
}
