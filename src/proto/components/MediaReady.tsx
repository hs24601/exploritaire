import { gameTime } from '../../gameTime';
import { useEffect, useState, type ReactNode } from 'react';
import { useArtStyle } from '../artStyle';
import { protoMediaAssets } from '../mediaAssets';
import { preloadMedia } from '../mediaCache';
import { prewarmSpriteBounds } from './spriteBounds';

/** Reveal the opening together; later styles warm without unmounting gameplay. */
export function MediaReady({ children }: { children: ReactNode }) {
  const style = useArtStyle();
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  useEffect(() => {
    let active = true;
    const assets = protoMediaAssets(style);
    const deadline = gameTime.setTimeout(() => { if (active) setReady(true); }, 8000);
    void preloadMedia(assets.opening, (done, total) => { if (active) setProgress({ done, total }); }).then(async () => {
      gameTime.clearTimeout(deadline);
      if (!active) return;
      setReady(true);
      // Measure each sprite while its decoded pixels are still warm.
      await preloadMedia(assets.background, undefined, prewarmSpriteBounds, () => active);
    });
    return () => { active = false; gameTime.clearTimeout(deadline); };
  }, [style]);
  if (ready) return children;
  return <div role="status" aria-live="polite" data-media-loading="true"
    style={{ height: '100dvh', display: 'grid', placeContent: 'center', gap: 16, background: '#10131b', color: '#f2e9d4', fontSize: 16 }}>
    <span>Preparing the table…</span>
    <progress aria-label="Loading artwork" value={progress.done} max={progress.total} style={{ width: 240 }} />
  </div>;
}
